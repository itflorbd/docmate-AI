// scripts/eval-language.ts
// DocMate AI - Multilingual Language Layer Benchmark Evaluation Runner

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { understandText } from '../src/lib/language';
import { routeVoiceIntent } from '../src/lib/voice/intent-router';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

interface TestCase {
  id: number;
  input: string;
  expected_lang: 'bn' | 'en' | 'banglish' | 'mixed';
  expected_dominant_lang?: 'bn' | 'en';
  expected_intent?: string;
  expected_symptoms?: Array<{ canonical: string; present: boolean; durationDays?: number }>;
  expected_medicines?: Array<{ canonical: string }>;
  expected_vitals?: Array<{ type: string; value: string }>;
  expected_ambiguity?: boolean;
  notes?: string;
}

export async function runLanguageEvaluation() {
  console.log('================================================================');
  console.log('🩺 DocMate AI — Multilingual Language Layer Evaluation Benchmark');
  console.log('================================================================\n');

  const filePath = path.join(process.cwd(), 'eval', 'language', 'test-cases.jsonl');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test cases file not found at ${filePath}`);
  }

  const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
  const testCases: TestCase[] = lines.map((l) => JSON.parse(l));

  console.log(`Loaded ${testCases.length} test cases from ${filePath}\n`);

  let totalLangTested = 0;
  let correctLang = 0;

  let totalNegationTested = 0;
  let correctNegation = 0;

  let totalNumberTested = 0;
  let correctNumber = 0;

  let totalIntentTested = 0;
  let correctIntent = 0;

  const failures: Array<{ id: number; input: string; reason: string }> = [];

  for (const tc of testCases) {
    const result = await understandText(tc.input, { skipCache: true });

    // 1. Language Detection Accuracy
    totalLangTested++;
    const isLangCorrect =
      result.detectedLang === tc.expected_lang ||
      (tc.expected_dominant_lang && result.dominantLang === tc.expected_dominant_lang);

    if (isLangCorrect) {
      correctLang++;
    } else {
      failures.push({
        id: tc.id,
        input: tc.input,
        reason: `Language mismatch: expected ${tc.expected_lang}, got ${result.detectedLang}`,
      });
    }

    // 2. Negation Scoping Accuracy
    if (tc.expected_symptoms && tc.expected_symptoms.length > 0) {
      for (const expectedSym of tc.expected_symptoms) {
        totalNegationTested++;
        const found = result.entities.symptoms.find((s) => s.canonicalEn === expectedSym.canonical);
        if (found && found.present === expectedSym.present) {
          correctNegation++;
        } else {
          failures.push({
            id: tc.id,
            input: tc.input,
            reason: `Negation mismatch for ${expectedSym.canonical}: expected present=${expectedSym.present}, got ${found ? found.present : 'not found'}`,
          });
        }
      }
    }

    // 3. Number / Duration / Vitals Accuracy
    if (tc.expected_symptoms) {
      for (const s of tc.expected_symptoms) {
        if (s.durationDays !== undefined) {
          totalNumberTested++;
          const found = result.entities.symptoms.find((sym) => sym.canonicalEn === s.canonical);
          if (found && found.durationDays === s.durationDays) {
            correctNumber++;
          } else {
            failures.push({
              id: tc.id,
              input: tc.input,
              reason: `Duration mismatch for ${s.canonical}: expected ${s.durationDays} days, got ${found?.durationDays}`,
            });
          }
        }
      }
    }
    if (tc.expected_vitals) {
      for (const v of tc.expected_vitals) {
        totalNumberTested++;
        const found = result.entities.vitals.find((vit) => vit.type === v.type);
        if (found && found.value === v.value) {
          correctNumber++;
        } else {
          failures.push({
            id: tc.id,
            input: tc.input,
            reason: `Vital mismatch for ${v.type}: expected ${v.value}, got ${found?.value}`,
          });
        }
      }
    }

    // 4. Intent Classification Accuracy
    if (tc.expected_intent) {
      totalIntentTested++;
      // Check both language intent and voice intent router
      const voiceRoute = routeVoiceIntent(tc.input, 'bn');
      const isIntentMatch =
        result.intent === tc.expected_intent ||
        voiceRoute.intent === tc.expected_intent ||
        (tc.expected_intent === 'navigate' && voiceRoute.intent === 'navigate');

      if (isIntentMatch) {
        correctIntent++;
      } else {
        failures.push({
          id: tc.id,
          input: tc.input,
          reason: `Intent mismatch: expected ${tc.expected_intent}, got ${result.intent} (voice: ${voiceRoute.intent})`,
        });
      }
    }

    // 5. Ambiguity Check
    if (tc.expected_ambiguity !== undefined) {
      if (result.ambiguity.isAmbiguous !== tc.expected_ambiguity) {
        failures.push({
          id: tc.id,
          input: tc.input,
          reason: `Ambiguity mismatch: expected ${tc.expected_ambiguity}, got ${result.ambiguity.isAmbiguous}`,
        });
      }
    }
  }

  // Calculate percentages
  const langPct = totalLangTested > 0 ? (correctLang / totalLangTested) * 100 : 100;
  const negPct = totalNegationTested > 0 ? (correctNegation / totalNegationTested) * 100 : 100;
  const numPct = totalNumberTested > 0 ? (correctNumber / totalNumberTested) * 100 : 100;
  const intentPct = totalIntentTested > 0 ? (correctIntent / totalIntentTested) * 100 : 100;

  // Thresholds from specs
  const langPass = langPct >= 95.0;
  const negPass = negPct >= 98.0;
  const numPass = numPct >= 98.0;
  const intentPass = intentPct >= 90.0;
  const allPassed = langPass && negPass && numPass && intentPass;

  console.log('----------------------------------------------------------------');
  console.log('EVALUATION RESULTS SUMMARY:');
  console.log('----------------------------------------------------------------');
  console.log(`1. Language Detection:  ${langPct.toFixed(1)}% (${correctLang}/${totalLangTested})  [Threshold: ≥95%] -> ${langPass ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`2. Negation Scoping:    ${negPct.toFixed(1)}% (${correctNegation}/${totalNegationTested})  [Threshold: ≥98%] -> ${negPass ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`3. Numbers & Durations: ${numPct.toFixed(1)}% (${correctNumber}/${totalNumberTested})  [Threshold: ≥98%] -> ${numPass ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`4. Intent Classification: ${intentPct.toFixed(1)}% (${correctIntent}/${totalIntentTested})  [Threshold: ≥90%] -> ${intentPass ? '✓ PASS' : '❌ FAIL'}`);
  console.log('----------------------------------------------------------------');
  console.log(`OVERALL BENCHMARK STATUS: ${allPassed ? '🎉 ALL THRESHOLDS PASSED' : '⚠️ THRESHOLD NOT MET'}\n`);

  if (failures.length > 0 && !allPassed) {
    console.log(`Sample Failures (${Math.min(failures.length, 20)}):`);
    for (const f of failures.slice(0, 20)) {
      console.log(`- Case #${f.id} "${f.input}": ${f.reason}`);
    }
    console.log('');
  }

  // Record in database table language_eval_runs
  try {
    const client = await pool.connect();
    await client.query(
      `INSERT INTO language_eval_runs (date, metrics, thresholds, passed, notes)
       VALUES (NOW(), $1, $2, $3, $4);`,
      [
        JSON.stringify({
          language_accuracy: Number(langPct.toFixed(2)),
          negation_accuracy: Number(negPct.toFixed(2)),
          number_accuracy: Number(numPct.toFixed(2)),
          intent_accuracy: Number(intentPct.toFixed(2)),
          total_cases: testCases.length,
          failures_count: failures.length,
        }),
        JSON.stringify({
          language_threshold: 95.0,
          negation_threshold: 98.0,
          number_threshold: 98.0,
          intent_threshold: 90.0,
        }),
        allPassed,
        `Clinical Multilingual Test Suite (${testCases.length} cases)`,
      ]
    );
    client.release();
    console.log('✓ Successfully logged evaluation run into database (language_eval_runs).');
  } catch (err) {
    console.warn('Could not write to language_eval_runs table:', err);
  } finally {
    await pool.end();
  }

  if (!allPassed) {
    process.exit(1);
  }
}

if (require.main === module) {
  runLanguageEvaluation()
    .then(() => {
      console.log('Evaluation finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
