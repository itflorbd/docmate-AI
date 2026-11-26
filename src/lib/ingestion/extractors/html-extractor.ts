import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { DocumentExtractor, ExtractedDocument, ExtractedPage } from './index';

export class HtmlExtractor implements DocumentExtractor {
  supportedMimes(): string[] {
    return ['text/html', 'application/xhtml+xml'];
  }

  async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
    const rawHtml = buffer.toString('utf-8');
    const dom = new JSDOM(rawHtml);
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    const title = article?.title?.trim() || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const authors = article?.byline ? [article.byline.trim()] : [];
    const fullText = (article?.textContent || dom.window.document.body?.textContent || '').trim();

    // Split into pages (~2500 chars per page)
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
      authors,
      year: new Date().getFullYear(),
      pageCount: totalPages,
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText }],
      fullText,
      mime: 'text/html',
      sourceType: 'journal_article',
      license: 'Open Access / Web Published',
      evidenceLevel: 'Ib',
      metadata: { siteName: article?.siteName },
    };
  }
}
