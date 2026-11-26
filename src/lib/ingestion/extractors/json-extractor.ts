import { z } from 'zod';
import { DocumentExtractor, ExtractedDocument, ExtractedPage } from './index';

// Shape A: Article List Item
export const articleItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  authors: z.union([z.array(z.string()), z.string()]).optional().transform((val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  }),
  year: z.union([z.number(), z.string()]).optional().transform((val) => {
    const y = Number(val);
    return isNaN(y) ? new Date().getFullYear() : y;
  }),
  doi: z.string().optional(),
  journal: z.string().optional(),
  url: z.string().optional(),
  license: z.string().optional().default('Open Access / Academic Use'),
  language: z.enum(['bn', 'en', 'mixed']).optional().default('en'),
  abstract: z.string().optional(),
  full_text: z.string().optional(),
});

// Shape B: Book / Guideline
export const bookSectionSchema = z.object({
  heading: z.string().default('Section'),
  page: z.number().int().positive().default(1),
  text: z.string().min(1, 'Section text is required'),
});

export const bookDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  authors: z.union([z.array(z.string()), z.string()]).optional().transform((val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  }),
  year: z.union([z.number(), z.string()]).optional().transform((val) => {
    const y = Number(val);
    return isNaN(y) ? new Date().getFullYear() : y;
  }),
  publisher: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  license: z.string().optional().default('Open Access / Academic Use'),
  evidence_level: z.string().optional().default('Ia'),
  sections: z.array(bookSectionSchema).min(1, 'At least one section is required'),
});

export function isMedicineData(json: unknown): boolean {
  const sample = Array.isArray(json) ? json[0] : json;
  if (!sample || typeof sample !== 'object') return false;
  const keys = Object.keys(sample).map((k) => k.toLowerCase());
  return (
    keys.includes('generic_name') ||
    keys.includes('genericname') ||
    keys.includes('brand_name') ||
    keys.includes('brandname') ||
    keys.includes('dosage_form') ||
    keys.includes('dose_text') ||
    keys.includes('dgda_reg_num') ||
    keys.includes('doses') ||
    keys.includes('interactions')
  );
}

export class JsonExtractor implements DocumentExtractor {
  supportedMimes(): string[] {
    return ['application/json'];
  }

  async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(buffer.toString('utf-8'));
    } catch (e: unknown) {
      throw new Error(`Invalid JSON syntax in ${fileName}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    if (isMedicineData(parsed)) {
      throw new Error(
        'Medicine data (brands, doses, interactions) is NOT a clinical library source. Please import medicine JSON files into the DGDA Formulary Controller at /controller.'
      );
    }

    // Try Shape B: Book with sections
    const bookCheck = bookDocumentSchema.safeParse(parsed);
    if (bookCheck.success) {
      const b = bookCheck.data;
      const pages: ExtractedPage[] = b.sections.map((sec, idx) => ({
        pageNumber: sec.page || idx + 1,
        text: sec.text,
        heading: sec.heading,
      }));
      const fullText = pages.map((p) => p.text).join('\n\n');

      return {
        title: b.title,
        authors: b.authors || [],
        year: b.year || new Date().getFullYear(),
        journalOrPublisher: b.publisher,
        doi: b.doi,
        canonicalUrl: b.url,
        pageCount: Math.max(...pages.map((p) => p.pageNumber), 1),
        pages,
        fullText,
        mime: 'application/json',
        sourceType: 'textbook',
        license: b.license,
        evidenceLevel: b.evidence_level,
      };
    }

    // Try single article / guideline object
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const text = (obj.full_text || obj.content || obj.text || obj.abstract) as string | undefined;
      if (obj.title && typeof obj.title === 'string' && text && typeof text === 'string') {
        const pages: ExtractedPage[] = [
          {
            pageNumber: 1,
            text: text.trim(),
            heading: obj.title,
          },
        ];
        return {
          title: obj.title.trim(),
          authors: Array.isArray(obj.authors)
            ? (obj.authors as string[])
            : typeof obj.authors === 'string'
              ? obj.authors.split(',').map((s) => s.trim())
              : [],
          year: typeof obj.year === 'number' ? obj.year : new Date().getFullYear(),
          journalOrPublisher: (obj.journal || obj.publisher) as string | undefined,
          doi: obj.doi as string | undefined,
          canonicalUrl: (obj.url || obj.canonicalUrl) as string | undefined,
          pageCount: 1,
          pages,
          fullText: text.trim(),
          mime: 'application/json',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sourceType: (obj.sourceType as any) || 'guideline',
          license: (obj.license as string) || 'Open Access',
          evidenceLevel: (obj.evidenceLevel as string) || 'Ia',
        };
      }
    }

    // Try Shape A: Array of Articles
    if (Array.isArray(parsed)) {
      const articleCheck = z.array(articleItemSchema).safeParse(parsed);
      if (!articleCheck.success) {
        const issues = articleCheck.error.issues.map((i) => `Row ${i.path.join('.')}: ${i.message}`).slice(0, 5).join('; ');
        throw new Error(`JSON Article List validation failed: ${issues}`);
      }

      const articles = articleCheck.data;
      if (articles.length === 0) {
        throw new Error('JSON Article List is empty.');
      }

      // If array has 1 item, return that item
      // If array has multiple items, the extractor presents the collection as a consolidated digest
      const first = articles[0];
      const pages: ExtractedPage[] = articles.map((art, idx) => ({
        pageNumber: idx + 1,
        text: [art.title, art.authors?.join(', '), art.abstract, art.full_text].filter(Boolean).join('\n\n'),
        heading: art.title,
      }));

      return {
        title: articles.length === 1 ? first.title : `${fileName.replace(/\.[^/.]+$/, '')} (${articles.length} Articles)`,
        authors: first.authors || [],
        year: first.year || new Date().getFullYear(),
        journalOrPublisher: first.journal,
        doi: first.doi,
        canonicalUrl: first.url,
        pageCount: articles.length,
        pages,
        fullText: pages.map((p) => p.text).join('\n\n---\n\n'),
        mime: 'application/json',
        sourceType: 'journal_article',
        license: first.license || 'Open Access',
        evidenceLevel: 'Ib',
      };
    }

    throw new Error(
      `JSON structure does not match standard DocMate templates (Shape A: Article List or Shape B: Book Sections). Please download the template from the JSON Import tab.`
    );
  }
}
