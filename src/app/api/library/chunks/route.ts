import { requireFeaturePermission } from '@/lib/permissions';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { chunks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const auth = await requireFeaturePermission('library.browse');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('source_id');
    if (sourceId !== null && !z.uuid().safeParse(sourceId).success) {
      return NextResponse.json({ error: 'Invalid source ID' }, { status: 400 });
    }

    if (!sourceId) {
      const allChunks = await db.query.chunks.findMany({
        limit: 50,
        orderBy: [desc(chunks.createdAt)],
      });
      return NextResponse.json({ chunks: allChunks });
    }

    const sourceChunks = await db.query.chunks.findMany({
      where: eq(chunks.sourceId, sourceId),
      orderBy: [chunks.page],
    });

    return NextResponse.json({ chunks: sourceChunks });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chunks' }, { status: 500 });
  }
}
