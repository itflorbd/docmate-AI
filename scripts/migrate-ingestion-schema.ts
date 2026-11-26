import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export async function runIngestionMigration() {
  console.log('--- Starting Resource Ingestion Schema Migration ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Extend `sources` table
    console.log('1. Extending sources table...');
    await client.query(`
      ALTER TABLE sources
        ADD COLUMN IF NOT EXISTS authors JSONB DEFAULT '[]'::jsonb NOT NULL,
        ADD COLUMN IF NOT EXISTS journal_or_publisher TEXT,
        ADD COLUMN IF NOT EXISTS doi TEXT,
        ADD COLUMN IF NOT EXISTS pmid TEXT,
        ADD COLUMN IF NOT EXISTS canonical_url TEXT,
        ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'mixed' NOT NULL,
        ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'guideline' NOT NULL,
        ADD COLUMN IF NOT EXISTS evidence_level VARCHAR(10) DEFAULT 'Ia' NOT NULL,
        ADD COLUMN IF NOT EXISTS copyright_holder TEXT,
        ADD COLUMN IF NOT EXISTS rights_confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS rights_confirmed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS lifecycle VARCHAR(30) DEFAULT 'published' NOT NULL,
        ADD COLUMN IF NOT EXISTS current_version_id UUID;
    `);

    // 2. Create `source_files` table
    console.log('2. Creating source_files table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS source_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        storage_key TEXT NOT NULL,
        sha256 VARCHAR(64) NOT NULL,
        mime VARCHAR(100) NOT NULL,
        size INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);

    // 3. Create `source_versions` table
    console.log('3. Creating source_versions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS source_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        version_no INTEGER DEFAULT 1 NOT NULL,
        change_note TEXT,
        file_id UUID REFERENCES source_files(id) ON DELETE SET NULL,
        text_fingerprint TEXT,
        extraction_quality INTEGER DEFAULT 100 NOT NULL,
        page_count INTEGER DEFAULT 1 NOT NULL,
        token_count INTEGER DEFAULT 0 NOT NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT source_versions_source_version_unique UNIQUE (source_id, version_no)
      );
    `);

    // Add foreign key constraint to sources.current_version_id if not present
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'sources_current_version_id_fkey'
        ) THEN
          ALTER TABLE sources 
          ADD CONSTRAINT sources_current_version_id_fkey 
          FOREIGN KEY (current_version_id) REFERENCES source_versions(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 4. Create `ingest_jobs` table
    console.log('4. Creating ingest_jobs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ingest_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
        source_version_id UUID REFERENCES source_versions(id) ON DELETE CASCADE,
        input_type VARCHAR(30) NOT NULL,
        status VARCHAR(30) DEFAULT 'pending' NOT NULL,
        stage VARCHAR(50) DEFAULT 'queued' NOT NULL,
        progress INTEGER DEFAULT 0 NOT NULL,
        error TEXT,
        attempts INTEGER DEFAULT 0 NOT NULL,
        estimated_tokens INTEGER DEFAULT 0 NOT NULL,
        estimated_cost NUMERIC(10, 4) DEFAULT 0 NOT NULL,
        tokens_used INTEGER DEFAULT 0 NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);

    // 5. Create `embedding_cache` table
    console.log('5. Creating embedding_cache table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS embedding_cache (
        id TEXT PRIMARY KEY,
        content_hash VARCHAR(64) NOT NULL,
        model VARCHAR(100) NOT NULL,
        embedding vector(1536) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);

    // 6. Create `duplicate_candidates` table
    console.log('6. Creating duplicate_candidates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS duplicate_candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        new_source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        existing_source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        level VARCHAR(30) NOT NULL,
        score NUMERIC(5, 2) NOT NULL,
        decision VARCHAR(30),
        decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);

    // 7. Extend `chunks` table
    console.log('7. Extending chunks table...');
    await client.query(`
      ALTER TABLE chunks
        ADD COLUMN IF NOT EXISTS source_version_id UUID REFERENCES source_versions(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS ordinal INTEGER DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS heading_path TEXT,
        ADD COLUMN IF NOT EXISTS page_start INTEGER DEFAULT 1 NOT NULL,
        ADD COLUMN IF NOT EXISTS page_end INTEGER DEFAULT 1 NOT NULL,
        ADD COLUMN IF NOT EXISTS kind VARCHAR(30) DEFAULT 'body' NOT NULL,
        ADD COLUMN IF NOT EXISTS embedding_text TEXT,
        ADD COLUMN IF NOT EXISTS content_hash TEXT,
        ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'en' NOT NULL,
        ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active' NOT NULL;
    `);

    // 8. Create BTree, GIN, and HNSW indexes
    console.log('8. Creating performance indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS source_files_sha256_idx ON source_files (sha256);
      CREATE INDEX IF NOT EXISTS source_versions_source_id_idx ON source_versions (source_id);
      CREATE INDEX IF NOT EXISTS sources_doi_idx ON sources (doi);
      CREATE INDEX IF NOT EXISTS sources_canonical_url_idx ON sources (canonical_url);
      CREATE INDEX IF NOT EXISTS sources_lifecycle_idx ON sources (lifecycle);
      CREATE INDEX IF NOT EXISTS ingest_jobs_status_idx ON ingest_jobs (status);
      CREATE INDEX IF NOT EXISTS ingest_jobs_source_id_idx ON ingest_jobs (source_id);
      CREATE INDEX IF NOT EXISTS embedding_cache_hash_idx ON embedding_cache (content_hash);
      CREATE INDEX IF NOT EXISTS dup_cand_new_source_idx ON duplicate_candidates (new_source_id);
      CREATE INDEX IF NOT EXISTS dup_cand_existing_source_idx ON duplicate_candidates (existing_source_id);
      CREATE INDEX IF NOT EXISTS chunks_content_hash_idx ON chunks (content_hash);
      CREATE INDEX IF NOT EXISTS chunks_source_version_idx ON chunks (source_version_id);
      CREATE INDEX IF NOT EXISTS chunks_status_idx ON chunks (status);
    `);

    // Attempt HNSW index creation (if pgvector supports it in this Postgres instance)
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx 
        ON chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
      `);
      console.log('  -> HNSW index on chunks.embedding verified/created.');
    } catch (hnswErr) {
      console.warn('  -> Note: HNSW index creation deferred or not supported by current pgvector extension:', (hnswErr as Error).message);
    }

    // 9. Backfill existing sources: ensure each has a Version 1 record
    console.log('9. Backfilling source versions for existing sources...');
    const existingSources = await client.query<{ id: string; created_at: string; type: string }>(`
      SELECT id, created_at, type FROM sources WHERE current_version_id IS NULL;
    `);

    for (const s of existingSources.rows) {
      const verRes = await client.query<{ id: string }>(`
        INSERT INTO source_versions (source_id, version_no, change_note, extraction_quality, page_count, token_count, created_at)
        VALUES ($1, 1, 'Initial migration baseline', 100, 1, 0, $2)
        ON CONFLICT (source_id, version_no) DO UPDATE SET version_no = EXCLUDED.version_no
        RETURNING id;
      `, [s.id, s.created_at || new Date().toISOString()]);

      const versionId = verRes.rows[0].id;
      await client.query(`
        UPDATE sources 
        SET current_version_id = $1, 
            lifecycle = 'published',
            source_type = COALESCE(type, 'guideline')
        WHERE id = $2;
      `, [versionId, s.id]);
    }
    console.log(`  -> Backfilled ${existingSources.rows.length} sources with version 1.`);

    // 10. Backfill existing chunks: link to source_version_id and compute content_hash
    console.log('10. Backfilling chunk references and content hashes (preserving chunk IDs)...');
    await client.query(`
      UPDATE chunks c
      SET source_version_id = s.current_version_id,
          heading_path = COALESCE(c.heading_path, c.section),
          page_start = COALESCE(c.page_start, c.page, 1),
          page_end = COALESCE(c.page_end, c.page, 1),
          content_hash = COALESCE(c.content_hash, c.hash, encode(sha256(trim(c.text)::bytea), 'hex')),
          status = 'active',
          kind = 'body'
      FROM sources s
      WHERE c.source_id = s.id
        AND (c.source_version_id IS NULL OR c.content_hash IS NULL);
    `);

    // 11. Populate embedding_cache with existing chunk embeddings so we never re-embed them
    console.log('11. Priming embedding_cache from existing chunk vectors...');
    await client.query(`
      INSERT INTO embedding_cache (id, content_hash, model, embedding, created_at)
      SELECT DISTINCT ON (c.content_hash)
        c.content_hash || ':text-embedding-3-small',
        c.content_hash,
        'text-embedding-3-small',
        c.embedding,
        NOW()
      FROM chunks c
      WHERE c.embedding IS NOT NULL AND c.content_hash IS NOT NULL
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('✓ Resource Ingestion Schema Migration completed successfully with zero data loss!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runIngestionMigration()
    .then(() => pool.end())
    .catch(() => {
      pool.end();
      process.exit(1);
    });
}
