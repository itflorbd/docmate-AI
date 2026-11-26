import crypto from 'crypto';
import { CleanedPage } from './cleaner';

export type ClinicalEntity =
  | 'guideline'
  | 'diagnosis'
  | 'treatment'
  | 'drug_info'
  | 'contraindication'
  | 'dosage'
  | 'red_flag'
  | 'follow_up'
  | 'references'
  | 'general';

export interface ChunkOutput {
  ordinal: number;
  headingPath: string;
  pageStart: number;
  pageEnd: number;
  kind: 'body' | 'table' | 'list' | 'skip' | 'references';
  clinicalEntity?: ClinicalEntity;
  text: string;
  embeddingText: string;
  contentHash: string;
  tokenCount: number;
  language: 'bn' | 'en' | 'mixed';
}

export interface ChunkOptions {
  targetTokens?: number;
  minTokens?: number;
  maxTokens?: number;
  overlapRatio?: number;
  publicationYear?: number;
}

export interface ChunkingStats {
  totalChunks: number;
  totalTokens: number;
  totalCharacters: number;
  avgTokensPerChunk: number;
  entityCounts: Record<ClinicalEntity, number>;
  languageDistribution: Record<string, number>;
}

export class InsufficientTextError extends Error {
  public readonly totalChars: number;
  public readonly pageCount: number;

  constructor(totalChars: number, pageCount: number, customMessage?: string) {
    const msg =
      customMessage ||
      `Chunking produced zero usable chunks. Document contains insufficient text (${totalChars} readable characters across ${pageCount} page(s)). DocMate AI requires machine-readable text or clear scans with OCR to generate verified clinical citations.`;
    super(msg);
    this.name = 'InsufficientTextError';
    this.totalChars = totalChars;
    this.pageCount = pageCount;
  }
}

export function estimateTokenCount(text: string): number {
  let bnCharCount = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0x0980 && code <= 0x09ff) bnCharCount++;
  }
  const otherCharCount = text.length - bnCharCount;
  // Bengali words avg 2.5 chars/token; English words avg 4 chars/token
  return Math.max(1, Math.round(bnCharCount / 2.5 + otherCharCount / 4));
}

export function computeContentHash(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Detect clinical entity category from heading and text content for enhanced vector retrieval
 */
export function detectClinicalEntity(heading: string, text: string): ClinicalEntity {
  const combined = `${heading}\n${text}`.toLowerCase();

  // 1. Red Flags & Critical Alerts (highest priority for patient safety)
  if (
    /red\s*flag|danger\s*sign|critical\s*alert|acute\s*complication|emergency|alarm\s*feature|জরুরি|বিপদচিহ্ন|সতর্কবার্তা|ঝুঁকি/i.test(
      combined
    )
  ) {
    return 'red_flag';
  }

  // 2. Contraindications & Safety Warnings
  if (
    /contraindicat|adverse\s*effect|toxicity|black\s*box|interaction|side\s*effect|hypersensitivity|নিষিদ্ধ|পার্শ্বপ্রতিক্রিয়া|সতর্কতা|বর্জনীয়/i.test(
      combined
    )
  ) {
    return 'contraindication';
  }

  // 3. Dosage References & Regimens
  if (
    /dos(?:e|age)|posology|administration|regimen|mg\/kg|mcg|i\.?v\.?|oral|frequency|titration|ডোজ|মাত্রা|প্রয়োগবিধি|সেবনবিধি/i.test(
      combined
    )
  ) {
    return 'dosage';
  }

  // 4. Clinical Guidelines & Practice Protocols
  if (/guideline|protocol|recommendation|consensus|standard\s*of\s*care|নির্দেশিকা|প্রোটোকল/i.test(combined)) {
    return 'guideline';
  }

  // 5. Drug Information & Pharmacology
  if (
    /pharmac(?:ology|odynamics|okinetics)|active\s*ingredient|mechanism\s*of\s*action|drug\s*class|ওষুধ|ঔষধ|ফার্মাকোলজি/i.test(
      combined
    )
  ) {
    return 'drug_info';
  }

  // 6. Treatment Pathways & Management
  if (
    /treatment|therapy|management|intervention|procedure|first[\s-]line|second[\s-]line|algorithmic|চিকিৎসা|ব্যবস্থাপনা|থেরাপি/i.test(
      combined
    )
  ) {
    return 'treatment';
  }

  // 7. Diagnostic Criteria & Clinical Presentation
  if (
    /diagnos(?:is|tic)|criteria|symptom|clinical\s*presentation|investigation|laboratory|differential|pathology|etiology|লক্ষণ|উপসর্গ|রোগ\s*নির্ণয়|পরীক্ষা/i.test(
      combined
    )
  ) {
    return 'diagnosis';
  }

  // 8. Follow-up & Monitoring
  if (/follow[\s-]up|monitoring|surveillance|prognosis|counseling|recovery|ফলো-?আপ|পর্যবেক্ষণ|পরামর্শ/i.test(combined)) {
    return 'follow_up';
  }

  // 9. References
  if (/reference|bibliography|citation|তথ্যসূত্র|রেফারেন্স/i.test(combined)) {
    return 'references';
  }

  return 'general';
}

// Split text into coherent sentences without cutting decimals or abbreviations
export function splitIntoSentences(text: string): string[] {
  // Matches punctuation (. ? ! or Bangla danda ।) followed by whitespace or end of line
  // Avoids splitting decimals like 3.5 or 0.25
  const rawSegments = text.split(/(?<=[.?!।])\s+/);
  const sentences: string[] = [];

  for (const seg of rawSegments) {
    const trimmed = seg.trim();
    if (trimmed.length > 0) {
      sentences.push(trimmed);
    }
  }

  return sentences.length > 0 ? sentences : [text];
}

export function structureAwareChunk(
  documentTitleOrPages: string | CleanedPage[],
  pagesOrTitle?: CleanedPage[] | string,
  targetTokensOrOptions: number | ChunkOptions = 500,
  minTokensParam = 250,
  maxTokensParam = 750,
  overlapRatioParam = 0.12
): ChunkOutput[] {
  let documentTitle = 'Document';
  let pages: CleanedPage[] = [];

  if (typeof documentTitleOrPages === 'string') {
    documentTitle = documentTitleOrPages;
    pages = (pagesOrTitle as CleanedPage[]) || [];
  } else {
    pages = documentTitleOrPages || [];
    documentTitle = typeof pagesOrTitle === 'string' ? pagesOrTitle : 'Document';
  }

  // Resolve configurable options
  let targetTokens = 500;
  let minTokens = 250;
  let maxTokens = 750;
  let overlapRatio = 0.12;
  let publicationYear: number | undefined;

  if (typeof targetTokensOrOptions === 'object' && targetTokensOrOptions !== null) {
    targetTokens = targetTokensOrOptions.targetTokens ?? 500;
    minTokens = targetTokensOrOptions.minTokens ?? 250;
    maxTokens = targetTokensOrOptions.maxTokens ?? 750;
    overlapRatio = targetTokensOrOptions.overlapRatio ?? 0.12;
    publicationYear = targetTokensOrOptions.publicationYear;
  } else if (typeof targetTokensOrOptions === 'number') {
    targetTokens = targetTokensOrOptions;
    minTokens = minTokensParam;
    maxTokens = maxTokensParam;
    overlapRatio = overlapRatioParam;
  }

  // Calculate total readable text characters across pages
  const totalReadableChars = pages.reduce((acc, p) => {
    if (p.kind === 'skip') return acc;
    const txt = (p.text || '').trim();
    const tableChars = (p.tables || []).join(' ').trim().length;
    return acc + txt.length + tableChars;
  }, 0);

  // Validate threshold: never silently succeed or return empty
  if (totalReadableChars < 30) {
    throw new InsufficientTextError(totalReadableChars, pages.length);
  }

  const result: ChunkOutput[] = [];
  const seenContentHashes = new Set<string>();
  let currentOrdinal = 1;
  let activeHeadingPath = documentTitle;

  const buildEmbeddingText = (headingPath: string, text: string, pageStart: number, pageEnd: number, entity: ClinicalEntity): string => {
    const yearStr = publicationYear ? ` (${publicationYear})` : '';
    const pageStr = pageStart === pageEnd ? `P.${pageStart}` : `Pp.${pageStart}-${pageEnd}`;
    return `[Source: "${documentTitle}"${yearStr}] [Section: ${headingPath}] [${pageStr}] [Clinical Domain: ${entity}]\n\n${text}`;
  };

  for (const page of pages) {
    if (page.kind === 'skip') {
      continue;
    }

    if (page.heading && page.heading !== 'Overview') {
      activeHeadingPath = `${documentTitle} > ${page.heading}`;
    }

    // References / Bibliography: store as single intact references chunk
    if (page.kind === 'references') {
      const hash = computeContentHash(page.text);
      if (!seenContentHashes.has(hash)) {
        seenContentHashes.add(hash);
        result.push({
          ordinal: currentOrdinal++,
          headingPath: `${activeHeadingPath} > References`,
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          kind: 'references',
          clinicalEntity: 'references',
          text: page.text,
          embeddingText: buildEmbeddingText(`${documentTitle} > References`, page.text, page.pageNumber, page.pageNumber, 'references'),
          contentHash: hash,
          tokenCount: estimateTokenCount(page.text),
          language: page.language,
        });
      }
      continue;
    }

    // Markdown tables: keep whole as table chunk
    if (page.tables && page.tables.length > 0) {
      for (const tbl of page.tables) {
        const hash = computeContentHash(tbl);
        if (!seenContentHashes.has(hash)) {
          seenContentHashes.add(hash);
          const entity = detectClinicalEntity(activeHeadingPath, tbl);
          result.push({
            ordinal: currentOrdinal++,
            headingPath: `${activeHeadingPath} > Table`,
            pageStart: page.pageNumber,
            pageEnd: page.pageNumber,
            kind: 'table',
            clinicalEntity: entity,
            text: tbl,
            embeddingText: buildEmbeddingText(`${activeHeadingPath} > Table`, tbl, page.pageNumber, page.pageNumber, entity),
            contentHash: hash,
            tokenCount: estimateTokenCount(tbl),
            language: page.language,
          });
        }
      }
    }

    // Body Text: Split into paragraphs, then sentences
    const paragraphs = (page.text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    let currentSentences: string[] = [];
    let currentTokens = 0;

    const flushChunk = () => {
      if (currentSentences.length === 0) return;
      const chunkText = currentSentences.join(' ').trim();
      if (chunkText.length < 20) {
        currentSentences = [];
        currentTokens = 0;
        return;
      }

      const hash = computeContentHash(chunkText);
      // Dedupe Level 5: Drop exact duplicate boilerplate chunks inside same document
      if (!seenContentHashes.has(hash)) {
        seenContentHashes.add(hash);
        const entity = detectClinicalEntity(activeHeadingPath, chunkText);
        result.push({
          ordinal: currentOrdinal++,
          headingPath: activeHeadingPath,
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          kind: /^\s*[-*•\d+.]\s+/m.test(chunkText) ? 'list' : 'body',
          clinicalEntity: entity,
          text: chunkText,
          embeddingText: buildEmbeddingText(activeHeadingPath, chunkText, page.pageNumber, page.pageNumber, entity),
          contentHash: hash,
          tokenCount: estimateTokenCount(chunkText),
          language: page.language,
        });
      }

      // Sentence-aligned overlap
      const overlapTokensTarget = Math.round(targetTokens * overlapRatio);
      const overlapSentences: string[] = [];
      let accumulatedOverlapTokens = 0;

      for (let i = currentSentences.length - 1; i >= 0; i--) {
        const s = currentSentences[i];
        const tCount = estimateTokenCount(s);
        if (accumulatedOverlapTokens + tCount <= overlapTokensTarget) {
          overlapSentences.unshift(s);
          accumulatedOverlapTokens += tCount;
        } else {
          break;
        }
      }

      currentSentences = overlapSentences;
      currentTokens = accumulatedOverlapTokens;
    };

    for (const para of paragraphs) {
      // Check if paragraph is a heading line (e.g. "### Chapter 2" or "Section 3:" or "Treatment Guidelines:")
      if (
        /^(#{1,4}\s+|[A-Z0-9\u09E6-\u09EF\s]{3,40}:|Section\s+\d+:|Chapter\s+\d+:|অধ্যায়\s+[১-৯\d]+:?|[0-9১-৯]+(?:\.[0-9১-৯]+)*\s+[A-Za-z\u0980-\u09FF]{3,50})/i.test(
          para
        ) &&
        para.length < 90
      ) {
        flushChunk();
        activeHeadingPath = `${documentTitle} > ${para.replace(/^#+\s*/, '')}`;
        continue;
      }

      const sentences = splitIntoSentences(para);
      for (const sentence of sentences) {
        const sentTokens = estimateTokenCount(sentence);
        if (currentTokens + sentTokens > maxTokens && currentTokens >= minTokens) {
          flushChunk();
        }
        currentSentences.push(sentence);
        currentTokens += sentTokens;
      }
    }

    flushChunk();
  }

  // Fallback: If no chunks were created through normal paragraph flushing
  // (e.g. short documents or all pages had boilerplate flags), gather all text
  if (result.length === 0) {
    const fallbackText = pages
      .map((p) => p.text.trim())
      .filter((t) => t.length > 0)
      .join('\n\n');

    if (fallbackText.length >= 30) {
      const hash = computeContentHash(fallbackText);
      const entity = detectClinicalEntity(activeHeadingPath, fallbackText);
      result.push({
        ordinal: 1,
        headingPath: documentTitle,
        pageStart: pages[0]?.pageNumber || 1,
        pageEnd: pages[pages.length - 1]?.pageNumber || 1,
        kind: 'body',
        clinicalEntity: entity,
        text: fallbackText,
        embeddingText: buildEmbeddingText(documentTitle, fallbackText, pages[0]?.pageNumber || 1, pages[pages.length - 1]?.pageNumber || 1, entity),
        contentHash: hash,
        tokenCount: estimateTokenCount(fallbackText),
        language: pages[0]?.language || 'en',
      });
    }
  }

  if (result.length === 0) {
    throw new InsufficientTextError(totalReadableChars, pages.length);
  }

  return result;
}

/**
 * Computes diagnostic statistics for created chunks
 */
export function getChunkingStats(chunks: ChunkOutput[]): ChunkingStats {
  const entityCounts: Record<ClinicalEntity, number> = {
    guideline: 0,
    diagnosis: 0,
    treatment: 0,
    drug_info: 0,
    contraindication: 0,
    dosage: 0,
    red_flag: 0,
    follow_up: 0,
    references: 0,
    general: 0,
  };

  const languageDistribution: Record<string, number> = {};
  let totalTokens = 0;
  let totalCharacters = 0;

  for (const c of chunks) {
    totalTokens += c.tokenCount;
    totalCharacters += c.text.length;
    if (c.clinicalEntity) {
      entityCounts[c.clinicalEntity] = (entityCounts[c.clinicalEntity] || 0) + 1;
    }
    languageDistribution[c.language] = (languageDistribution[c.language] || 0) + 1;
  }

  return {
    totalChunks: chunks.length,
    totalTokens,
    totalCharacters,
    avgTokensPerChunk: chunks.length > 0 ? Math.round(totalTokens / chunks.length) : 0,
    entityCounts,
    languageDistribution,
  };
}
