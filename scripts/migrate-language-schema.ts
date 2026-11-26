import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export async function runLanguageMigration() {
  console.log('--- Starting Phase 8 Multilingual Language Layer Migration ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sqlPath = path.join(process.cwd(), 'migrations', '0006_phase8_language_layer.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Applying 0006_phase8_language_layer.sql...');
    await client.query(sql);

    await client.query('COMMIT');
    console.log('✓ Phase 8 Multilingual Language Layer Schema Migration Succeeded.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration Failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runLanguageMigration()
    .then(() => {
      console.log('Language layer migration completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
