import { requireFeaturePermission } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { chunks, sources } from '@/db/schema';
import { eq, ilike, and, gte, lte } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    // Role check from the feature matrix (research.tools), not just sign-in.
    const auth = await requireFeaturePermission('research.tools');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const evidenceLevel = searchParams.get('evidence_level');
    const sourceType = searchParams.get('source_type');
    const yearFrom = searchParams.get('year_from') ? parseInt(searchParams.get('year_from')!) : null;
    const yearTo = searchParams.get('year_to') ? parseInt(searchParams.get('year_to')!) : null;

    const conditions = [];

    if (query) {
      conditions.push(ilike(chunks.text, `%${query}%`));
    }
    if (evidenceLevel && evidenceLevel !== 'all') {
      conditions.push(eq(chunks.evidenceLevel, evidenceLevel));
    }
    if (sourceType && sourceType !== 'all') {
      conditions.push(eq(sources.type, sourceType));
    }
    if (yearFrom) {
      conditions.push(gte(sources.year, yearFrom));
    }
    if (yearTo) {
      conditions.push(lte(sources.year, yearTo));
    }

    const results = await db
      .select({
        id: chunks.id,
        section: chunks.section,
        page: chunks.page,
        evidenceLevel: chunks.evidenceLevel,
        text: chunks.text,
        sourceId: sources.id,
        sourceTitle: sources.title,
        sourceType: sources.type,
        sourceYear: sources.year,
        sourceLicense: sources.license,
      })
      .from(chunks)
      .innerJoin(sources, eq(chunks.sourceId, sources.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(50);

    return NextResponse.json({
      total: results.length,
      results,
    });
  } catch (error) {
    console.error('Research search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
