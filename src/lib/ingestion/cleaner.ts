import { ExtractedPage } from './extractors';

export interface CleanedPage extends ExtractedPage {
  kind: 'body' | 'table' | 'list' | 'skip' | 'references';
  language: 'bn' | 'en' | 'mixed';
}

export function detectLanguage(text: string): 'bn' | 'en' | 'mixed' {
  let bnCount = 0;
  let enCount = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0x0980 && code <= 0x09ff) {
      bnCount++;
    } else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
      enCount++;
    }
  }

  const total = bnCount + enCount;
  if (total === 0) return 'en';
  if (bnCount / total > 0.7) return 'bn';
  if (enCount / total > 0.7) return 'en';
  return 'mixed';
}

export function cleanDocumentPages(pages: ExtractedPage[]): CleanedPage[] {
  if (pages.length === 0) return [];

  // Step 1: Detect repeated header/footer lines across pages (appearing on >= 50% of pages if >= 3 pages)
  const lineFrequencies = new Map<string, number>();
  if (pages.length >= 3) {
    for (const page of pages) {
      const lines = page.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 3 && l.length < 120);
      const uniqueLinesInPage = new Set(lines);
      for (const line of uniqueLinesInPage) {
        lineFrequencies.set(line, (lineFrequencies.get(line) || 0) + 1);
      }
    }
  }

  const boilerplateThreshold = Math.ceil(pages.length * 0.5);
  const boilerplateLines = new Set<string>();
  for (const [line, count] of lineFrequencies.entries()) {
    if (count >= boilerplateThreshold) {
      boilerplateLines.add(line);
    }
  }

  let inReferences = false;

  return pages.map((page) => {
    // 1. Unicode NFC Normalization
    let text = (page.text || '').normalize('NFC');

    // 2. Remove repeated header/footer lines
    if (boilerplateLines.size > 0) {
      const filteredLines = text
        .split('\n')
        .filter((line) => !boilerplateLines.has(line.trim()));
      text = filteredLines.join('\n');
    }

    // 3. Fix hyphenation across line breaks (e.g. "pneu-\nmonia" -> "pneumonia")
    // Keeps Bangla word boundaries and danda intact
    text = text.replace(/([A-Za-z])-[\r\n]+([A-Za-z])/g, '$1$2');

    // Remove standalone page numbers on their own line (e.g. "12" or "Page 12 of 45" or "১২")
    text = text.replace(/^(\s*(?:page\s*)?[0-9০-৯]+(?:\s+of\s+[0-9০-৯]+)?\s*)$/gim, '');

    const trimmed = text.trim();

    // 4. Determine page kind
    let kind: 'body' | 'table' | 'list' | 'skip' | 'references' = 'body';

    const lower = trimmed.toLowerCase();

    // Tables have highest priority for kind
    if (page.tables && page.tables.length > 0) {
      kind = 'table';
    }
    // Blank or minimal text without tables -> skip
    else if (trimmed.length < 15) {
      kind = 'skip';
    }
    // Table of contents or Index -> skip
    else if (
      lower.startsWith('table of contents') ||
      lower.startsWith('সূচিপত্র') ||
      lower.startsWith('index') ||
      /^(contents|table of contents|সূচিপত্র)[\s\r\n]/i.test(lower)
    ) {
      kind = 'skip';
    }
    // Bibliography / References
    else if (
      lower.startsWith('references') ||
      lower.startsWith('bibliography') ||
      lower.startsWith('রেফারেন্স') ||
      lower.startsWith('তথ্যসূত্র') ||
      inReferences
    ) {
      kind = 'references';
      inReferences = true;
    }
    else if (/^\s*[-*•\d+.]\s+/m.test(trimmed)) {
      kind = 'list';
    }

    const language = detectLanguage(trimmed);

    return {
      ...page,
      text: trimmed,
      kind,
      language,
    };
  });
}
