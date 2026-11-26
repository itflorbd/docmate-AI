import { verifyClaims } from './verifier';
import type { Chunk } from '@/types';

// Read-only excerpts are never passed to an instruction-following model.
// Skip recognizable prompt directives rather than presenting them in the answer UI.
const promptDirective = /\b(?:ignore|disregard|override)\b[^.!?\n]{0,100}\b(?:instructions?|rules?|prompts?)\b/i;

export function libraryExcerpts(chunks: Chunk[]) {
  const candidates = chunks.filter((chunk) => !promptDirective.test(chunk.text)).map((chunk) => {
    const quote = chunk.text.trim();
    return { text: quote, quote, chunk_id: chunk.id };
  });
  return verifyClaims(candidates, new Map(chunks.map((chunk) => [chunk.id, chunk]))).verifiedClaims;
}
