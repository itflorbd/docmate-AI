export interface FlaggedChunk {
  ordinal: number;
  reason: string;
  excerpt: string;
  flaggedPhrase?: string;
}

export type SafetyScanResult = FlaggedChunk[] & {
  hasPromptInjection: boolean;
  flaggedChunks: FlaggedChunk[];
};

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt\s*:/i,
  /you\s+are\s+now\s+(an\s+ai|chatgpt|dan|unrestricted)/i,
  /disregard\s+(all\s+)?guidelines/i,
  /forget\s+everything\s+(you\s+know|above)/i,
  /bypass\s+safety\s+filter/i,
  /jailbreak/i,
];

export function scanChunksForPromptInjection(
  chunks: { ordinal: number; text: string }[]
): SafetyScanResult {
  const flaggedChunks: FlaggedChunk[] = [];

  for (const chunk of chunks) {
    for (const pattern of INJECTION_PATTERNS) {
      const match = chunk.text.match(pattern);
      if (match) {
        flaggedChunks.push({
          ordinal: chunk.ordinal,
          reason: `Suspicious prompt injection phrase detected matching pattern: ${pattern}`,
          excerpt: chunk.text.slice(0, 150),
          flaggedPhrase: match[0],
        });
        break;
      }
    }
  }

  const result = Object.assign([...flaggedChunks], {
    hasPromptInjection: flaggedChunks.length > 0,
    flaggedChunks,
  }) as SafetyScanResult;

  return result;
}
