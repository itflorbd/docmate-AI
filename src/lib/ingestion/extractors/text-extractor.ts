import { DocumentExtractor, ExtractedDocument, ExtractedPage } from './index';

export class TextExtractor implements DocumentExtractor {
  supportedMimes(): string[] {
    return ['text/plain', 'text/markdown'];
  }

  async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
    const content = buffer.toString('utf-8');
    const lines = content.split('\n');

    let title = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    let year = new Date().getFullYear();
    let evidenceLevel = 'Ia';
    let license = 'Open Access / Academic Demo Material';
    let authors: string[] = [];

    const pages: ExtractedPage[] = [];
    let currentPage = 1;
    let currentLines: string[] = [];
    let currentHeading = 'Overview';

    for (const line of lines) {
      if (line.startsWith('**Source Title**:')) {
        title = line.replace('**Source Title**:', '').trim();
      } else if (line.startsWith('**Publication Year**:')) {
        const y = parseInt(line.replace('**Publication Year**:', '').trim(), 10);
        if (!isNaN(y)) year = y;
      } else if (line.startsWith('**Authors**:')) {
        authors = line.replace('**Authors**:', '').split(',').map((a) => a.trim()).filter(Boolean);
      } else if (line.startsWith('**Evidence Level**:')) {
        evidenceLevel = line.replace('**Evidence Level**:', '').trim();
      } else if (line.startsWith('**License**:')) {
        license = line.replace('**License**:', '').trim();
      } else if (line.startsWith('### Section') || line.startsWith('## Section') || line.startsWith('### ') || line.startsWith('## ')) {
        if (currentLines.length > 0) {
          pages.push({
            pageNumber: currentPage,
            text: currentLines.join('\n').trim(),
            heading: currentHeading,
          });
          currentLines = [];
          currentPage++;
        }
        currentHeading = line.replace(/^#+\s*/, '').trim();
      } else if (line.trim() === '---' || line.trim() === '<!-- pagebreak -->') {
        if (currentLines.length > 0) {
          pages.push({
            pageNumber: currentPage,
            text: currentLines.join('\n').trim(),
            heading: currentHeading,
          });
          currentLines = [];
          currentPage++;
        }
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      pages.push({
        pageNumber: currentPage,
        text: currentLines.join('\n').trim(),
        heading: currentHeading,
      });
    }

    const fullText = content.trim();

    return {
      title,
      authors,
      year,
      pageCount: pages.length || 1,
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText }],
      fullText,
      mime: fileName.endsWith('.md') ? 'text/markdown' : 'text/plain',
      sourceType: 'guideline',
      license,
      evidenceLevel,
    };
  }
}
