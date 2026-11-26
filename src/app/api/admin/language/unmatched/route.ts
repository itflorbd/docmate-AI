// src/app/api/admin/language/unmatched/route.ts
// DocMate AI - Unmatched Terms Review Queue API

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { unmatchedTerms } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/permissions';
import { boundedJson } from '@/lib/api-input';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'reviewed', 'added', 'ignored']),
});

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const list = await db
      .select()
      .from(unmatchedTerms)
      .orderBy(desc(unmatchedTerms.count), desc(unmatchedTerms.lastSeen))
      .limit(100);

    return NextResponse.json({ unmatched: list });
  } catch (error) {
    console.error('Error fetching unmatched terms:', error);
    return NextResponse.json({ error: 'Failed to fetch unmatched terms' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await boundedJson(request);
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 });
    }

    const { id, status } = parsed.data;

    const [updated] = await db
      .update(unmatchedTerms)
      .set({ status })
      .where(eq(unmatchedTerms.id, id))
      .returning();

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error('Error updating unmatched term:', error);
    return NextResponse.json({ error: 'Failed to update term status' }, { status: 500 });
  }
}
