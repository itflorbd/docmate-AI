import { describe, expect, it } from 'vitest';
import { resolvePublicationYear } from '@/lib/ingestion/pipeline';

describe('Task 5: Publication year resolution at ingestion', () => {
  it('extracts explicit publication year from document text', () => {
    const res = resolvePublicationYear({
      title: 'SYNTHETIC TEST Guideline A',
      text: 'Publisher: DocMate Test Fixtures. Publication year 2025. Version 1.',
      pdfMetadataYear: 2026,
    });
    expect(res).toEqual({ year: 2025, yearVerified: true, source: 'text' });
  });

  it('extracts parenthesized year from title when text has no explicit publication year', () => {
    const res = resolvePublicationYear({
      title: 'SYNTHETIC TEST Guideline A - Type 2 Diabetes Initial Therapy (2025)',
      text: 'Initial drug therapy for adult outpatients with type 2 diabetes mellitus.',
      pdfMetadataYear: 2026,
    });
    expect(res).toEqual({ year: 2025, yearVerified: true, source: 'title' });
  });

  it('falls back to PDF metadata year when neither text nor title gives a year', () => {
    const res = resolvePublicationYear({
      title: 'Clinical Guidance Document',
      text: 'Some clinical guidance text without a stated publication year.',
      pdfMetadataYear: 2024,
    });
    expect(res).toEqual({ year: 2024, yearVerified: true, source: 'pdf_metadata' });
  });

  it('marks yearVerified=false when no publication year is found anywhere', () => {
    const res = resolvePublicationYear({
      title: 'Undated Clinical Protocol',
      text: 'No year appears in this protocol.',
    });
    expect(res.yearVerified).toBe(false);
    expect(res.source).toBe('unverified_fallback');
    expect(res.year).toBe(new Date().getFullYear());
  });
});
