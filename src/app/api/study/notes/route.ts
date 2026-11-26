import { z } from 'zod';
import { requireFeaturePermission } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { studentNotes, chunks, sources } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10_000),
  tags: z.array(z.string().max(40)).max(20).optional(),
  chunkId: z.uuid().optional().nullable(),
});

export async function GET() {
  try {
    // Role check from the feature matrix (study.tools), not just sign-in.
    const auth = await requireFeaturePermission('study.tools');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const user = auth.user;

    const notes = await db
      .select({
        id: studentNotes.id,
        title: studentNotes.title,
        content: studentNotes.content,
        tags: studentNotes.tags,
        createdAt: studentNotes.createdAt,
        updatedAt: studentNotes.updatedAt,
        chunkText: chunks.text,
        chunkSection: chunks.section,
        sourceTitle: sources.title,
      })
      .from(studentNotes)
      .leftJoin(chunks, eq(studentNotes.chunkId, chunks.id))
      .leftJoin(sources, eq(chunks.sourceId, sources.id))
      .where(eq(studentNotes.userId, user.id))
      .orderBy(desc(studentNotes.updatedAt));

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Student notes fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Role check from the feature matrix (study.tools), not just sign-in.
    const auth = await requireFeaturePermission('study.tools');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const user = auth.user;

    const parsed = noteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the form and try again.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { title, content, tags, chunkId } = parsed.data;

    if (!title || !content) {
      return NextResponse.json({ error: 'শিরোনাম ও বিষয়বস্তু আবশ্যক' }, { status: 400 });
    }

    const [newNote] = await db
      .insert(studentNotes)
      .values({
        userId: user.id,
        title,
        content,
        tags: Array.isArray(tags) ? tags : [],
        chunkId: chunkId || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'স্টাডি নোট সফলভাবে সংরক্ষিত হয়েছে',
      note: newNote,
    });
  } catch (error) {
    console.error('Student note save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
