import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sources, chunks } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';
import { eq, desc, count } from 'drizzle-orm';
import { z } from 'zod';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const allSources = await db
      .select({
        id: sources.id,
        title: sources.title,
        type: sources.type,
        year: sources.year,
        license: sources.license,
        url: sources.url,
        status: sources.status,
        createdAt: sources.createdAt,
      })
      .from(sources)
      .orderBy(desc(sources.createdAt));

    // Get chunk counts per source
    const chunkCounts = await db
      .select({
        sourceId: chunks.sourceId,
        count: count(),
      })
      .from(chunks)
      .groupBy(chunks.sourceId);

    const countMap = new Map(chunkCounts.map((c) => [c.sourceId, c.count]));

    const sourcesWithCounts = allSources.map((s) => ({
      ...s,
      chunkCount: countMap.get(s.id) || 0,
    }));

    return NextResponse.json({ sources: sourcesWithCounts });
  } catch (error) {
    console.error('[admin/library] Failed to fetch sources:', error);
    return NextResponse.json({ error: 'Failed to retrieve library sources' }, { status: 500 });
  }
}

const libraryActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('toggle_publish'),
    sourceId: z.string().uuid(),
    status: z.enum(['active', 'archived']),
  }),
]);

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = libraryActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const { sourceId, status } = parsed.data;

    await db
      .update(sources)
      .set({ status })
      .where(eq(sources.id, sourceId));

    await recordAuditLog({
      userId: auth.user.id,
      event: 'LIBRARY_SOURCE_STATUS_CHANGED',
      payload: {
        sourceId,
        newStatus: status,
        updatedBy: auth.user.email,
      },
    });

    return NextResponse.json({ success: true, sourceId, status });
  } catch (error) {
    console.error('[admin/library] Action failed:', error);
    return NextResponse.json({ error: 'Failed to update library source' }, { status: 500 });
  }
}
