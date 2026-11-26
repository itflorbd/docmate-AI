/**
 * In-memory & local cache for synthesized speech audio
 * Keyed by SHA-256 of text + locale + voiceGender + rate
 */

class AudioPhraseCache {
  private memoryCache = new Map<string, string>(); // hash -> audioBlobUrl/audioDataUri

  private async computeHash(text: string, locale: string, voice: string, rate: number): Promise<string> {
    const raw = `${text.trim()}::${locale}::${voice}::${rate.toFixed(2)}`;
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const buffer = new TextEncoder().encode(raw);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    // Simple deterministic string hash fallback
    let h = 0;
    for (let i = 0; i < raw.length; i++) {
      h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
    }
    return `hash-${h}`;
  }

  public async get(text: string, locale: string, voice = 'female', rate = 1.0): Promise<string | null> {
    const key = await this.computeHash(text, locale, voice, rate);
    return this.memoryCache.get(key) || null;
  }

  public async set(text: string, locale: string, audioUri: string, voice = 'female', rate = 1.0): Promise<void> {
    const key = await this.computeHash(text, locale, voice, rate);
    // Limit memory cache size to 100 entries
    if (this.memoryCache.size >= 100) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, audioUri);
  }

  public clear(): void {
    this.memoryCache.clear();
  }
}

export const audioCache = new AudioPhraseCache();

export async function getAudioCacheKey(text: string, voice = 'female', rate = 1.0, locale = 'bn'): Promise<string> {
  const raw = `${text.trim()}::${locale}::${voice}::${rate.toFixed(2)}`;
  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    const buffer = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return `hash-${h}`;
}

const memoryAudioStore = new Map<string, Uint8Array | string>();

export function cacheSpeechAudio(key: string, data: Uint8Array | string): void {
  if (memoryAudioStore.size >= 100) {
    const firstKey = memoryAudioStore.keys().next().value;
    if (firstKey) memoryAudioStore.delete(firstKey);
  }
  memoryAudioStore.set(key, data);
}

export function getCachedSpeechAudio(key: string): Uint8Array | string | null {
  return memoryAudioStore.get(key) || null;
}
