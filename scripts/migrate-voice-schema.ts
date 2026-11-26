import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export async function runVoiceMigration() {
  console.log('--- Starting Phase 7 Voice Assistant Schema Migration ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sqlPath = path.join(process.cwd(), 'migrations', '0005_phase7_voice_assistant.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Applying 0005_phase7_voice_assistant.sql...');
    await client.query(sql);

    await client.query('COMMIT');
    console.log('✓ Phase 7 Voice Assistant Schema Migration Succeeded.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration Failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runVoiceMigration()
    .then(() => {
      console.log('Voice migration completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
