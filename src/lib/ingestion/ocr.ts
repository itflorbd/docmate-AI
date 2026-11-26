// src/lib/ingestion/ocr.ts
// DocMate AI - Cross-Platform Pure Node.js / WebAssembly OCR Processing Engine
// Uses pdf-parse page rendering + Tesseract.js (supports English + Bengali)

import path from 'path';
import { pathToFileURL } from 'url';
import Tesseract from 'tesseract.js';
import * as pdfParseModule from 'pdf-parse';

export interface OcrOptions {
  jobId?: string;
  maxPages?: number;
  languages?: string; // 'eng+ben' | 'eng' | 'ben'
  onProgress?: (currentPage: number, totalPages: number) => Promise<void>;
}

export interface OcrPageResult {
  pageNumber: number;
  text: string;
}

/**
 * Checks whether Tesseract OCR is available on the host system.
 * With tesseract.js bundled, OCR is available natively across Windows, Linux, and macOS.
 */
export async function isTesseractAvailable(): Promise<boolean> {
  return true;
}

/**
 * Runs OCR on a PDF buffer using in-memory PDF screenshot rendering and Tesseract.js.
 * Fully cross-platform with zero native binary or OS-specific dependencies.
 */
export async function runOcrOnPdfBuffer(
  pdfBuffer: Buffer,
  options: OcrOptions = {}
): Promise<OcrPageResult[]> {
  const results: OcrPageResult[] = [];
  const lang = options.languages || 'eng+ben';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = pdfParseModule as any;
  const PDFParseClass = mod.PDFParse || mod.default?.PDFParse;

  if (typeof PDFParseClass !== 'function') {
    throw new Error('PDFParse class not available for rendering OCR pages.');
  }

  try {
    const workerPath = pathToFileURL(path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
    PDFParseClass.setWorker(workerPath);
  } catch (workerErr) {
    console.warn('[OCR] Worker setup note:', workerErr);
  }

  const fontsUrl = pathToFileURL(path.resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts')).href + '/';

  const parser = new PDFParseClass({
    data: new Uint8Array(pdfBuffer),
    standardFontDataUrl: fontsUrl,
  });

  try {
    let totalPages = 1;
    try {
      const info = await parser.getInfo();
      if (typeof info?.total === 'number' && info.total > 0) {
        totalPages = info.total;
      } else if (Array.isArray(info?.pages) && info.pages.length > 0) {
        totalPages = info.pages.length;
      }
    } catch {
      try {
        const textRes = await parser.getText();
        totalPages = textRes?.total || (textRes?.pages ? textRes.pages.length : 1);
      } catch {
        totalPages = 1;
      }
    }

    const pagesToProcess = options.maxPages
      ? Math.min(totalPages, options.maxPages)
      : Math.min(totalPages, 50); // safety cap at 50 pages per document

    for (let p = 1; p <= pagesToProcess; p++) {
      try {
        const ss = await parser.getScreenshot({ pageNumber: p });
        if (ss && Array.isArray(ss.pages) && ss.pages[0]?.data) {
          const imgBuffer = Buffer.from(ss.pages[0].data);

          let ocrText = '';
          try {
            // Attempt primary language pair (e.g. 'eng+ben')
            const ocrRes = await Tesseract.recognize(imgBuffer, lang, {
              errorHandler: () => {},
            });
            ocrText = (ocrRes?.data?.text || '').trim();
          } catch (langErr) {
            // Fallback to English if compound language model fails to download
            console.warn(`[OCR] Failed '${lang}' for page ${p}, falling back to 'eng':`, langErr);
            const fallbackRes = await Tesseract.recognize(imgBuffer, 'eng');
            ocrText = (fallbackRes?.data?.text || '').trim();
          }

          results.push({
            pageNumber: p,
            text: ocrText,
          });
        } else {
          results.push({ pageNumber: p, text: '' });
        }
      } catch (pageErr) {
        console.warn(`[OCR] Failed to render screenshot for page ${p}:`, pageErr);
        results.push({ pageNumber: p, text: '' });
      }

      if (options.onProgress) {
        await options.onProgress(p, pagesToProcess);
      }
    }
  } finally {
    await parser.destroy().catch(() => {});
  }

  return results;
}
