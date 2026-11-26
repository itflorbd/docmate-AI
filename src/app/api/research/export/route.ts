import { z } from 'zod';
import { requireFeaturePermission } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { chunks, sources } from '@/db/schema';
import { inArray, eq } from 'drizzle-orm';

const exportSchema = z.object({ chunkIds: z.array(z.uuid()).min(1).max(500), format: z.enum(['csv', 'ris', 'bibtex']).default('csv') });

export async function POST(req: Request) {
  try {
    // Role check from the feature matrix (research.tools), not just sign-in.
    const auth = await requireFeaturePermission('research.tools');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const parsed = exportSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the form and try again.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { chunkIds, format } = parsed.data;

    if (!Array.isArray(chunkIds) || chunkIds.length === 0) {
      return NextResponse.json({ error: 'chunkIds array is required' }, { status: 400 });
    }

    const records = await db
      .select({
        chunkId: chunks.id,
        section: chunks.section,
        page: chunks.page,
        evidenceLevel: chunks.evidenceLevel,
        text: chunks.text,
        sourceTitle: sources.title,
        sourceType: sources.type,
        sourceYear: sources.year,
        sourceLicense: sources.license,
      })
      .from(chunks)
      .innerJoin(sources, eq(chunks.sourceId, sources.id))
      .where(inArray(chunks.id, chunkIds));

    if (format === 'ris') {
      const risContent = records
        .map((r) => {
          return [
            'TY  - RPRT',
            `ID  - ${r.chunkId}`,
            `TI  - ${r.sourceTitle}`,
            `SE  - ${r.section}`,
            `PY  - ${r.sourceYear}`,
            `SP  - ${r.page || 1}`,
            `N1  - Evidence Level: ${r.evidenceLevel}. License: ${r.sourceLicense}`,
            `AB  - ${r.text.replace(/\r?\n/g, ' ').slice(0, 300)}...`,
            'ER  -',
          ].join('\n');
        })
        .join('\n\n');

      return new NextResponse(risContent, {
        headers: {
          'Content-Type': 'application/x-research-info-systems; charset=utf-8',
          'Content-Disposition': 'attachment; filename="docmate_citations.ris"',
        },
      });
    }

    if (format === 'bibtex') {
      const bibtexContent = records
        .map((r, i) => {
          const citeKey = `docmate_${r.sourceYear}_${i + 1}`;
          return [
            `@misc{${citeKey},`,
            `  title = {${r.sourceTitle}},`,
            `  chapter = {${r.section}},`,
            `  year = {${r.sourceYear}},`,
            `  note = {Evidence Level: ${r.evidenceLevel}, Page: ${r.page || 1}},`,
            `  howpublished = {DocMate Medical Knowledgebase},`,
            '}',
          ].join('\n');
        })
        .join('\n\n');

      return new NextResponse(bibtexContent, {
        headers: {
          'Content-Type': 'application/x-bibtex; charset=utf-8',
          'Content-Disposition': 'attachment; filename="docmate_citations.bib"',
        },
      });
    }

    // Default: CSV format
    const header = 'chunk_id,source_title,section,year,page,evidence_level,excerpt\n';
    const csvRows = records
      .map((r) => {
        const cleanText = `"${r.text.replace(/"/g, '""').slice(0, 150)}..."`;
        const cleanTitle = `"${r.sourceTitle.replace(/"/g, '""')}"`;
        const cleanSection = `"${r.section.replace(/"/g, '""')}"`;
        return `${r.chunkId},${cleanTitle},${cleanSection},${r.sourceYear},${r.page || 1},${r.evidenceLevel},${cleanText}`;
      })
      .join('\n');

    return new NextResponse(header + csvRows, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="docmate_citations.csv"',
      },
    });
  } catch (error) {
    console.error('Research export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
