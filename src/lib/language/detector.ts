// src/lib/language/detector.ts
// DocMate AI - Multilingual Script & Language Detection

import { preprocessText } from './preprocessor';
import { countBanglishWords } from './lexicon';
import {
  LanguageDetectionResult,
  LanguageSegment,
  SupportedLanguage,
  DominantLanguage,
} from './types';

// Regex constants
const BANGLA_CHAR_REGEX = /[\u0980-\u09FF]/g;
const LATIN_CHAR_REGEX = /[a-zA-Z]/g;

// High-confidence Banglish trigger terms (presence of any strongly implies Banglish)
const STRONG_BANGLISH_TRIGGERS = new Set([
  'ki', 'kemon', 'kmn', 'kothay', 'koto', 'kotogulo', 'konta', 'keno', 'kno',
  'kivabe', 'hobe', 'hoy', 'hocche', 'hochhe', 'hoise', 'ache', 'achhe', 'ase',
  'nai', 'nei', 'na', 'noy', 'chhara', 'chara', 'kintu', 'tobe', 'othoba',
  'dhore', 'din', 'jor', 'kashi', 'betha', 'batha', 'shashkosto', 'bomi',
  'dekhte', 'paro', 'bolun', 'rogir', 'osudh', 'daktar'
]);

// English grammar words. Clinical nouns such as "fever" or "dengue" appear in
// the Banglish lexicon too, so grammar words decide between English and Banglish.
const ENGLISH_GRAMMAR_WORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'can', 'could', 'should', 'would', 'does', 'do', 'did', 'any', 'of',
  'for', 'and', 'or', 'in', 'on', 'with', 'what', 'which', 'when', 'how', 'why', 'has', 'have', 'had',
  'this', 'that', 'these', 'there', 'patient', 'denies', 'reports', 'since', 'from', 'to', 'an', 'a', 'i',
  'my', 'his', 'her', 'their', 'be', 'been', 'not', 'no', 'after', 'before', 'about', 'into', 'than',
]);

function englishGrammarCount(tokens: string[]): number {
  return tokens.filter((token) => ENGLISH_GRAMMAR_WORDS.has(token.toLowerCase())).length;
}

function looksLikeEnglishSentence(tokens: string[], minimum = 2): boolean {
  const grammar = englishGrammarCount(tokens);
  return grammar >= minimum && grammar / tokens.length >= 0.15;
}

/**
 * Splits text into word tokens (alphanumeric sequences).
 */
function extractLatinTokens(text: string): string[] {
  const matches = text.match(/[a-zA-Z]+/g);
  return matches || [];
}

/**
 * Segments text into contiguous language spans: 'bn', 'en', 'banglish'.
 */
export function segmentLanguage(text: string): LanguageSegment[] {
  if (!text || !text.trim()) return [];

  const segments: LanguageSegment[] = [];
  // Tokenize preserving whitespace and punctuation boundaries
  const regex = /([\u0980-\u09FF]+)|([a-zA-Z]+)|([^a-zA-Z\u0980-\u09FF]+)/gu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const rawMatch = match[0];
    const start = match.index;
    const end = start + rawMatch.length;

    if (match[1]) {
      // Bangla script
      segments.push({ text: rawMatch, lang: 'bn', start, end });
    } else if (match[2]) {
      // Latin word - check if it's Banglish or English
      const lower = rawMatch.toLowerCase();
      const isBanglish = STRONG_BANGLISH_TRIGGERS.has(lower) || countBanglishWords([lower]).ratio > 0.5;
      segments.push({
        text: rawMatch,
        lang: isBanglish ? 'banglish' : 'en',
        start,
        end,
      });
    }
  }

  // Merge consecutive segments of the same language
  if (segments.length <= 1) return segments;

  const merged: LanguageSegment[] = [];
  let current = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    if (next.lang === current.lang) {
      current = {
        text: text.slice(current.start, next.end),
        lang: current.lang,
        start: current.start,
        end: next.end,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Detects the language style of the given text:
 * - 'bn': predominantly Bengali script
 * - 'en': predominantly English (Latin script with minimal Banglish lexicon match)
 * - 'banglish': predominantly Latin script with substantial Banglish lexicon match
 * - 'mixed': substantial mix of Bengali script and Latin script (or English with Banglish)
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  const prep = preprocessText(text);
  const normalized = prep.normalized;

  if (!normalized) {
    return {
      lang: 'bn',
      dominantLang: 'bn',
      confidence: 1.0,
      banglaCharRatio: 0,
      latinCharRatio: 0,
      banglishWordRatio: 0,
      segments: [],
    };
  }

  // Count characters
  const banglaChars = (normalized.match(BANGLA_CHAR_REGEX) || []).length;
  const latinChars = (normalized.match(LATIN_CHAR_REGEX) || []).length;
  const totalLetters = banglaChars + latinChars;

  // Extract Latin tokens and match against Banglish lexicon
  const latinTokens = extractLatinTokens(normalized);
  const banglishStats = countBanglishWords(latinTokens);

  // Check for strong Banglish triggers
  const hasStrongTrigger = latinTokens.some((t) =>
    STRONG_BANGLISH_TRIGGERS.has(t.toLowerCase())
  );

  const banglaCharRatio = totalLetters > 0 ? banglaChars / totalLetters : 0;
  const latinCharRatio = totalLetters > 0 ? latinChars / totalLetters : 0;
  const banglishWordRatio = banglishStats.ratio;

  const segments = segmentLanguage(normalized);

  // Decision logic
  let lang: SupportedLanguage;
  let dominantLang: DominantLanguage = 'bn';
  let confidence = 0.9;

  if (totalLetters === 0) {
    // Digits or punctuation only
    lang = 'bn';
    dominantLang = 'bn';
    confidence = 0.5;
  } else if (banglaChars > 0 && latinChars > 0) {
    // Both scripts are present
    // If one script heavily dominates (>85%) and the other is just 1 small token/unit (like 'mg' or 'দিন')
    if (banglaCharRatio >= 0.88) {
      lang = 'bn';
      dominantLang = 'bn';
      confidence = 0.95;
    } else if (latinCharRatio >= 0.88) {
      if (banglishWordRatio >= 0.2 || hasStrongTrigger) {
        lang = 'banglish';
        dominantLang = 'bn';
      } else {
        lang = 'en';
        dominantLang = 'en';
      }
      confidence = 0.9;
    } else {
      // Truly mixed script sentence, e.g. "রোগীর তিন দিন ধরে jor ar kashi, কাঁপুনি নেই"
      lang = 'mixed';
      dominantLang = banglaCharRatio >= 0.45 ? 'bn' : 'en';
      confidence = 0.95;
    }
  } else if (banglaChars > 0) {
    // Pure Bengali script
    lang = 'bn';
    dominantLang = 'bn';
    confidence = 0.99;
  } else {
    // Pure Latin script
    // Decide between English and Banglish
    // Words like "ache" are both Banglish triggers and English ("body ache").
    const englishSentence = looksLikeEnglishSentence(latinTokens);
    const clearlyEnglish = looksLikeEnglishSentence(latinTokens, 4);
    if ((hasStrongTrigger && !clearlyEnglish) || (banglishWordRatio >= 0.20 && !englishSentence)) {
      lang = 'banglish';
      dominantLang = 'bn'; // Banglish semantics are Bengali
      confidence = Math.min(0.75 + banglishWordRatio * 0.25, 0.99);
    } else {
      // Check if there are medical words with English grammar
      lang = 'en';
      dominantLang = 'en';
      confidence = Math.max(0.85, 1.0 - banglishWordRatio);
    }
  }

  return {
    lang,
    dominantLang,
    confidence,
    banglaCharRatio: Number(banglaCharRatio.toFixed(3)),
    latinCharRatio: Number(latinCharRatio.toFixed(3)),
    banglishWordRatio: Number(banglishWordRatio.toFixed(3)),
    segments,
  };
}
