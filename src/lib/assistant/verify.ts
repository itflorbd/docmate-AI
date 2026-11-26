import { z } from 'zod';
import { verifyQuoteInChunk } from '@/lib/verifier';
import type { Excerpt } from './excerpts';
import { META_DELIMITER } from './prompt';
import type { CitedClaim } from './types';

const claimSchema = z.object({
  id: z.coerce.number().int().min(1).max(99),
  excerpt: z.string().max(300),
  quote: z.string().min(1).max(3000),
});

const metaSchema = z.object({
  status: z.enum(['answered', 'partial', 'insufficient_evidence', 'social']).catch('answered'),
  // Claims are validated one by one: a single malformed claim must not discard
  // the others. A claim whose quote was put in "excerpt" is repaired.
  claims: z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .slice(0, 20)
        .map((item) => {
          const raw = (item ?? {}) as Record<string, unknown>;
          const excerpt = typeof raw.excerpt === 'string' ? raw.excerpt : '';
          const quote = typeof raw.quote === 'string' ? raw.quote : excerpt.length > 12 ? excerpt : '';
          return claimSchema.safeParse({ id: raw.id, excerpt: quote === excerpt ? '' : excerpt, quote });
        })
        .filter((result) => result.success)
        .map((result) => result.data!),
    ),
  follow_up: z
    .object({
      question: z.string().max(500).nullish(),
      why: z.string().max(500).nullish(),
      quick_answers: z.array(z.string().max(200)).max(6).nullish(),
    })
    .nullish()
    .catch(null),
  missing_information: z.array(z.string().max(300)).max(8).catch([]),
  missing_case_data: z.array(z.string().max(300)).max(8).catch([]),
});

export type ModelMeta = z.infer<typeof metaSchema>;

export interface ParsedModelOutput {
  answer: string;
  meta: ModelMeta | null;
}

/** Splits raw model output into the answer text and the META JSON block. */
export function parseModelOutput(raw: string): ParsedModelOutput {
  const index = raw.indexOf(META_DELIMITER);
  if (index === -1) return { answer: raw.trim(), meta: null };

  const answer = raw.slice(0, index).trim();
  const jsonText = raw
    .slice(index + META_DELIMITER.length)
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const objectText = firstJsonObject(jsonText);
  if (!objectText) return { answer, meta: null };

  try {
    const parsed = metaSchema.safeParse(JSON.parse(objectText));
    return { answer, meta: parsed.success ? parsed.data : null };
  } catch {
    return { answer, meta: null };
  }
}

/**
 * Returns the first balanced {...} object, ignoring braces inside strings.
 * Models sometimes add a stray closing brace or trailing text after the JSON.
 */
export function firstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

const MARKER = /\[(\d{1,3})\]/g;
const DOSE = /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|g|gm|ml|mL|IU|units?|tabs?|tablets?|capsules?|drops?)\b(?:\s*\/\s*(?:kg|day|d|dose))?/giu;
const DIGIT = /[0-9০-৯]/u;

/** True when the text states a dose, e.g. "500 mg" or "5 mL/kg". */
export function mentionsDose(text: string): boolean {
  return new RegExp(DOSE.source, 'iu').test(text);
}
const NEGATION = /\b(?:no|not|never|without|none|neither|nor|absent|avoid|contraindicated|don't|doesn't|isn't|aren't|fails? to|failed to|failure to)\b|নেই|না(?=[\s।,.!?]|$)|নয়|নিষেধ|নিষিদ্ধ|এড়িয়ে|এড়ান/iu;
// Negations that flip what is recommended. They must agree in both directions.
const PREDICATE_NEGATION = /\b(?:not|never|avoid|avoided|contraindicated|must not|should not|don't|doesn't|isn't|aren't|fails? to|failed to|failure to)\b|নয়|নিষেধ|নিষিদ্ধ|এড়িয়ে|এড়ান|না(?=[\s।,.!?]|$)/iu;
const LIST_PREFIX = /^\s*(?:[-*•]|\d+[.)])\s+/;
const SYNTHETIC_ID_START = 500;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function splitLineIntoSentences(line: string): string[] {
  return line.split(/(?<=[.!?।](?:\s?\[\d{1,3}\])*)\s+(?!\[\d)/u).filter((part) => part.trim().length > 0);
}

function toAsciiDigits(text: string): string {
  return text.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
}

/** Lowercase, strip Markdown and punctuation; keeps letters, digits and marks. */
export function looseNormalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return looseNormalize(text).split(' ').filter((token) => token.length >= 3 || /\d/.test(token));
}

interface SourceUnit {
  excerpt: Excerpt;
  text: string; // verbatim sentence from the chunk
  normalized: string;
  tokenSet: Set<string>;
}

function sourceUnits(excerpts: Excerpt[]): SourceUnit[] {
  const units: SourceUnit[] = [];
  for (const excerpt of excerpts) {
    const sentences = excerpt.chunk.text
      .split(/(?<=[.!?।])\s+|\n+|\s(?=\d{1,2}\.\s+\p{Lu})/u)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 12);
    for (const sentence of sentences) {
      units.push({ excerpt, text: sentence, normalized: looseNormalize(sentence), tokenSet: new Set(tokens(sentence)) });
    }
  }
  return units;
}

/**
 * Finds a source sentence that supports `sentence`: either it contains the
 * sentence verbatim (ignoring case, Markdown and punctuation), or it shares at
 * least `threshold` of the sentence's words with every number and negation preserved.
 */
export function findSupport(sentence: string, units: SourceUnit[], threshold = 0.85): SourceUnit | null {
  const normalized = looseNormalize(sentence);
  if (normalized.length < 12) return null;
  const sentenceTokens = tokens(sentence);
  if (sentenceTokens.length < 3) return null;
  const numbers = sentenceTokens.filter((token) => /\d/.test(token));
  const negated = NEGATION.test(sentence);

  let best: { unit: SourceUnit; score: number } | null = null;
  for (const unit of units) {
    if (unit.normalized.includes(normalized)) return unit;
    if (numbers.some((number) => !unit.tokenSet.has(number))) continue;
    if (negated !== NEGATION.test(unit.text)) continue;
    const overlap = sentenceTokens.filter((token) => unit.tokenSet.has(token)).length / sentenceTokens.length;
    if (overlap >= threshold && (!best || overlap > best.score)) best = { unit, score: overlap };
  }
  return best?.unit ?? null;
}

/**
 * True when the quote appears verbatim (whitespace-normalized) in the chunk.
 * Quotes elided with "..." pass only when every fragment of at least 8
 * characters appears verbatim, in order.
 */
export function quoteAppearsIn(quote: string, chunkText: string): boolean {
  if (verifyQuoteInChunk(quote, chunkText)) return true;
  const fragments = quote.split(/\s*(?:\.\.\.|…)\s*/).map((fragment) => fragment.trim()).filter(Boolean);
  if (fragments.length < 2 || fragments.some((fragment) => fragment.length < 8)) return false;
  const haystack = chunkText.replace(/\s+/g, ' ');
  let position = 0;
  for (const fragment of fragments) {
    const found = haystack.indexOf(fragment.replace(/\s+/g, ' '), position);
    if (found === -1) return false;
    position = found + fragment.length;
  }
  return true;
}

function withMarker(plain: string, id: number): string {
  const trailing = plain.match(/[.!?।:]$/)?.[0] ?? '';
  const core = trailing ? plain.slice(0, -1).trimEnd() : plain;
  return `${core} [${id}]${trailing}`;
}

/**
 * True when a quote covers a (possibly shortened) sentence: at least 75% of the
 * sentence's words appear in the quote (all of them for 1-3 word bullets), with
 * every number present and the same negation. Words match on their first six
 * letters so "symptom" matches "symptoms".
 */
export function quoteCovers(quote: string, sentence: string, allowedNumbers: Set<string> = new Set()): boolean {
  // Bangla sentences are checked on their English terms, e.g. "প্যারাসিটামল (Paracetamol)".
  const bangla = /[\u0980-\u09FF]/.test(sentence);
  const words = tokens(sentence).filter((token) => !/^\d/.test(token) && (!bangla || /^[a-z]/.test(token)));
  if (words.length === 0 || (bangla && words.length < 2)) return false;
  const stems = new Set(tokens(quote).map((token) => token.slice(0, 6)));
  const present = words.filter((word) => stems.has(word.slice(0, 6))).length;
  const needed = bangla || words.length <= 3 ? words.length : Math.ceil(words.length * 0.75);
  if (present < needed) return false;
  const quoteNumbers = new Set([...numbersIn(quote), ...allowedNumbers]);
  if (!numbersIn(sentence).every((number) => quoteNumbers.has(number))) return false;
  // A negation in the sentence must come from the quote. Predicate negations
  // must agree both ways, so "is recommended" never inherits "is not
  // recommended"; qualifiers such as "without comorbidities" may be omitted.
  if (NEGATION.test(sentence) && !NEGATION.test(quote)) return false;
  return PREDICATE_NEGATION.test(sentence) === PREDICATE_NEGATION.test(quote);
}

/**
 * Numbers that carry clinical meaning. Digits inside names such as "CRB-65",
 * "PDE-5" or "12-lead" are part of the term, not a value, and are ignored.
 */
export function numbersIn(text: string): string[] {
  return (toAsciiDigits(text).replace(/\b[A-Za-z]+-\d+\b|\b\d+-(?:lead|item|point)\b/g, ' ').match(/\d+(?:[.,]\d+)*/g) ?? []);
}

export type DropReason = 'wrong_chunk' | 'altered_quote' | 'unsupported_sentence' | 'patient_value_cited_to_library';

export interface VerifiedAnswer {
  text: string;
  claims: CitedClaim[];
  droppedClaims: number;
  droppedSentences: number;
  /** Why each claim or sentence was dropped, for traces and tests. */
  rejections: { reason: DropReason; detail: string }[];
}

/**
 * Deterministic verification of a model answer (AGENTS.md rules 2, 3 and 6):
 * - every claim quote must appear verbatim (whitespace-normalized) in its excerpt;
 * - a sentence or bullet is kept when all its markers verify, or when a library
 *   sentence supports it word for word (it is then cited to that sentence);
 * - otherwise only a short list intro ending in ":" survives (or social small talk);
 * - doses and every other number survive only when they appear in the supporting quote.
 * Surviving markers are renumbered 1..n in reading order.
 */
export function verifyModelAnswer(
  answer: string,
  meta: Pick<ModelMeta, 'claims'> | null,
  excerpts: Excerpt[],
  options: {
    framingWordLimit?: number;
    maxFramingSentences?: number;
    allowUncitedProse?: boolean;
    question?: string;
    /** Patient lab values from the case record or the doctor's messages. They belong to the case, never to a library quote. */
    patientValues?: string[];
  } = {},
): VerifiedAnswer {
  const framingWordLimit = options.framingWordLimit ?? 18;
  // Numbers the doctor wrote (e.g. "a score of 3") may be repeated in the answer.
  const patientValues = new Set(options.patientValues ?? []);
  // Numbers the doctor wrote may be repeated, except patient lab values: a
  // sentence that states them is a claim about the patient, not the library.
  const allowedNumbers = new Set(numbersIn(options.question ?? '').filter((number) => !patientValues.has(number)));
  const rejections: VerifiedAnswer['rejections'] = [];
  const maxFramingSentences = options.maxFramingSentences ?? 3;
  let framingUsed = 0;
  const byRef = new Map(excerpts.map((excerpt) => [excerpt.ref.toUpperCase(), excerpt]));
  const verifiedById = new Map<number, { quote: string; excerpt: Excerpt }>();
  let droppedClaims = 0;

  const claimExcerptRef = new Map<number, string>();
  for (const claim of meta?.claims ?? []) {
    const quote = claim.quote.trim().replace(/^["“]|["”]$/g, '');
    // Models sometimes cite the excerpt header instead of its id. The quote is
    // still checked deterministically against the chunk it is attributed to.
    const refMatch = claim.excerpt.trim().toUpperCase().match(/^E\d{1,2}$/);
    const excerpt = refMatch
      ? byRef.get(refMatch[0])
      : excerpts.find((candidate) => quoteAppearsIn(quote, candidate.chunk.text));
    if (excerpt && quote.length >= 8 && quoteAppearsIn(quote, excerpt.chunk.text)) {
      verifiedById.set(claim.id, { quote: quote.replace(/\s*(?:\.\.\.|…)\s*/g, ' … '), excerpt });
      claimExcerptRef.set(claim.id, excerpt.ref.toUpperCase());
      continue;
    }
    // Near-verbatim quote: cite the real source sentence instead, so the quote
    // shown to the doctor is always the library's own wording.
    const candidates = sourceUnits(excerpt ? [excerpt] : excerpts);
    const repaired = findSupport(quote, candidates, 0.8);
    if (repaired) {
      verifiedById.set(claim.id, { quote: repaired.text, excerpt: repaired.excerpt });
      claimExcerptRef.set(claim.id, repaired.excerpt.ref.toUpperCase());
    } else {
      droppedClaims++;
      const elsewhere = excerpts.find((candidate) => candidate !== excerpt && quoteAppearsIn(quote, candidate.chunk.text));
      rejections.push(
        elsewhere
          ? { reason: 'wrong_chunk', detail: `claim ${claim.id}: quote is in ${elsewhere.ref}, not ${claim.excerpt}` }
          : { reason: 'altered_quote', detail: `claim ${claim.id}: quote not verbatim in ${claim.excerpt}: "${quote.slice(0, 120)}"` },
      );
    }
  }

  // Models sometimes write the excerpt number as the marker ("[5]" for E5).
  // Map such a marker to the verified claim from that excerpt. When that
  // excerpt has several claims, each sentence picks the one that fits it best.
  const declaredIds = new Set((meta?.claims ?? []).map((claim) => claim.id));
  const claimsByExcerptMarker = new Map<number, number[]>();
  for (const excerpt of excerpts) {
    const number = Number(excerpt.ref.slice(1));
    if (declaredIds.has(number)) continue;
    const fromExcerpt = [...claimExcerptRef.entries()].filter(([, ref]) => ref === excerpt.ref.toUpperCase());
    if (fromExcerpt.length === 1) verifiedById.set(number, verifiedById.get(fromExcerpt[0][0])!);
    else if (fromExcerpt.length > 1) claimsByExcerptMarker.set(number, fromExcerpt.map(([id]) => id));
  }

  const units = sourceUnits(excerpts);
  let nextSyntheticId = SYNTHETIC_ID_START;
  const syntheticByUnit = new Map<SourceUnit, number>();

  const citeUnit = (unit: SourceUnit): number => {
    // Reuse a model claim when its quote already covers this sentence.
    for (const [id, entry] of verifiedById) {
      if (entry.excerpt === unit.excerpt && looseNormalize(entry.quote).includes(unit.normalized)) return id;
    }
    const existing = syntheticByUnit.get(unit);
    if (existing) return existing;
    const id = nextSyntheticId++;
    verifiedById.set(id, { quote: unit.text, excerpt: unit.excerpt });
    syntheticByUnit.set(unit, id);
    return id;
  };

  const dosesSupported = (plain: string, quotes: string[]): boolean => {
    const doses = plain.match(DOSE) ?? [];
    if (!doses.every((dose) => quotes.some((quote) => looseNormalize(quote).includes(looseNormalize(dose))))) return false;
    // Every number in a cited sentence (thresholds, durations, doses) must come
    // from the quote it cites. Bangla digits are compared as ASCII.
    const quoteNumbers = new Set([...quotes.flatMap((quote) => numbersIn(quote)), ...allowedNumbers]);
    return numbersIn(plain.replace(MARKER, '')).every((number) => quoteNumbers.has(number) || quoteNumbers.has(number.replace(/,/g, '')));
  };

  // A verified quote must also be about the sentence that cites it: at least
  // 30% of the sentence's English words appear in the quote. Bangla sentences
  // are checked only when they carry three or more English terms.
  const onTopic = (plain: string, quotes: string[]): boolean => {
    const words = tokens(plain).filter((token) => /^[a-z]/.test(token)).map((token) => token.slice(0, 6));
    if (words.length < 3) return true;
    const stems = new Set(quotes.flatMap((quote) => tokens(quote).map((token) => token.slice(0, 6))));
    return words.filter((word) => stems.has(word)).length / words.length >= 0.3;
  };

  // Replaces an excerpt-number marker with the claim from that excerpt whose
  // quote holds the sentence's numbers and shares the most words with it.
  const resolveExcerptMarkers = (sentence: string): string =>
    sentence.replace(MARKER, (match, idText: string) => {
      const candidates = claimsByExcerptMarker.get(Number(idText));
      if (!candidates) return match;
      const plain = sentence.replace(MARKER, '');
      const words = tokens(plain).map((token) => token.slice(0, 6));
      let best: { id: number; score: number } | null = null;
      for (const id of candidates) {
        const quote = verifiedById.get(id)!.quote;
        if (!dosesSupported(plain, [quote])) continue;
        const stems = new Set(tokens(quote).map((token) => token.slice(0, 6)));
        const score = words.filter((word) => stems.has(word)).length;
        if (!best || score > best.score) best = { id, score };
      }
      return best ? `[${best.id}]` : match;
    });

  // Pass 1: classify every sentence. Sentences that are neither cited nor
  // supported word for word stay "pending" for pass 2.
  interface Entry {
    line: number;
    block: number;
    prefix: string;
    isListItem: boolean;
    sentence: string;
    plain: string;
    markers: number[];
    result: string | null | undefined; // string = keep, null = drop, undefined = pending
  }
  const entries: Entry[] = [];
  const lines = answer.split('\n');
  let block = 0;
  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      block++;
      return;
    }
    const prefixMatch = line.match(/^(\s*(?:[-*•]|\d+[.)])\s+|\s*#{1,3}\s+|\s*>\s*)/);
    const prefix = prefixMatch?.[0] ?? '';
    const isListItem = LIST_PREFIX.test(prefix);
    for (const rawSentence of splitLineIntoSentences(line.slice(prefix.length))) {
      const sentence = resolveExcerptMarkers(rawSentence);
      const markers = [...sentence.matchAll(MARKER)].map((match) => Number(match[1]));
      const plain = sentence.replace(MARKER, '').trim();
      let result: string | null | undefined;
      const statesPatientValue = numbersIn(plain).some((number) => patientValues.has(number));
      if (statesPatientValue) {
        rejections.push({ reason: 'patient_value_cited_to_library', detail: plain.slice(0, 160) });
        entries.push({ line: lineIndex, block, prefix, isListItem, sentence, plain, markers, result: null });
        continue;
      }
      if (markers.length > 0 && markers.every((id) => verifiedById.has(id))) {
        const quotes = markers.map((id) => verifiedById.get(id)!.quote);
        // A sentence about this patient needs a quote that covers it fully; a library
        // quote never supports a fact that only the patient record holds.
        const aboutPatient = /\bthis\s+patient\b|\bthe\s+patient['’]s\b|\bpatient['’]s\s+(?:history|record|age|weight)\b|এই\s+রোগী|রোগীর\s+(?:ইতিহাস|রেকর্ড|বয়স|ওজন)/iu.test(plain);
        const supported = aboutPatient ? quotes.some((quote) => quoteCovers(quote, plain, allowedNumbers)) : onTopic(plain, quotes);
        if (dosesSupported(plain, quotes) && supported) result = sentence;
      }
      if (result === undefined) {
        const support = findSupport(plain, units);
        if (support && dosesSupported(plain, [support.text])) result = withMarker(plain, citeUnit(support));
      }
      entries.push({ line: lineIndex, block, prefix, isListItem, sentence, plain, markers, result });
    }
  });

  // Pass 2: a pending sentence may inherit a verified citation used in the same
  // paragraph or list (models often cite only the last bullet), but only when
  // the quote itself covers the sentence: nearly all its words, every number,
  // and the same negation. Otherwise it is kept only as short framing.
  for (const entry of entries) {
    if (entry.result !== undefined) continue;
    const blockIds = new Set(
      entries
        .filter((other) => other.block === entry.block && typeof other.result === 'string')
        .flatMap((other) => [...(other.result as string).matchAll(MARKER)].map((match) => Number(match[1]))),
    );
    const candidates = [...blockIds, ...[...verifiedById.keys()].filter((id) => !blockIds.has(id))];
    const isListIntro = entry.plain.endsWith(':') && !DIGIT.test(entry.plain) && entry.markers.length === 0;
    const inherited = isListIntro ? undefined : candidates.find((id) => {
      const quote = verifiedById.get(id)?.quote;
      return quote ? quoteCovers(quote, entry.plain, allowedNumbers) && dosesSupported(entry.plain, [quote]) : false;
    });
    // The sentence's own markers already failed in pass 1, so a quote that
    // covers it is a better citation than none.
    if (inherited !== undefined) {
      entry.result = withMarker(entry.plain, inherited);
      continue;
    }
    // Otherwise try every library sentence the model was shown.
    const unit = isListIntro
      ? undefined
      : units.find((candidate) => quoteCovers(candidate.text, entry.plain, allowedNumbers) && dosesSupported(entry.plain, [candidate.text]));
    if (unit) {
      entry.result = withMarker(entry.plain, citeUnit(unit));
      continue;
    }
    // Uncited text is kept only as a short list intro ("Watch for these signs:"),
    // or as conversational text in social replies.
    const isFraming =
      entry.markers.length === 0 &&
      !entry.isListItem &&
      framingUsed < maxFramingSentences &&
      !DIGIT.test(entry.plain) &&
      wordCount(entry.plain) <= framingWordLimit &&
      (options.allowUncitedProse === true || entry.plain.endsWith(':'));
    if (isFraming) framingUsed++;
    entry.result = isFraming ? entry.sentence : null;
    if (!isFraming) rejections.push({ reason: 'unsupported_sentence', detail: entry.plain.slice(0, 160) });
  }

  let droppedSentences = 0;
  const keptLines: string[] = [];
  lines.forEach((rawLine, lineIndex) => {
    if (!rawLine.trim()) {
      keptLines.push('');
      return;
    }
    const lineEntries = entries.filter((entry) => entry.line === lineIndex);
    droppedSentences += lineEntries.filter((entry) => entry.result === null).length;
    const kept = lineEntries.filter((entry) => typeof entry.result === 'string').map((entry) => entry.result as string);
    if (kept.length > 0) keptLines.push(lineEntries[0].prefix + kept.join(' '));
  });

  // Remove dangling list headers ("Key points:" with nothing after) and extra blank lines.
  const cleaned: string[] = [];
  for (let index = 0; index < keptLines.length; index++) {
    const line = keptLines[index];
    if (line.trim().endsWith(':')) {
      const next = keptLines.slice(index + 1).find((candidate) => candidate.trim());
      if (!next || next.trim().endsWith(':')) continue;
    }
    if (!line.trim() && (!cleaned.length || !cleaned[cleaned.length - 1].trim())) continue;
    cleaned.push(line);
  }

  // Renumber markers in reading order.
  const renumber = new Map<number, number>();
  const claims: CitedClaim[] = [];
  const text = cleaned
    .join('\n')
    .trim()
    .replace(MARKER, (_match, idText: string) => {
      const id = Number(idText);
      const entry = verifiedById.get(id);
      if (!entry) return '';
      if (!renumber.has(id)) {
        const ref = claims.length + 1;
        renumber.set(id, ref);
        claims.push({
          ref,
          text: entry.quote,
          claim_text: entry.quote,
          quote: entry.quote,
          chunk_id: entry.excerpt.chunk.id,
          source_title: entry.excerpt.chunk.source_title,
          source_year: entry.excerpt.chunk.source_year,
          page: entry.excerpt.chunk.page,
          section: entry.excerpt.chunk.section,
          verified: true,
          verification_status: 'verified',
        });
      }
      return `[${renumber.get(id)}]`;
    });

  // Collapse duplicate adjacent markers, e.g. "[1] [1]".
  return { text: text.replace(/(\[\d+\])(\s*\1)+/g, '$1'), claims, droppedClaims, droppedSentences, rejections };
}
