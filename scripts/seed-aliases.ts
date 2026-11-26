import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export async function seedTermAliases() {
  console.log('--- Seeding Term Aliases into database ---');
  const client = await pool.connect();
  try {
    const seedPath = path.join(process.cwd(), 'data', 'aliases.seed.json');
    const content = fs.readFileSync(seedPath, 'utf-8');
    const aliases = JSON.parse(content);

    console.log(`Found ${aliases.length} aliases in ${seedPath}`);

    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;

    for (const item of aliases) {
      const res = await client.query(
        `INSERT INTO term_aliases (canonical_en, category, variants, status, notes, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (canonical_en, category) 
         DO UPDATE SET variants = EXCLUDED.variants, status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = NOW()
         RETURNING (xmax = 0) AS is_insert;`,
        [item.canonical_en, item.category, JSON.stringify(item.variants), item.status || 'active', item.notes || null]
      );

      if (res.rows[0]?.is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');
    console.log(`✓ Successfully seeded term aliases: ${inserted} inserted, ${updated} updated.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding term aliases failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedTermAliases()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
