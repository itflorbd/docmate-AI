// src/lib/language/cache.ts
// DocMate AI - Language Understanding In-Memory LRU Cache

import * as crypto from 'crypto';
import { LanguageUnderstandingResult } from './types';
import { deidentifyClinicalText } from '../deidentify';

interface CacheEntry {
  result: LanguageUnderstandingResult;
  timestamp: number;
}

const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours
const cache = new Map<string, CacheEntry>();

/**
 * Computes a deterministic SHA-256 hash for de-identified text.
 */
export function hashQueryText(text: string): string {
  // Strip patient phone numbers, identifiers, and normalize whitespace
  const sanitized = deidentifyClinicalText(text.trim().toLowerCase());
  return crypto.createHash('sha256').update(sanitized).digest('hex');
}

/**
 * Retrieves cached language understanding result if present and not expired.
 */
export function getCachedUnderstanding(text: string): LanguageUnderstandingResult | null {
  const hash = hashQueryText(text);
  const entry = cache.get(hash);

  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(hash);
    return null;
  }

  // Refresh LRU position
  cache.delete(hash);
  cache.set(hash, entry);

  return {
    ...entry.result,
    cached: true,
  };
}

/**
 * Stores language understanding result into the cache.
 */
export function setCachedUnderstanding(
  text: string,
  result: LanguageUnderstandingResult
): void {
  const hash = hashQueryText(text);

  // Evict oldest if full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(hash, {
    result,
    timestamp: Date.now(),
  });
}

/**
 * Clears the language cache (useful for tests).
 */
export function clearLanguageCache(): void {
  cache.clear();
}
