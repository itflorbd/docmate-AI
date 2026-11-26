import type { VerifiedClaim, Chunk } from '@/types';

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function verifyQuoteInChunk(quote: string, chunkText: string): boolean {
  const normalized = normalizeText(quote);
  return normalized.length > 0 && normalizeText(chunkText).includes(normalized);
}

export interface ClaimCandidate {
  claim_text?: string;
  text?: string;
  chunk_id: string;
  quote: string;
}

export function verifyClaims(
  claims: ClaimCandidate[],
  chunksMap: Map<string, Chunk>,
) {
  const verifiedClaims: VerifiedClaim[] = [];
  const unverifiedClaims: Array<ClaimCandidate & { reason: string }> = [];

  for (const claim of claims) {
    const chunk = chunksMap.get(claim.chunk_id);
    const quote = claim.quote?.trim() || '';

    if (!chunk) {
      unverifiedClaims.push({ ...claim, reason: 'chunk_not_found' });
      continue;
    }

    if (!quote || !verifyQuoteInChunk(quote, chunk.text)) {
      unverifiedClaims.push({ ...claim, reason: 'quote_not_in_chunk' });
      continue;
    }

    const claimText = (claim.claim_text || claim.text || quote).trim();
    if (!claimText) {
      unverifiedClaims.push({ ...claim, reason: 'empty_claim_text' });
      continue;
    }

    verifiedClaims.push({
      claim_text: claimText,
      text: claimText,
      quote: quote,
      chunk_id: chunk.id,
      source_title: chunk.source_title,
      source_year: chunk.source_year,
      page: chunk.page,
      verified: true,
      verification_status: 'verified',
    });
  }

  const droppedClaimsCount = claims.length - verifiedClaims.length;
  return {
    verifiedClaims,
    unverifiedClaims,
    droppedClaimsCount,
    allVerified: droppedClaimsCount === 0 && verifiedClaims.length > 0,
  };
}
