import crypto from 'crypto';

export function computeSimhash64(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) return '0000000000000000';

  const v = new Array(64).fill(0);

  for (const word of words) {
    const hash = crypto.createHash('md5').update(word).digest();
    for (let i = 0; i < 64; i++) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      const bit = (hash[byteIdx] >> bitIdx) & 1;
      if (bit === 1) {
        v[i] += 1;
      } else {
        v[i] -= 1;
      }
    }
  }

  let fingerprint = BigInt(0);
  for (let i = 0; i < 64; i++) {
    if (v[i] > 0) {
      fingerprint |= BigInt(1) << BigInt(i);
    }
  }

  return fingerprint.toString(16).padStart(16, '0');
}

export function simhashHammingDistance(hash1: string, hash2: string): number {
  let x = BigInt('0x' + hash1) ^ BigInt('0x' + hash2);
  let distance = 0;
  while (x > BigInt(0)) {
    if ((x & BigInt(1)) === BigInt(1)) {
      distance++;
    }
    x >>= BigInt(1);
  }
  return distance;
}

export function simhashSimilarity(hash1: string, hash2: string): number {
  const distance = simhashHammingDistance(hash1, hash2);
  return Math.max(0, 1 - distance / 64);
}
