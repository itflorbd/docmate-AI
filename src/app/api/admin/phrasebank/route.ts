import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { phrasebankEntries, assistantFeedback } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/permissions';
import { eq, and, ilike, desc, sql, count } from 'drizzle-orm';
import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';

const patchSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(2000).optional(),
  status: z.enum(['draft', 'reviewed', 'live']).optional(),
  preset: z.enum(['reserved', 'friendly', 'all']).optional(),
});

const postSchema = z.object({
  category: z.string().min(1).max(100),
  locale: z.enum(['bn', 'en']).default('bn'),
  preset: z.enum(['reserved', 'friendly', 'all']).default('friendly'),
  text: z.string().min(1).max(2000),
  status: z.enum(['draft', 'reviewed', 'live']).default('draft'),
});

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const locale = searchParams.get('locale');
  const status = searchParams.get('status');
  const search = searchParams.get('q');
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

  try {
    const conditions = [];

    if (category && category !== 'all') {
      conditions.push(eq(phrasebankEntries.category, category));
    }
    if (locale && locale !== 'all') {
      conditions.push(eq(phrasebankEntries.locale, locale));
    }
    if (status && status !== 'all') {
      conditions.push(eq(phrasebankEntries.status, status));
    }
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(ilike(phrasebankEntries.text, pattern));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [entries, [{ total }]] = await Promise.all([
      db
        .select()
        .from(phrasebankEntries)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(phrasebankEntries.createdAt)),
      db
        .select({ total: count() })
        .from(phrasebankEntries)
        .where(whereClause),
    ]);

    // Aggregate quality metrics
    const [statusCounts] = await db
      .select({
        liveCount: sql<number>`coalesce(sum(case when ${phrasebankEntries.status} = 'live' then 1 else 0 end), 0)::int`,
        reviewedCount: sql<number>`coalesce(sum(case when ${phrasebankEntries.status} = 'reviewed' then 1 else 0 end), 0)::int`,
        draftCount: sql<number>`coalesce(sum(case when ${phrasebankEntries.status} = 'draft' then 1 else 0 end), 0)::int`,
      })
      .from(phrasebankEntries);

    // Assistant feedback ratings & negative reasons
    const feedbackRows = await db
      .select({
        rating: assistantFeedback.rating,
        reason: assistantFeedback.reason,
        count: count(),
      })
      .from(assistantFeedback)
      .groupBy(assistantFeedback.rating, assistantFeedback.reason);

    let totalFeedback = 0;
    let helpfulCount = 0;
    const negativeReasons: Record<string, number> = {
      too_long: 0,
      too_formal: 0,
      did_not_understand: 0,
      wrong_tone: 0,
      other: 0,
    };

    for (const row of feedbackRows) {
      const cnt = Number(row.count) || 0;
      totalFeedback += cnt;
      if (row.rating === 'helpful') {
        helpfulCount += cnt;
      } else if (row.reason && row.reason in negativeReasons) {
        negativeReasons[row.reason] += cnt;
      } else if (row.reason) {
        negativeReasons.other += cnt;
      }
    }

    const helpfulPct = totalFeedback > 0 ? Math.round((helpfulCount / totalFeedback) * 100) : 100;

    // Word counts across live entries
    const wordLengths = entries.map((e) => e.text.trim().split(/\s+/).length).sort((a, b) => a - b);
    const medianWords = wordLengths.length > 0 ? wordLengths[Math.floor(wordLengths.length / 2)] : 0;

    return NextResponse.json({
      entries,
      total,
      limit,
      offset,
      metrics: {
        totalFeedback,
        helpfulCount,
        helpfulPct,
        negativeReasons,
        medianWords,
        statusCounts: {
          live: statusCounts?.liveCount || 0,
          reviewed: statusCounts?.reviewedCount || 0,
          draft: statusCounts?.draftCount || 0,
        },
      },
    });
  } catch (err) {
    console.error('[Admin PhraseBank GET error]:', err);
    return NextResponse.json({ error: 'Failed to fetch phrase bank entries' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await boundedJson(request);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
    }

    const { id, ...updates } = parsed.data;

    const updateData: Record<string, unknown> = { ...updates };
    if (updates.status === 'reviewed' || updates.status === 'live') {
      updateData.reviewedBy = auth.user.id;
      updateData.reviewedAt = new Date();
    }

    const [updated] = await db
      .update(phrasebankEntries)
      .set(updateData)
      .where(eq(phrasebankEntries.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, entry: updated });
  } catch (err) {
    console.error('[Admin PhraseBank PATCH error]:', err);
    return NextResponse.json({ error: 'Failed to update phrase bank entry' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await boundedJson(request);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
    }

    const [created] = await db
      .insert(phrasebankEntries)
      .values({
        category: parsed.data.category,
        locale: parsed.data.locale,
        preset: parsed.data.preset,
        text: parsed.data.text,
        status: parsed.data.status,
        reviewedBy: parsed.data.status !== 'draft' ? auth.user.id : null,
        reviewedAt: parsed.data.status !== 'draft' ? new Date() : null,
      })
      .returning();

    return NextResponse.json({ success: true, entry: created }, { status: 201 });
  } catch (err) {
    console.error('[Admin PhraseBank POST error]:', err);
    return NextResponse.json({ error: 'Failed to create phrase bank entry' }, { status: 500 });
  }
}
