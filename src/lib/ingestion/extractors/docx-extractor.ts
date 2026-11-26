import mammoth from 'mammoth';
import { DocumentExtractor, ExtractedDocument, ExtractedPage } from './index';

export class DocxExtractor implements DocumentExtractor {
  supportedMimes(): string[] {
    return [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
  }

  async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
    let fullText = '';
    let html = '';

    try {
      const rawResult = await mammoth.extractRawText({ buffer });
      fullText = rawResult.value || '';
    } catch (err) {
      console.warn('[DocxExtractor] mammoth.extractRawText warning:', err);
    }

    try {
      const htmlResult = await mammoth.convertToHtml({ buffer });
      html = htmlResult.value || '';
      if (!fullText && html) {
        fullText = html.replace(/<[^>]*>/g, ' ');
      }
    } catch (err) {
      console.warn('[DocxExtractor] mammoth.convertToHtml warning:', err);
    }

    // Fallback: extract plain ascii strings if mammoth failed entirely
    if (!fullText.trim()) {
      const sample = buffer.toString('utf-8').replace(/[^\x20-\x7E\t\n\r\u0980-\u09FF]/g, ' ');
      if (sample.trim().length > 50) {
        fullText = sample.trim();
      }
    }

    const title = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    // Approximate pages by ~2500 characters per page if no explicit page breaks
    const charPerPage = 2500;
    const pages: ExtractedPage[] = [];
    const totalPages = Math.max(1, Math.ceil(fullText.length / charPerPage));

    for (let p = 1; p <= totalPages; p++) {
      const slice = fullText.slice((p - 1) * charPerPage, p * charPerPage);
      if (slice.trim()) {
        pages.push({
          pageNumber: p,
          text: slice.trim(),
        });
      }
    }

    return {
      title,
      authors: [],
      year: new Date().getFullYear(),
      pageCount: totalPages,
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText.trim() }],
      fullText,
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sourceType: 'guideline',
      license: 'Open Access / Academic Use',
      evidenceLevel: 'Ia',
      metadata: { html },
    };
  }
}
