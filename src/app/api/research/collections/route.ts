import { z } from 'zod';
import { requireFeaturePermission } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { researcherCollections } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

const collectionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  items: z.array(z.unknown()).max(500).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export async function GET() {
  try {
    // Role check from the feature matrix (research.tools), not just sign-in.
    const auth = await requireFeaturePermission('research.tools');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const user = auth.user;

    const collections = await db
      .select()
      .from(researcherCollections)
      .where(eq(researcherCollections.userId, user.id))
      .orderBy(desc(researcherCollections.createdAt));

    return NextResponse.json({ collections });
  } catch (error) {
    console.error('Research collections fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Role check from the feature matrix (research.tools), not just sign-in.
    const auth = await requireFeaturePermission('research.tools');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const user = auth.user;

    const parsed = collectionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the form and try again.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { title, description, items, tags } = parsed.data;

    if (!title) {
      return NextResponse.json({ error: 'শিরোনাম আবশ্যক' }, { status: 400 });
    }

    const [newCol] = await db
      .insert(researcherCollections)
      .values({
        userId: user.id,
        title,
        description: description || null,
        items: Array.isArray(items) ? items : [],
        tags: Array.isArray(tags) ? tags : [],
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'গবেষণা সংকলন তৈরি হয়েছে',
      collection: newCol,
    });
  } catch (error) {
    console.error('Research collection create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
