-- Migration 0009: Phase 11 - Resource Ingestion, Source Versions, and Ingestion Jobs

-- 1. Extend sources table
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

-- 2. Create source_files table
CREATE TABLE IF NOT EXISTS source_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key TEXT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  mime VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create source_versions table
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

-- Ensure unique constraint exists even if table pre-existed without it
DELETE FROM source_versions a USING source_versions b
WHERE a.id < b.id AND a.source_id = b.source_id AND a.version_no = b.version_no;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'source_versions_source_version_unique'
  ) THEN
    ALTER TABLE source_versions ADD CONSTRAINT source_versions_source_version_unique UNIQUE (source_id, version_no);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_source_versions_source_version ON source_versions (source_id, version_no);
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sources_current_version_id_fkey'
  ) THEN
    ALTER TABLE sources 
    ADD CONSTRAINT sources_current_version_id_fkey 
    FOREIGN KEY (current_version_id) REFERENCES source_versions(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 4. Create ingest_jobs table
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

-- 5. Create embedding_cache table (if pgvector is enabled)
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS embedding_cache (
    id TEXT PRIMARY KEY,
    content_hash VARCHAR(64) NOT NULL,
    model VARCHAR(100) NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping embedding_cache table creation if vector extension is unavailable: %', SQLERRM;
END $$;

-- 6. Create duplicate_candidates table
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

-- 7. Extend chunks table
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

-- 8. Create Indexes
CREATE INDEX IF NOT EXISTS source_files_sha256_idx ON source_files (sha256);
CREATE INDEX IF NOT EXISTS source_versions_source_id_idx ON source_versions (source_id);
CREATE INDEX IF NOT EXISTS sources_doi_idx ON sources (doi);
CREATE INDEX IF NOT EXISTS sources_canonical_url_idx ON sources (canonical_url);
CREATE INDEX IF NOT EXISTS sources_lifecycle_idx ON sources (lifecycle);
CREATE INDEX IF NOT EXISTS ingest_jobs_status_idx ON ingest_jobs (status);
CREATE INDEX IF NOT EXISTS ingest_jobs_source_id_idx ON ingest_jobs (source_id);
CREATE INDEX IF NOT EXISTS dup_cand_new_source_idx ON duplicate_candidates (new_source_id);
CREATE INDEX IF NOT EXISTS dup_cand_existing_source_idx ON duplicate_candidates (existing_source_id);
CREATE INDEX IF NOT EXISTS chunks_content_hash_idx ON chunks (content_hash);
CREATE INDEX IF NOT EXISTS chunks_source_version_idx ON chunks (source_version_id);
CREATE INDEX IF NOT EXISTS chunks_status_idx ON chunks (status);

-- 9. Backfill version 1 for any existing sources without a current_version_id
INSERT INTO source_versions (source_id, version_no, change_note, extraction_quality, page_count, token_count, created_at)
SELECT id, 1, 'Initial migration baseline', 100, 1, 0, COALESCE(created_at, NOW())
FROM sources
WHERE current_version_id IS NULL
ON CONFLICT (source_id, version_no) DO NOTHING;

UPDATE sources s
SET current_version_id = sv.id,
    lifecycle = COALESCE(s.lifecycle, 'published'),
    source_type = COALESCE(s.source_type, s.type, 'guideline')
FROM source_versions sv
WHERE sv.source_id = s.id AND s.current_version_id IS NULL;

-- 10. Backfill chunk references
UPDATE chunks c
SET source_version_id = s.current_version_id,
    heading_path = COALESCE(c.heading_path, c.section),
    page_start = COALESCE(c.page_start, c.page, 1),
    page_end = COALESCE(c.page_end, c.page, 1),
    content_hash = COALESCE(c.content_hash, c.hash, encode(sha256(trim(c.text)::bytea), 'hex')),
    status = COALESCE(c.status, 'active'),
    kind = COALESCE(c.kind, 'body')
FROM sources s
WHERE c.source_id = s.id
  AND (c.source_version_id IS NULL OR c.content_hash IS NULL);
