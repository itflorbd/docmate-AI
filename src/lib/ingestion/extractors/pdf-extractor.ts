import path from 'path';
import { pathToFileURL } from 'url';
import * as pdfParseModule from 'pdf-parse';
import { DocumentExtractor, ExtractedDocument, ExtractedPage } from './index';

/**
 * Normalizes extracted text: Unicode NFC, cleans hyphenation, collapses whitespace
 * while strictly preserving paragraph breaks (\n\n), table lines, and headings.
 */
export function normalizePdfText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    // Fix hyphenated line breaks (e.g. "pneu-\nmonia" -> "pneumonia", "কমিউনি-\nটি" -> "কমিউনিটি")
    .replace(/([\p{L}\p{N}])-[\r\n]+([\p{L}\p{N}])/gu, '$1$2')
    // Standardize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Collapse 3+ empty lines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Clean trailing/redundant spaces per line while keeping table pipes and tabs
    .split('\n')
    .map((line) => {
      // If table row with pipes, preserve alignment
      if (line.includes('|')) return line.trim();
      return line.replace(/[ \t]+/g, ' ').trim();
    })
    .join('\n')
    .trim();
}

/**
 * Extracts embedded markdown or plain-text tables from page text.
 */
function extractTablesFromText(text: string): string[] {
  const tables: string[] = [];
  const lines = text.split('\n');
  let currentTable: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      currentTable.push(line.trim());
    } else {
      if (currentTable.length >= 2) {
        tables.push(currentTable.join('\n'));
      }
      currentTable = [];
    }
  }

  if (currentTable.length >= 2) {
    tables.push(currentTable.join('\n'));
  }

  return tables;
}

function parsePdfDateYear(raw: unknown): number | undefined {
  if (!raw) return undefined;
  const str = String(raw).trim();
  // PDF Date format: D:YYYYMMDDHHmmSS... or plain 4-digit year
  const match = /^(?:D:)?((?:19|20)\d{2})/.exec(str);
  if (!match) return undefined;
  const year = Number(match[1]);
  const maxYear = new Date().getFullYear() + 1;
  return year >= 1900 && year <= maxYear ? year : undefined;
}

export class PdfExtractor implements DocumentExtractor {
  supportedMimes(): string[] {
    return ['application/pdf'];
  }

  async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
    const pageTexts: ExtractedPage[] = [];
    let title = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    let pdfMetadataYear: number | undefined;
    let fullText = '';
    let pageCount = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = pdfParseModule as any;
    const PDFParseClass = mod.PDFParse || mod.default?.PDFParse;

    if (typeof PDFParseClass === 'function') {
      try {
        const workerPath = pathToFileURL(path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
        PDFParseClass.setWorker(workerPath);
      } catch (workerErr) {
        console.warn('[PdfExtractor] Worker setup note:', workerErr);
      }

      const fontsUrl = pathToFileURL(path.resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts')).href + '/';

      try {
        const parser = new PDFParseClass({
          data: new Uint8Array(buffer),
          standardFontDataUrl: fontsUrl,
        });

        try {
          const infoResult = await parser.getInfo().catch(() => null);
          if (infoResult?.info?.Title && String(infoResult.info.Title).trim().length > 2) {
            title = String(infoResult.info.Title).trim();
          }
          pdfMetadataYear =
            parsePdfDateYear(infoResult?.info?.PublicationYear) ??
            parsePdfDateYear(infoResult?.info?.CreationDate) ??
            parsePdfDateYear(infoResult?.info?.ModDate);

          const textResult = await parser.getText().catch((err: unknown) => {
            console.warn('[PdfExtractor] getText error:', err);
            return null;
          });

          if (textResult) {
            if (Array.isArray(textResult.pages) && textResult.pages.length > 0) {
              for (const p of textResult.pages) {
                const rawText = (p.text || '').trim();
                const normalized = normalizePdfText(rawText);
                const tables = extractTablesFromText(normalized);

                // Detect heading on page
                let heading: string | undefined;
                const firstHeadingMatch = normalized.match(
                  /^(?:#{1,4}\s+|Section\s+\d+:?|Chapter\s+\d+:?|অধ্যায়\s+[১-৯\d]+:?|[0-9১-৯]+(?:\.[0-9১-৯]+)*\s+[A-Za-z\u0980-\u09FF]{3,50})/m
                );
                if (firstHeadingMatch) {
                  heading = firstHeadingMatch[0].replace(/^#+\s*/, '').trim();
                }

                if (normalized) {
                  pageTexts.push({
                    pageNumber: p.num || pageTexts.length + 1,
                    text: normalized,
                    tables: tables.length > 0 ? tables : undefined,
                    heading,
                  });
                }
              }
            }

            pageCount = textResult.total || (pageTexts.length > 0 ? pageTexts.length : 1);
            fullText = textResult.text || pageTexts.map((p) => p.text).join('\n\n');
          }
        } finally {
          await parser.destroy().catch(() => {});
        }
      } catch (err) {
        console.warn('[PdfExtractor] PDFParseClass initialization error:', err);
      }
    }

    // If PDFParseClass did not yield any text or was not available, try legacy function
    if (!fullText.trim()) {
      const parseFn = typeof mod === 'function' ? mod : mod.default;
      if (typeof parseFn === 'function') {
        try {
          const data = await parseFn(buffer);
          pageCount = data.numpages || pageCount || 1;
          fullText = normalizePdfText(data.text || '');
          if (data.info?.Title && data.info.Title.trim().length > 2 && !title) {
            title = data.info.Title.trim();
          }
          const rawPages = fullText.split(/\x0C/);
          if (rawPages.length > 1) {
            rawPages.forEach((txt: string, idx: number) => {
              const clean = normalizePdfText(txt);
              if (clean) {
                pageTexts.push({
                  pageNumber: idx + 1,
                  text: clean,
                });
              }
            });
          }
        } catch {
          // ignore fallback error
        }
      }
    }

    if (!fullText && pageTexts.length > 0) {
      fullText = pageTexts.map((p) => p.text).join('\n\n');
    }

    fullText = normalizePdfText(fullText);

    const totalCleanChars = fullText.trim().length;
    const avgCharsPerPage = pageCount > 0 ? totalCleanChars / pageCount : 0;
    // A PDF is considered scanned if it has >= 1 pages but under 40 chars/page on average
    const isScanned = pageCount >= 1 && (totalCleanChars < 50 || avgCharsPerPage < 40);

    return {
      title,
      authors: [],
      year: pdfMetadataYear ?? new Date().getFullYear(),
      yearVerified: pdfMetadataYear !== undefined,
      pdfMetadataYear,
      pageCount: pageTexts.length > 0 ? pageTexts.length : pageCount,
      pages: pageTexts.length > 0 ? pageTexts : [{ pageNumber: 1, text: fullText }],
      fullText,
      mime: 'application/pdf',
      sourceType: 'guideline',
      license: 'Open Access / Academic Use',
      evidenceLevel: 'Ia',
      isScanned,
    };
  }
}
