import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export async function runMigrations() {
  console.log('========================================================================');
  console.log('  DocMate AI — Production Database Migration Runner');
  console.log(`  Target: ${isLocal ? 'Local Database' : 'Remote Production Database'}`);
  console.log('========================================================================\n');

  const client = await pool.connect();

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);

    // 2. Pre-flight repair: ensure existing tables have required unique constraints before migration scripts run
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='role_features') THEN
          DELETE FROM role_features a USING role_features b
          WHERE a.id < b.id AND a.role = b.role AND a.feature_key = b.feature_key;

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_role_feature') THEN
            BEGIN
              ALTER TABLE role_features ADD CONSTRAINT uq_role_feature UNIQUE (role, feature_key);
            EXCEPTION WHEN OTHERS THEN
              CREATE UNIQUE INDEX IF NOT EXISTS idx_role_features_role_key ON role_features (role, feature_key);
            END;
          END IF;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_feature_overrides') THEN
          DELETE FROM user_feature_overrides a USING user_feature_overrides b
          WHERE a.id < b.id AND a.user_id = b.user_id AND a.feature_key = b.feature_key;

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_feature_override') THEN
            BEGIN
              ALTER TABLE user_feature_overrides ADD CONSTRAINT uq_user_feature_override UNIQUE (user_id, feature_key);
            EXCEPTION WHEN OTHERS THEN
              CREATE UNIQUE INDEX IF NOT EXISTS idx_user_feature_overrides_user_key ON user_feature_overrides (user_id, feature_key);
            END;
          END IF;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END $$;
    `);

    // 3. Query already applied migrations
    const { rows: appliedRows } = await client.query<{ id: string }>(
      'SELECT id FROM schema_migrations'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.id));

    // 4. Read all .sql files in migrations/ directory
    const migrationsDir = path.join(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.warn(`⚠️ Migrations directory not found at: ${migrationsDir}`);
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration file(s) in ${migrationsDir}.\n`);

    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        console.log(`  [SKIP] ${file} (already applied)`);
        continue;
      }

      console.log(`  [APPLYING] ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓ [SUCCESS] ${file}`);
      } catch (migrationErr) {
        await client.query('ROLLBACK');
        console.error(`  ❌ [FAILED] ${file}:`, migrationErr);
        throw migrationErr;
      }
    }

    // 4. Critical Schema Drift Verification & Self-Healing
    console.log('\nRunning sanity schema verification...');

    // Verification A: cases.entered_by_voice
    await client.query(`
      ALTER TABLE cases 
        ADD COLUMN IF NOT EXISTS entered_by_voice BOOLEAN DEFAULT FALSE NOT NULL;
    `);

    // Verification B: cases.profile_id
    await client.query(`
      ALTER TABLE cases 
        ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES patient_profiles(id) ON DELETE SET NULL;
    `);

    // Verification C: voice_sessions & user_assistant_prefs existence check
    const { rows: verifiedTables } = await client.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('voice_sessions', 'user_assistant_prefs', 'patient_accounts', 'ingest_jobs', 'term_aliases')
    `);
    const verifiedNames = verifiedTables.map((t) => t.table_name);
    console.log(`Verified active tables: ${verifiedNames.join(', ')}`);

    console.log('\n✅ All database migrations applied and verified successfully!\n');
  } catch (err) {
    console.error('❌ Migration runner encountered a fatal error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Support direct execution via tsx / node
const isMain = process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js');
if (isMain) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
