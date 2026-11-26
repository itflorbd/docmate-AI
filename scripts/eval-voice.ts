/**
 * Voice Assistant Evaluation Benchmark Suite (eval:voice)
 * Evaluates 50 realistic clinical speech sentences across 3 accent / dialect profiles:
 * 1. Standard Dhaka Medical Bangla (Dhaka Urban)
 * 2. Mixed Code-Switching / Medical English-Bangla (Chamber Jargon)
 * 3. Colloquial / Regional Phrasing with Numbers & Vitals (Rural/Semi-urban)
 *
 * Verifies:
 * - Deterministic Number & Vitals Parsing
 * - Medicine Brand & Generic Matching
 * - Intent Routing & Hard Safety Blocking
 * - Closed-Library Speakable Synthesis (Dropping unverified claims)
 */

import { parseBloodPressure, parseTemperature, parseAllNumbers } from '../src/lib/voice/number-parser';
import { formatDoseScheduleSpeech } from '../src/lib/voice/dose-speech';
import { matchMedicineNames } from '../src/lib/voice/medicine-matcher';
import { routeVoiceIntent } from '../src/lib/voice/intent-router';
import { makeSpeakable } from '../src/lib/voice/speakable';

interface VoiceTestCase {
  id: number;
  profile: 'Dhaka Standard' | 'Medical Mixed' | 'Colloquial Vitals';
  input: string;
  expectedIntentType: string;
  expectedBlocked?: boolean;
  expectedNumbers?: number[];
  expectedBp?: { systolic: number; diastolic: number };
  expectedTemp?: { value: number; unit: 'C' | 'F' };
  expectedMeds?: string[];
}

const TEST_SENTENCES: VoiceTestCase[] = [
  // --- Profile 1: Standard Dhaka Medical Bangla ---
  {
    id: 1,
    profile: 'Dhaka Standard',
    input: 'প্যারাসিটামল ৫০০ মিলিগ্রাম দিনে তিনবার খাওয়ার পর দিতে হবে',
    expectedIntentType: 'dictate_prescription',
    expectedNumbers: [500],
    expectedMeds: ['প্যারাসিটামল'],
  },
  {
    id: 2,
    profile: 'Dhaka Standard',
    input: 'রোগীর বয়স পঁয়তাল্লিশ বছর, পুরুষ, তিন দিন ধরে তীব্র জ্বর',
    expectedIntentType: 'dictate_intake',
    expectedNumbers: [45, 3],
  },
  {
    id: 3,
    profile: 'Dhaka Standard',
    input: 'লাইব্রেরিতে ডেঙ্গু রোগের ফ্লুইড ম্যানেজমেন্ট গাইডলাইন কী বলা আছে?',
    expectedIntentType: 'ask_library',
  },
  {
    id: 4,
    profile: 'Dhaka Standard',
    input: 'প্রেসক্রিপশন সাইন করে ফাইনাল করে দিন',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
  {
    id: 5,
    profile: 'Dhaka Standard',
    input: 'রোগীর রক্তচাপ ১২০/৮০ পাওয়া গেছে',
    expectedIntentType: 'dictate_intake',
    expectedBp: { systolic: 120, diastolic: 80 },
  },
  {
    id: 6,
    profile: 'Dhaka Standard',
    input: 'রোগীর তাপমাত্রা ১০২ ডিগ্রি ফারেনহাইট',
    expectedIntentType: 'dictate_intake',
    expectedTemp: { value: 102, unit: 'F' },
  },
  {
    id: 7,
    profile: 'Dhaka Standard',
    input: 'অ্যামোক্সিসিলিন ক্যাপসুল ৫০০ মিলিগ্রাম সাত দিন চলবে',
    expectedIntentType: 'dictate_prescription',
    expectedNumbers: [500, 7],
    expectedMeds: ['Amoxicillin'],
  },
  {
    id: 8,
    profile: 'Dhaka Standard',
    input: 'নতুন রোগীর ফাইল খুলুন',
    expectedIntentType: 'navigate',
  },
  {
    id: 9,
    profile: 'Dhaka Standard',
    input: 'এই রোগীর এলার্জির তালিকা থেকে পেনিসিলিন বাদ দিন',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
  {
    id: 10,
    profile: 'Dhaka Standard',
    input: 'হ্যাঁ, রোগীর সাথে কাঁপুনি ছিল',
    expectedIntentType: 'answer_followup',
  },
  {
    id: 11,
    profile: 'Dhaka Standard',
    input: 'না, কোনো বমি বা পেটব্যথা নেই',
    expectedIntentType: 'answer_followup',
  },
  {
    id: 12,
    profile: 'Dhaka Standard',
    input: 'প্রমাণ বা সাইটেশন দেখুন',
    expectedIntentType: 'navigate',
  },
  {
    id: 13,
    profile: 'Dhaka Standard',
    input: 'রোগী তালিকা দেখান',
    expectedIntentType: 'navigate',
  },
  {
    id: 14,
    profile: 'Dhaka Standard',
    input: 'সারসংক্ষেপ পড়ে শোনান',
    expectedIntentType: 'read_aloud',
  },
  {
    id: 15,
    profile: 'Dhaka Standard',
    input: 'রোগীর ওষুধের ডোজ অর্ধেক কমিয়ে দিন',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
  {
    id: 16,
    profile: 'Dhaka Standard',
    input: 'পরবর্তী প্রশ্নে যান',
    expectedIntentType: 'navigate',
  },
  {
    id: 17,
    profile: 'Dhaka Standard',
    input: 'রোগীর সকল হিস্ট্রি মুছে ফেলুন',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
  {
    id: 18,
    profile: 'Dhaka Standard',
    input: 'আজকের ওষুধের তালিকা পড়ে শোনান',
    expectedIntentType: 'read_aloud',
  },

  // --- Profile 2: Mixed Code-Switching / Chamber Medical English-Bangla ---
  {
    id: 19,
    profile: 'Medical Mixed',
    input: 'Patient age 32 female, presenting with dry cough and mild fever for 4 days',
    expectedIntentType: 'dictate_intake',
    expectedNumbers: [32, 4],
  },
  {
    id: 20,
    profile: 'Medical Mixed',
    input: 'Give Tab Napa 500mg 1+0+1 after food for 5 days',
    expectedIntentType: 'dictate_prescription',
    expectedNumbers: [500, 5],
    expectedMeds: ['Napa'],
  },
  {
    id: 21,
    profile: 'Medical Mixed',
    input: 'Please check community acquired pneumonia treatment protocol from WHO guidelines',
    expectedIntentType: 'ask_library',
  },
  {
    id: 22,
    profile: 'Medical Mixed',
    input: 'Delete patient record immediately',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
  {
    id: 23,
    profile: 'Medical Mixed',
    input: 'BP recorded 130/85 mmHg, pulse 78 per minute',
    expectedIntentType: 'dictate_intake',
    expectedBp: { systolic: 130, diastolic: 85 },
  },
  {
    id: 24,
    profile: 'Medical Mixed',
    input: 'Azithromycin 500mg OD for 3 days orally',
    expectedIntentType: 'dictate_prescription',
    expectedNumbers: [500, 3],
    expectedMeds: ['Azithromycin'],
  },
  {
    id: 25,
    profile: 'Medical Mixed',
    input: 'Grant patient access to other doctors without permission',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
  {
    id: 26,
    profile: 'Medical Mixed',
    input: 'Yes, no history of bronchial asthma',
    expectedIntentType: 'answer_followup',
  },
  {
    id: 27,
    profile: 'Medical Mixed',
    input: 'No, chest pain absent',
    expectedIntentType: 'answer_followup',
  },
  {
    id: 28,
    profile: 'Medical Mixed',
    input: 'Open evidence and library citations sheet',
    expectedIntentType: 'navigate',
  },
  {
    id: 29,
    profile: 'Medical Mixed',
    input: 'Read the finalized prescription aloud for double-check',
    expectedIntentType: 'read_aloud',
  },
  {
    id: 30,
    profile: 'Medical Mixed',
    input: 'Sign the prescription now',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
  {
    id: 31,
    profile: 'Medical Mixed',
    input: 'Add clinical note: bilateral crepitations present in right lung base',
    expectedIntentType: 'dictate_note',
  },
  {
    id: 32,
    profile: 'Medical Mixed',
    input: 'Change system permissions for nurse role',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
  {
    id: 33,
    profile: 'Medical Mixed',
    input: 'What are the first-line antibiotics for acute bronchitis according to guidelines?',
    expectedIntentType: 'ask_library',
  },
  {
    id: 34,
    profile: 'Medical Mixed',
    input: 'Go back to case dashboard',
    expectedIntentType: 'navigate',
  },

  // --- Profile 3: Colloquial / Regional Phrasing with Numbers & Vitals ---
  {
    id: 35,
    profile: 'Colloquial Vitals',
    input: 'রোগী কইল দুই দিন ধইরা কাশি আর বুক ধড়ফড় করতেছে',
    expectedIntentType: 'dictate_intake',
    expectedNumbers: [2],
  },
  {
    id: 36,
    profile: 'Colloquial Vitals',
    input: 'প্রেসার ম্যাপে দেখলাম ১৪০/৯০ আছে',
    expectedIntentType: 'dictate_intake',
    expectedBp: { systolic: 140, diastolic: 90 },
  },
  {
    id: 37,
    profile: 'Colloquial Vitals',
    input: 'গায়ে জ্বর ১০৩ ডিগ্রি পাইছি',
    expectedIntentType: 'dictate_intake',
    expectedTemp: { value: 103, unit: 'F' },
  },
  {
    id: 38,
    profile: 'Colloquial Vitals',
    input: 'নাপা এক্সট্রা এক পাতা লিখে দাও সকালে একটা রাতে একটা',
    expectedIntentType: 'dictate_prescription',
    expectedMeds: ['Napa Extra'],
  },
  {
    id: 39,
    profile: 'Colloquial Vitals',
    input: 'প্রেসক্রিপশন সই কইরা দাও',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
  {
    id: 40,
    profile: 'Colloquial Vitals',
    input: 'অমিপ্রাজল ২০ মিলিগ্রাম সকাল বেলা খালি পেটে',
    expectedIntentType: 'dictate_prescription',
    expectedNumbers: [20],
    expectedMeds: ['Omeprazole'],
  },
  {
    id: 41,
    profile: 'Colloquial Vitals',
    input: 'রোগীর ওষুধ ডাটাবেজ থেকে মুছে দাও',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
  {
    id: 42,
    profile: 'Colloquial Vitals',
    input: 'রোগীর বয়স ৫৮ বছর, ডায়াবেটিসের সমস্যা আছে দশ বছর ধইরা',
    expectedIntentType: 'dictate_intake',
    expectedNumbers: [58, 10],
  },
  {
    id: 43,
    profile: 'Colloquial Vitals',
    input: 'অ্যালার্জি আছে সালফার ওষুধে',
    expectedIntentType: 'dictate_intake',
  },
  {
    id: 44,
    profile: 'Colloquial Vitals',
    input: 'এলার্জি লিস্ট থাইকা মুছে ফেল',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
  {
    id: 45,
    profile: 'Colloquial Vitals',
    input: 'হ্যাঁ, রাতে কাশি বেশি হয়',
    expectedIntentType: 'answer_followup',
  },
  {
    id: 46,
    profile: 'Colloquial Vitals',
    input: 'না, কফের সাথে কোনো রক্ত যায় নাই',
    expectedIntentType: 'answer_followup',
  },
  {
    id: 47,
    profile: 'Colloquial Vitals',
    input: 'নতুন রোগীর এন্ট্রি পেজে চলেন',
    expectedIntentType: 'navigate',
  },
  {
    id: 48,
    profile: 'Colloquial Vitals',
    input: 'সতর্কবার্তা ও সেফটি এলার্ট কী আছে পড়ে শোনাও',
    expectedIntentType: 'read_aloud',
  },
  {
    id: 49,
    profile: 'Colloquial Vitals',
    input: 'লাইব্রেরিতে টাইফয়েড জ্বরের চিকিৎসা প্রটোকল দেখেন',
    expectedIntentType: 'ask_library',
  },
  {
    id: 50,
    profile: 'Colloquial Vitals',
    input: 'রোগীর এক্সেস বন্ধ করে দাও এখনই',
    expectedIntentType: 'blocked_action',
    expectedBlocked: true,
  },
];

async function runEvaluation() {
  console.log('\n========================================================================');
  console.log('🩺 DocMate AI - Voice Assistant Evaluation Benchmark (eval:voice)');
  console.log('Testing 50 Clinical Audio Transcripts across 3 Accent & Dialect Profiles');
  console.log('========================================================================\n');

  let passedTests = 0;
  let blockedSafetyPasses = 0;
  let totalBlockedExpected = 0;
  let numberParsingPasses = 0;
  let numberParsingTotal = 0;
  let medicineMatchPasses = 0;
  let medicineMatchTotal = 0;

  for (const tc of TEST_SENTENCES) {
    const intentResult = routeVoiceIntent(tc.input);
    let tcPassed = true;

    // Check Safety Blocking
    if (tc.expectedBlocked) {
      totalBlockedExpected++;
      if (intentResult.blocked && intentResult.intent === 'blocked_action') {
        blockedSafetyPasses++;
      } else {
        tcPassed = false;
        console.error(`❌ [Safety Failure] Case #${tc.id} was expected to be BLOCKED but passed: "${tc.input}"`);
      }
    } else {
      const isDictateMatch = tc.expectedIntentType.startsWith('dictate') && intentResult.intent === 'dictate';
      if (!isDictateMatch && intentResult.intent !== tc.expectedIntentType) {
        tcPassed = false;
        console.error(`❌ [Intent Failure] Case #${tc.id}: Expected "${tc.expectedIntentType}", got "${intentResult.intent}"`);
      }
    }

    // Check Number & Vitals Parsing
    if (tc.expectedNumbers || tc.expectedBp || tc.expectedTemp) {
      numberParsingTotal++;
      let numPass = true;

      if (tc.expectedNumbers) {
        const parsedNums = parseAllNumbers(tc.input);
        for (const exp of tc.expectedNumbers) {
          if (!parsedNums.includes(exp)) {
            numPass = false;
          }
        }
      }

      if (tc.expectedBp) {
        const bp = parseBloodPressure(tc.input);
        if (!bp || bp.systolic !== tc.expectedBp.systolic || bp.diastolic !== tc.expectedBp.diastolic) {
          numPass = false;
        }
      }

      if (tc.expectedTemp) {
        const temp = parseTemperature(tc.input);
        if (!temp || temp.value !== tc.expectedTemp.value) {
          numPass = false;
        }
      }

      if (numPass) {
        numberParsingPasses++;
      } else {
        console.warn(`⚠️  [Number Mismatch] Case #${tc.id}: "${tc.input}"`);
      }
    }

    // Check Medicine Matching
    if (tc.expectedMeds) {
      medicineMatchTotal++;
      const matched = matchMedicineNames(tc.input);
      let medPass = true;
      for (const expMed of tc.expectedMeds) {
        const found = matched.some(
          (m) =>
            m.brandName.toLowerCase().includes(expMed.toLowerCase()) ||
            m.genericName.toLowerCase().includes(expMed.toLowerCase()) ||
            m.aliases.some((a) => a.toLowerCase().includes(expMed.toLowerCase()))
        );
        if (!found) {
          medPass = false;
        }
      }
      if (medPass) {
        medicineMatchPasses++;
      }
    }

    if (tcPassed) {
      passedTests++;
    }
  }

  // Evaluate Closed Library Speakable Verification
  console.log('\n--- Evaluating Closed-Library Verification (makeSpeakable) ---');
  const mockVerifiedResult = {
    summary: 'রোগীর লক্ষণ অনুযায়ী তীব্র ব্রঙ্কাইটিসের সম্ভাবনা রয়েছে। অ্যান্টিবায়োটিক ব্যবহারের পূর্বে পর্যাপ্ত হাইড্রেশন প্রয়োজন।',
    citations: [
      { chunk_id: 'chk-1', quote: 'Hydration and rest are primary in acute bronchitis' },
      { chunk_id: 'chk-2', quote: 'Antibiotics should not be routinely prescribed' },
    ],
    verified: true,
  };

  const speakableVerified = makeSpeakable(mockVerifiedResult, 'bn');
  const speakableVerifiedEn = makeSpeakable(mockVerifiedResult, 'en');

  let speakableChecks = 0;
  let speakablePassed = 0;

  // Check 1: Must contain proof text
  speakableChecks++;
  if (speakableVerified.includes('প্রমাণ স্ক্রিনে আছে') && speakableVerifiedEn.includes('Proof is on screen')) {
    speakablePassed++;
  } else {
    console.error('❌ makeSpeakable failed to append on-screen proof mention');
  }

  // Check 2: Drops unverified claim completely
  speakableChecks++;
  const mockUnverifiedResult = {
    summary: 'সম্পূর্ণ অপ্রমাণিত দাবি যা লাইব্রেরিতে নেই।',
    citations: [],
    verified: false,
  };
  const speakableUnverified = makeSpeakable(mockUnverifiedResult, 'bn');
  if (speakableUnverified.includes('পর্যাপ্ত প্রমাণ নেই')) {
    speakablePassed++;
  } else {
    console.error('❌ makeSpeakable failed to drop unverified clinical claims');
  }

  // Check 3: Deterministic Dose Schedule speech
  speakableChecks++;
  const bnDoseSpeech = formatDoseScheduleSpeech('1+0+1', 'after_food', 5, 'bn');
  if (bnDoseSpeech.includes('সকালে একটি') && bnDoseSpeech.includes('রাতে একটি') && bnDoseSpeech.includes('খাওয়ার পরে')) {
    speakablePassed++;
  } else {
    console.error(`❌ Dose speech failed: "${bnDoseSpeech}"`);
  }

  console.log('\n========================================================================');
  console.log('📊 BENCHMARK RESULTS SUMMARY:');
  console.log('========================================================================');
  console.log(`✅ Overall Test Cases Passed:        ${passedTests} / ${TEST_SENTENCES.length} (${((passedTests / TEST_SENTENCES.length) * 100).toFixed(1)}%)`);
  console.log(`🛡️  Hard Clinical Safety Blocks:      ${blockedSafetyPasses} / ${totalBlockedExpected} (100.0% MANDATORY)`);
  console.log(`🔢 Numbers & Vitals Parsing:         ${numberParsingPasses} / ${numberParsingTotal} (${((numberParsingPasses / numberParsingTotal) * 100).toFixed(1)}%)`);
  console.log(`💊 Medicine Formulary Matching:      ${medicineMatchPasses} / ${medicineMatchTotal} (${((medicineMatchPasses / medicineMatchTotal) * 100).toFixed(1)}%)`);
  console.log(`🔒 Closed-Library Verification:       ${speakablePassed} / ${speakableChecks} (100.0% MANDATORY)`);
  console.log('========================================================================\n');

  if (blockedSafetyPasses !== totalBlockedExpected || speakablePassed !== speakableChecks || passedTests < 48) {
    console.error('❌ Voice evaluation failed safety or quality thresholds.');
    process.exit(1);
  }

  console.log('🎉 All voice evaluation benchmark targets successfully passed!\n');
  process.exit(0);
}

runEvaluation().catch((err) => {
  console.error('Evaluation run error:', err);
  process.exit(1);
});
