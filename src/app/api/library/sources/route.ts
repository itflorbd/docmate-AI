import { requireFeaturePermission } from '@/lib/permissions';
import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sources, chunks, auditLogs } from '@/db/schema';
import { desc, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await requireFeaturePermission('library.browse');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const list = await db.query.sources.findMany({
      orderBy: [desc(sources.createdAt)],
    });

    const chunkCounts = await db
      .select({
        sourceId: chunks.sourceId,
        count: sql<number>`count(*)::int`,
      })
      .from(chunks)
      .groupBy(chunks.sourceId);

    const countMap = new Map(chunkCounts.map((c) => [c.sourceId, c.count]));

    const enriched = list.map((s) => ({
      ...s,
      chunk_count: countMap.get(s.id) || 0,
    }));

    return NextResponse.json({ sources: enriched });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin role required' }, { status: 403 });
    }

    const input = z.object({
      title: z.string().trim().min(1).max(250),
      type: z.enum(['textbook', 'guideline', 'journal', 'drug']),
      year: z.coerce.number().int().min(1800).max(new Date().getFullYear() + 1),
      license: z.string().trim().max(250).optional(),
      url: z.union([z.literal(''), z.url({ protocol: /^https?$/ }).max(2048)]).optional(),
    }).safeParse(await boundedJson(request, 8192));
    if (!input.success) return NextResponse.json({ error: 'Invalid source metadata' }, { status: 400 });

    const source = await db.transaction(async (tx) => {
      const [record] = await tx.insert(sources).values({
        ...input.data, license: input.data.license || undefined, url: input.data.url || null,
      }).returning();
      await tx.insert(auditLogs).values({
        userId: user.id, event: 'source_created', payload: { source_id: record.id },
      });
      return record;
    });
    return NextResponse.json({ source });
  } catch {
    return NextResponse.json({ error: 'Failed to add source' }, { status: 500 });
  }
}
