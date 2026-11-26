// src/lib/language/understand.ts
// DocMate AI - Multilingual Understanding Engine (Chat & Voice Assistant)

import { preprocessText } from './preprocessor';
import { detectLanguage } from './detector';
import { matchTerms, canonicalizeTerms } from './term-matcher';
import { isTermNegated } from './negation-parser';
import { extractNumbers, extractDurations, extractVitals } from './number-duration-parser';
import { isCapabilitiesQuery, getCapabilitiesExplanation, detectAmbiguousDemonstratives } from './capabilities';
import { resolveReplyLanguage, UserLanguageOptions } from './reply-policy';
import { getCachedUnderstanding, setCachedUnderstanding } from './cache';
import { pool } from '@/db';
import {
  LanguageUnderstandingResult,
  LanguageIntent,
  ExtractedSymptom,
  ExtractedMedicine,
  AmbiguityInfo,
} from './types';

// Banglish/Bangla grammatical stopwords to strip when constructing canonical queries
const QUERY_FILTER_WORDS = new Set([
  'er', 'ar', 'aar', 'ki', 'koto', 'kemon', 'kothay', 'kivabe', 'keno', 'kno',
  'hobe', 'hoy', 'hocche', 'ache', 'ase', 'ashe', 'chilo', 'thake', 'lagbe',
  'dite', 'dile', 'khete', 'khawa', 'bolun', 'janan', 'dekhun', 'plz', 'please',
  'এর', 'আর', 'কী', 'কি', 'কত', 'কেমন', 'কোথায়', 'কীভাবে', 'কেন',
  'হবে', 'হয়', 'হচ্ছে', 'আছে', 'ছিল', 'থাকে', 'লাগবে', 'দিতে', 'খেতে', 'বলুন',
  'is', 'the', 'a', 'an', 'what', 'which', 'how', 'much', 'please', 'tell', 'me'
]);

/**
 * Asynchronously logs unmatched terms for admin review in the background.
 */
async function recordUnmatchedTermsBackground(
  rawTokens: string[],
  detectedLang: string
) {
  try {
    const candidateTokens = rawTokens.filter(
      (t) =>
        t.length >= 3 &&
        !QUERY_FILTER_WORDS.has(t.toLowerCase()) &&
        !/^\d+$/.test(t)
    );

    for (const token of candidateTokens.slice(0, 3)) {
      await pool.query(
        `INSERT INTO unmatched_terms (term, language, count, first_seen, last_seen, status)
         VALUES ($1, $2, 1, NOW(), NOW(), 'pending')
         ON CONFLICT (LOWER(term))
         DO UPDATE SET count = unmatched_terms.count + 1, last_seen = NOW()
         WHERE unmatched_terms.status != 'ignored';`,
        [token.toLowerCase(), detectedLang]
      );
    }
  } catch {
    // Non-blocking background telemetry
  }
}

/**
 * Constructs a clean canonical English query from clinical findings & intent.
 */
function buildCanonicalEnglishQuery(
  originalText: string,
  matchedTerms: ReturnType<typeof matchTerms>,
  intent: LanguageIntent
): string {
  // If query is already clean English and has length, canonicalize terms
  const termsText = matchedTerms.map((m) => m.canonicalEn).join(' ');

  if (intent === 'medicine_lookup') {
    return `dosage and administration of ${termsText || originalText}`.trim();
  }

  if (intent === 'ask_capabilities') {
    return 'assistant system capabilities';
  }

  // Strip Banglish filler words
  const words = originalText.split(/\s+/);
  const filtered = words.filter((w) => !QUERY_FILTER_WORDS.has(w.toLowerCase()));

  // Replace matched term words
  const { canonicalText } = canonicalizeTerms(filtered.join(' '));
  return canonicalText.trim() || originalText.trim();
}

/**
 * Constructs a clean Bangla query for hybrid search.
 */
function buildBanglaQuery(
  matchedTerms: ReturnType<typeof matchTerms>,
  originalText: string
): string {
  const bnTerms = matchedTerms
    .map((m) => (m.variantType === 'bn' ? m.rawText : null))
    .filter(Boolean);

  if (bnTerms.length > 0) {
    return bnTerms.join(' ');
  }
  return originalText.trim();
}

/**
 * Core understanding function for all user input (chat, voice, intake).
 */
export async function understandText(
  rawText: string,
  options?: {
    userPrefs?: UserLanguageOptions;
    skipCache?: boolean;
  }
): Promise<LanguageUnderstandingResult> {
  const prep = preprocessText(rawText);
  const normalized = prep.normalized;

  // 1. Check in-memory / SHA-256 cache
  if (!options?.skipCache) {
    const cached = getCachedUnderstanding(normalized);
    if (cached) {
      return cached;
    }
  }

  // 2. Language Detection
  const detection = detectLanguage(normalized);

  // 3. Capabilities Check ("tmi ki dekhte paro how much efficient this is ?")
  if (isCapabilitiesQuery(normalized)) {
    const replyLang = resolveReplyLanguage(detection, options?.userPrefs);
    const { ambiguity } = getCapabilitiesExplanation(replyLang);

    const result: LanguageUnderstandingResult = {
      originalText: rawText,
      detectedLang: detection.lang,
      dominantLang: detection.dominantLang,
      canonicalEnglishQuery: 'assistant capabilities and clinical vision scope',
      banglaQuery: 'সহকারী সক্ষমতা ও দৃষ্টিসীমা',
      intent: 'ask_capabilities',
      entities: {
        symptoms: [],
        medicines: [],
        vitals: [],
        durations: [],
        numbers: [],
      },
      ambiguity,
      fieldsNeedingConfirmation: [],
      replyLanguage: replyLang,
      retrievalQueries: ['assistant capabilities', 'clinical vision scope'],
    };

    setCachedUnderstanding(normalized, result);
    return result;
  }

  // 4. Deterministic Term Matching
  const matchedTerms = matchTerms(normalized);

  // 5. Deterministic Numbers, Durations & Vitals
  const numbers = extractNumbers(normalized);
  const durations = extractDurations(normalized);
  const vitals = extractVitals(normalized);

  // 6. Symptom & Medicine Entity Extraction with Negation Scoping
  const symptoms: ExtractedSymptom[] = [];
  const medicines: ExtractedMedicine[] = [];

  for (const m of matchedTerms) {
    if (m.category === 'symptom' || m.category === 'disease' || m.category === 'sign') {
      const negationCheck = isTermNegated(normalized, m.start, m.end);
      const isPresent = !negationCheck.isNegated;

      // Find nearest duration if any exists within text
      let matchedDuration: string | undefined;
      let durationDays: number | undefined;
      if (durations.length > 0) {
        // Nearest duration
        const nearest = durations[0];
        matchedDuration = nearest.rawText;
        durationDays = nearest.daysEquivalent;
      }

      symptoms.push({
        name: m.matchedVariant,
        canonicalEn: m.canonicalEn,
        present: isPresent,
        duration: matchedDuration,
        durationDays,
        rawText: m.rawText,
      });
    } else if (m.category === 'medicine_generic' || m.category === 'medicine_brand') {
      medicines.push({
        name: m.matchedVariant,
        canonicalEn: m.canonicalEn,
        brandOrGeneric: m.category === 'medicine_brand' ? 'brand' : 'generic',
        rawText: m.rawText,
      });
    }
  }

  // 7. Intent Classification
  let intent: LanguageIntent = 'ask_library';

  const isGreeting = /^(?:hi|hello|hey|salaam|assalamu\s*alaikum|nomoshkar|নমস্কার|সালাম|হাই|হ্যালো)\b/i.test(normalized);
  const isMedLookup = /(?:dose|dosage|matra|how\s*to\s*give|use|side\s*effect|contraindication|মাত্রা|ডোজ|ব্যবহার|খাওয়ার\s*নিয়ম|পার্শ্বপ্রতিক্রিয়া)/i.test(normalized);
  const isNavigate = /(?:open|goto|navigate|নতুন\s*রোগী|রোগীর\s*তালিকা|সেটিংস|হোম|ড্যাশবোর্ড|back|notun\s*rogi)/i.test(normalized);
  const isIntakeDictation = vitals.length > 0 && symptoms.length > 0;

  if (isGreeting) {
    intent = 'greeting';
  } else if (isNavigate) {
    intent = 'navigate';
  } else if (isMedLookup && medicines.length > 0) {
    intent = 'medicine_lookup';
  } else if (isIntakeDictation) {
    intent = 'dictate_intake';
  } else if (/^(?:yes|no|haan|na|nai|nei|ache|হ্যাঁ|না|নেই|আছে)\b/i.test(normalized)) {
    intent = 'answer_followup';
  }

  // 8. Ambiguity Analysis
  const demonstrativeAmbiguity = detectAmbiguousDemonstratives(
    normalized,
    symptoms.length > 0 || medicines.length > 0
  );

  let ambiguity: AmbiguityInfo = demonstrativeAmbiguity || {
    isAmbiguous: false,
  };

  // If a dosage question was asked without naming a drug
  if (isMedLookup && medicines.length === 0) {
    ambiguity = {
      isAmbiguous: true,
      reason: 'Medication inquiry missing drug name',
      clarifyingQuestionBn: 'আপনি কোন ওষুধের ডোজ বা ব্যবহারবিধি জানতে চাচ্ছেন?',
      clarifyingQuestionEn: 'Which medication are you asking about?',
      quickChips: [
        { labelBn: 'প্যারাসিটামল (Napa)', labelEn: 'Paracetamol', value: 'Napa dose koto?' },
        { labelBn: 'অ্যামোক্সিসিলিন (Amoxicillin)', labelEn: 'Amoxicillin', value: 'Amoxicillin dose koto?' },
        { labelBn: 'সেকলো (Omeprazole)', labelEn: 'Seclo', value: 'Seclo 20mg dose koto?' },
      ],
    };
  }

  // 9. Query Generation for Hybrid Search
  const canonicalEnglishQuery = buildCanonicalEnglishQuery(normalized, matchedTerms, intent);
  const banglaQuery = buildBanglaQuery(matchedTerms, normalized);

  const retrievalQueries = Array.from(
    new Set([canonicalEnglishQuery, banglaQuery, rawText].filter(Boolean))
  ).slice(0, 3);

  // 10. Reply Language Choice
  const replyLanguage = resolveReplyLanguage(detection, options?.userPrefs);

  // 11. Fields needing confirmation
  const fieldsNeedingConfirmation: string[] = [];
  if (ambiguity.isAmbiguous && ambiguity.reason) {
    fieldsNeedingConfirmation.push(ambiguity.reason);
  }

  const result: LanguageUnderstandingResult = {
    originalText: rawText,
    detectedLang: detection.lang,
    dominantLang: detection.dominantLang,
    canonicalEnglishQuery,
    banglaQuery,
    intent,
    entities: {
      symptoms,
      medicines,
      vitals,
      durations,
      numbers,
    },
    ambiguity,
    fieldsNeedingConfirmation,
    replyLanguage,
    retrievalQueries,
  };

  // Cache decision
  setCachedUnderstanding(normalized, result);

  // Asynchronously record potential unmatched terms
  const tokens = normalized.split(/\s+/);
  recordUnmatchedTermsBackground(tokens, detection.lang);

  return result;
}
