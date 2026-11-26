import type { ScoredChunk } from '@/lib/retrieval';

// Library text is untrusted. Chunks carrying recognizable prompt directives are
// never shown to the model or the doctor.
const PROMPT_DIRECTIVE =
  /\b(?:ignore|disregard|override|forget)\b[^.!?\n]{0,100}\b(?:instructions?|rules?|prompts?|system)\b/i;

export interface Excerpt {
  ref: string; // E1, E2, ...
  chunk: ScoredChunk;
}

export function selectExcerpts(hits: ScoredChunk[], limit = 6): Excerpt[] {
  return hits
    .filter((chunk) => chunk.text?.trim() && !PROMPT_DIRECTIVE.test(chunk.text))
    .slice(0, limit)
    .map((chunk, index) => ({ ref: `E${index + 1}`, chunk }));
}

const STOPWORDS = new Set(
  'what which when where with that this these those from have been were your about there their should would could into than then them they also only other such does done patient patients based clinical findings recommended according guideline guidelines'.split(
    ' ',
  ),
);

export function keyTerms(queries: string[]): string[] {
  const terms = new Set<string>();
  for (const query of queries) {
    for (const word of query.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (word.length >= 4 && !STOPWORDS.has(word)) terms.add(word.slice(0, 7));
    }
  }
  return [...terms];
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?।])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * Picks up to `max` sentences from a chunk that best match the query terms.
 * Sentences are returned verbatim and in source order so each one verifies as a quote.
 */
export function bestSentences(text: string, terms: string[], max = 2): string[] {
  const sentences = splitSentences(text).filter((sentence) => sentence.length >= 25 && sentence.length <= 600);
  if (sentences.length === 0) return [];
  const scored = sentences.map((sentence, index) => {
    const lower = sentence.toLowerCase();
    const score = terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
    return { sentence, index, score };
  });
  // Without a model, a sentence is quoted only when it shares at least two key
  // terms with the question (one for very short questions). Otherwise the chunk
  // is skipped and the reply abstains rather than quoting loosely related text.
  const minimum = terms.length >= 3 ? 2 : 1;
  const top = [...scored].sort((a, b) => b.score - a.score || a.index - b.index).slice(0, max);
  return top.filter((entry) => entry.score >= minimum).sort((a, b) => a.index - b.index).map((entry) => entry.sentence);
}
