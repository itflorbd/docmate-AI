// src/lib/language/negation-parser.ts
// DocMate AI - Multi-Script Deterministic Negation Scope Parser

import { preprocessText } from './preprocessor';

export interface ClauseSpan {
  text: string;
  start: number;
  end: number;
  isAdversative: boolean;
}

export interface NegationMatch {
  marker: string;
  lang: 'bn' | 'banglish' | 'en';
  start: number;
  end: number;
  scopeStart: number;
  scopeEnd: number;
}

// Adversative conjunctions that break negation scope between clauses
export const ADVERSATIVE_CONJUNCTIONS = [
  'kintu', 'kntu', 'tobe', 'tobey', 'othoba', 'othba',
  'কিন্তু', 'তবে', 'অথচ', 'নতুবা', 'কিংবা',
  'but', 'however', 'although', 'though', 'whereas', 'yet', 'while',
  'and', 'ebong', 'এবং', 'ar', 'aar', 'আর'
];

// Negation markers across scripts
const BANGLA_NEGATION_MARKERS = [
  'নেই', 'নাই', 'না', 'নয়', 'ছাড়া', 'হীন', 'মুক্ত', 'নাইতো', 'নেইতো', 'অনুপস্থিত'
];

const BANGLISH_NEGATION_MARKERS = [
  'nai', 'nei', 'na', 'noy', 'chhara', 'chara', 'hin', 'mukto', 'nai to', 'nei to', 'nay'
];

const ENGLISH_NEGATION_MARKERS = [
  'no', 'not', 'none', 'denies', 'deny', 'denied', 'without', 'absent', 'negative', 'free of', 'ruled out'
];

/**
 * Splits input text into clauses bounded by punctuation or adversative conjunctions.
 */
export function splitClauses(text: string): ClauseSpan[] {
  if (!text || !text.trim()) return [];

  // Punctuation and adversative regex
  const regex = /([,.;!?\n]+)|(?:\b|\s+)(kintu|kntu|tobe|tobey|কিন্তু|তবে|অথচ|but|however|although|though|whereas|yet)(?:\b|\s+)/giu;

  const clauses: ClauseSpan[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const clauseText = text.slice(lastIndex, match.index).trim();
    if (clauseText) {
      clauses.push({
        text: clauseText,
        start: lastIndex,
        end: match.index,
        isAdversative: Boolean(match[2]),
      });
    }
    lastIndex = regex.lastIndex;
  }

  const trailing = text.slice(lastIndex).trim();
  if (trailing) {
    clauses.push({
      text: trailing,
      start: lastIndex,
      end: text.length,
      isAdversative: false,
    });
  }

  return clauses;
}

/**
 * Finds all negation markers in the text with their token spans.
 */
export function findNegationMarkers(text: string): NegationMatch[] {
  const prep = preprocessText(text);
  const normalized = prep.normalized;
  const matches: NegationMatch[] = [];

  const checkMarkers = (markers: string[], lang: 'bn' | 'banglish' | 'en') => {
    for (const marker of markers) {
      const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escaped})(?=[^\\p{L}\\p{N}]|$)`, 'giu');
      let m: RegExpExecArray | null;
      while ((m = regex.exec(normalized)) !== null) {
        const markerText = m[1];
        const start = m.index + m[0].indexOf(markerText);
        const end = start + markerText.length;

        // Negation scope: window of ~35 characters or ~4 words before and after within the same clause
        const scopeStart = Math.max(0, start - 35);
        const scopeEnd = Math.min(normalized.length, end + 35);

        matches.push({
          marker: markerText,
          lang,
          start,
          end,
          scopeStart,
          scopeEnd,
        });
      }
    }
  };

  checkMarkers(BANGLA_NEGATION_MARKERS, 'bn');
  checkMarkers(BANGLISH_NEGATION_MARKERS, 'banglish');
  checkMarkers(ENGLISH_NEGATION_MARKERS, 'en');

  // Sort by start index
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

/**
 * Determines whether a specific term at [termStart, termEnd] in text is negated.
 * Checks clause boundary isolation and post/pre position rules.
 */
export function isTermNegated(
  text: string,
  termStart: number,
  termEnd: number
): { isNegated: boolean; matchedMarker?: string } {
  const clauses = splitClauses(text);
  const negations = findNegationMarkers(text);

  if (negations.length === 0) {
    return { isNegated: false };
  }

  // Find the clause containing this term
  const termClause = clauses.find(
    (c) => termStart >= c.start && termEnd <= c.end
  );

  // If term belongs to a specific clause, only negations inside that clause apply
  const candidateNegations = termClause
    ? negations.filter((n) => n.start >= termClause.start && n.end <= termClause.end)
    : negations;

  for (const neg of candidateNegations) {
    // 1. Post-position negation (Bangla/Banglish style: "jor nai", "kashi nei", "কাঁপুনি নেই")
    // Term occurs BEFORE negation marker with at most a couple of small filler words between them
    if (termEnd <= neg.start && neg.start - termEnd <= 25) {
      const between = text.slice(termEnd, neg.start).trim();
      // No punctuation or adversative breaking between
      if (!/[,.;!?]|kintu|but|tobe|কিন্তু/i.test(between)) {
        return { isNegated: true, matchedMarker: neg.marker };
      }
    }

    // 2. Pre-position negation (English/Bangla style: "no fever", "denies headache", "nei kono jor", "নাই কোনো জ্বর")
    // Term occurs AFTER negation marker with at most a couple of filler words between them
    if (neg.end <= termStart && termStart - neg.end <= 25) {
      const between = text.slice(neg.end, termStart).trim();
      if (!/[,.;!?]|kintu|but|tobe|কিন্তু/i.test(between)) {
        return { isNegated: true, matchedMarker: neg.marker };
      }
    }
  }

  return { isNegated: false };
}
