import { db } from '@/db';
import { phrasebankEntries } from '@/db/schema';
import { PHRASEBANK_DATA } from '@/lib/persona/phrasebank/data';

export async function seedPhrasebank() {
  console.log('--- Seeding Phrase Bank Entries ---');
  let inserted = 0;

  for (const entry of PHRASEBANK_DATA) {
    await db
      .insert(phrasebankEntries)
      .values({
        category: entry.category,
        locale: entry.locale,
        preset: entry.preset,
        text: entry.text,
        status: entry.status || 'live',
      })
      .onConflictDoNothing();
    inserted++;
  }

  console.log(`✓ Seeded ${inserted} phrase bank entries.`);
}

if (require.main === module) {
  seedPhrasebank()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
