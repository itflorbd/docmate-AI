// src/lib/language/term-matcher.ts
// DocMate AI - Clinical Term Matcher & Canonicalizer

import aliasesSeed from '../../../data/aliases.seed.json';
import { TermAliasRecord, TermVariantMap } from './types';

export interface MatchedTerm {
  canonicalEn: string;
  category: string;
  matchedVariant: string;
  variantType: 'bn' | 'banglish' | 'en' | 'bn_translit_en';
  start: number;
  end: number;
  rawText: string;
}

// In-memory alias dictionary loaded from seed json or DB
let ALIASES_CACHE: TermAliasRecord[] = [];
const TRANSLIT_VARIANTS = new Set<string>();
let COMPILED_TERMS: Array<{
  canonicalEn: string;
  category: string;
  variant: string;
  variantType: 'bn' | 'banglish' | 'en' | 'bn_translit_en';
  regex: RegExp;
  length: number;
}> = [];

/**
 * Loads and compiles aliases from seed file into memory.
 */
export function initTermMatcher(aliases?: TermAliasRecord[]) {
  if (aliases && aliases.length > 0) {
    ALIASES_CACHE = aliases;
  } else if (ALIASES_CACHE.length === 0) {
    ALIASES_CACHE = (aliasesSeed as unknown) as TermAliasRecord[];
  }

  // Compile regexes for each variant
  // Sort longer phrases first so that "productive cough" matches before "cough"
  const compiled: typeof COMPILED_TERMS = [];
  TRANSLIT_VARIANTS.clear();

  for (const item of ALIASES_CACHE) {
    if (item.status === 'pending') continue;

    const variants: TermVariantMap = item.variants || {};
    if (variants.bn_translit_en) {
      for (const t of variants.bn_translit_en) {
        if (t && t.trim()) TRANSLIT_VARIANTS.add(t.trim());
      }
    }

    const types: Array<'bn_translit_en' | 'bn' | 'banglish' | 'en'> = [
      'bn_translit_en',
      'bn',
      'banglish',
      'en',
    ];

    for (const vType of types) {
      const list = variants[vType] || [];
      for (const variant of list) {
        if (!variant || variant.trim().length === 0) continue;
        const trimmed = variant.trim();
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Unicode word boundary pattern for matching words/phrases
        // (?:^|[^\p{L}\p{N}])pattern(?=[^\p{L}\p{N}]|$)
        const regex = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escaped})(?=[^\\p{L}\\p{N}]|$)`, 'giu');

        compiled.push({
          canonicalEn: item.canonical_en,
          category: item.category,
          variant: trimmed,
          variantType: vType,
          regex,
          length: trimmed.length,
        });
      }
    }
  }

  // Sort descending by variant length so longer multi-word expressions take precedence
  compiled.sort((a, b) => b.length - a.length);
  COMPILED_TERMS = compiled;
}

// Auto-initialize on module load
try {
  initTermMatcher();
} catch {}

/**
 * Finds all clinical term matches in text.
 */
export function matchTerms(text: string): MatchedTerm[] {
  if (!text || !text.trim()) return [];
  if (COMPILED_TERMS.length === 0) {
    initTermMatcher();
  }

  const matches: MatchedTerm[] = [];
  const occupiedRanges: Array<[number, number]> = [];

  const isOverlapping = (start: number, end: number) => {
    return occupiedRanges.some(([s, e]) => Math.max(s, start) < Math.min(e, end));
  };

  for (const entry of COMPILED_TERMS) {
    entry.regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = entry.regex.exec(text)) !== null) {
      // match[1] is the captured term
      const matchedString = match[1];
      const matchIndex = match.index + (match[0].indexOf(matchedString));
      const matchEnd = matchIndex + matchedString.length;

      if (!isOverlapping(matchIndex, matchEnd)) {
        occupiedRanges.push([matchIndex, matchEnd]);
        matches.push({
          canonicalEn: entry.canonicalEn,
          category: entry.category,
          matchedVariant: entry.variant,
          variantType: entry.variantType,
          start: matchIndex,
          end: matchEnd,
          rawText: matchedString,
        });
      }
    }
  }

  // Sort matches by position in the text
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

/**
 * Canonicalizes text: replaces matched Bengali, Banglish, or transliterated terms
 * with canonical English terms.
 */
export function canonicalizeTerms(text: string): {
  canonicalText: string;
  matchedTerms: MatchedTerm[];
} {
  const matches = matchTerms(text);
  if (matches.length === 0) {
    return { canonicalText: text, matchedTerms: [] };
  }

  let result = '';
  let lastIndex = 0;

  for (const m of matches) {
    result += text.slice(lastIndex, m.start);
    result += m.canonicalEn;
    lastIndex = m.end;
  }
  result += text.slice(lastIndex);

  return {
    canonicalText: result,
    matchedTerms: matches,
  };
}

/**
 * Restores English clinical terms from browser STT phonetic transliterations
 * (e.g. 'ফিভার' -> 'fever', 'অ্যামোক্সিসিলিন' -> 'amoxicillin').
 */
export function restoreTransliteratedTerms(text: string): string {
  const matches = matchTerms(text).filter(
    (m) => m.variantType === 'bn_translit_en' || TRANSLIT_VARIANTS.has(m.matchedVariant)
  );
  if (matches.length === 0) return text;

  let result = '';
  let lastIndex = 0;

  for (const m of matches) {
    result += text.slice(lastIndex, m.start);
    result += m.canonicalEn;
    lastIndex = m.end;
  }
  result += text.slice(lastIndex);

  return result;
}
