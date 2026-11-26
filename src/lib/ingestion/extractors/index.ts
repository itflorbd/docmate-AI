import crypto from 'crypto';
import path from 'path';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  tables?: string[];
  heading?: string;
}

export interface ExtractedDocument {
  title: string;
  authors: string[];
  year: number;
  yearVerified?: boolean;
  pdfMetadataYear?: number;
  journalOrPublisher?: string;
  doi?: string;
  pmid?: string;
  canonicalUrl?: string;
  pageCount: number;
  pages: ExtractedPage[];
  fullText: string;
  mime: string;
  sourceType: 'textbook' | 'guideline' | 'journal_article' | 'review' | 'case_report' | 'other';
  license: string;
  evidenceLevel: string;
  metadata?: Record<string, unknown>;
  isScanned?: boolean;
  ocrApplied?: boolean;
}

export interface DocumentExtractor {
  supportedMimes(): string[];
  extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument>;
}

export interface AntivirusScanner {
  scan(buffer: Buffer, fileName: string): Promise<{ clean: boolean; reason?: string }>;
}

export class NoOpAntivirusScanner implements AntivirusScanner {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async scan(_buffer: Buffer, _fileName: string): Promise<{ clean: boolean; reason?: string }> {
    return { clean: true };
  }
}

// Inspect file magic numbers to prevent extension spoofing
export function validateFileSignature(buffer: Buffer, originalName: string): { isValid: boolean; detectedMime: string; safeName: string } {
  const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  
  if (buffer.length < 4) {
    return { isValid: false, detectedMime: 'application/octet-stream', safeName };
  }

  // PDF magic: %PDF- (0x25 0x50 0x44 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { isValid: true, detectedMime: 'application/pdf', safeName };
  }

  // ZIP / DOCX magic: PK (0x50 0x4B)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
    const isDocx = safeName.toLowerCase().endsWith('.docx');
    return { isValid: true, detectedMime: isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/zip', safeName };
  }

  // Legacy DOC magic: 0xD0 0xCF 0x11 0xE0
  if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
    return { isValid: true, detectedMime: 'application/msword', safeName };
  }

  const head = buffer.subarray(0, 1024).toString('utf-8').trim().toLowerCase();

  // HTML / XML
  if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<?xml')) {
    return { isValid: true, detectedMime: 'text/html', safeName };
  }

  // JSON
  if (head.startsWith('{') || head.startsWith('[')) {
    try {
      JSON.parse(buffer.toString('utf-8'));
      return { isValid: true, detectedMime: 'application/json', safeName };
    } catch {
      // not valid json
    }
  }

  // Markdown or Plain Text (check for no excessive binary control characters)
  let nullBytes = 0;
  const sample = buffer.subarray(0, Math.min(buffer.length, 2048));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) nullBytes++;
  }

  if (nullBytes === 0) {
    const isMd = safeName.toLowerCase().endsWith('.md');
    return { isValid: true, detectedMime: isMd ? 'text/markdown' : 'text/plain', safeName };
  }

  return { isValid: false, detectedMime: 'application/octet-stream', safeName };
}

// Compute SHA256 of file buffer
export function computeBufferSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
