import { NextResponse } from 'next/server';
import { db } from '@/db';
import { assistantFeedback, caseTurns, cases } from '@/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';

const feedbackSchema = z.object({
  message_id: z.string().min(1).max(100),
  rating: z.enum(['helpful', 'unhelpful']),
  reason: z.enum(['too_long', 'too_formal', 'did_not_understand', 'wrong_tone', 'other']).optional(),
  preset: z.string().max(50).default('friendly'),
  locale: z.string().max(10).default('bn'),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = await boundedJson(request);
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid feedback submission' }, { status: 400 });
    }

    const { message_id, rating, reason, preset, locale } = parsed.data;

    await db.insert(assistantFeedback).values({
      messageId: message_id,
      userId: user?.id || null,
      rating,
      reason: reason || null,
      preset,
      locale,
    });

    // Remember the rating on the case turn itself so it survives a reload.
    // Only turns from cases owned by the current doctor are updated.
    if (user && z.uuid().safeParse(message_id).success) {
      await db
        .update(caseTurns)
        .set({ content: sql`${caseTurns.content} || ${JSON.stringify({ feedback: rating })}::jsonb` })
        .where(
          and(
            eq(caseTurns.id, message_id),
            inArray(caseTurns.caseId, db.select({ id: cases.id }).from(cases).where(eq(cases.doctorId, user.id))),
          ),
        );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Assistant Feedback POST error]:', err);
    return NextResponse.json({ error: 'Failed to record feedback' }, { status: 500 });
  }
}
