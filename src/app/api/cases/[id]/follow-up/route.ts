import { NextResponse } from 'next/server';
import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';
import { requirePhysician, validCaseId } from '@/lib/case-access';
import { previewCarryForward, startFollowUp } from '@/lib/follow-up-server';

/** What this earlier visit can carry forward, with dates and sources. Nothing is written. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePhysician();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!validCaseId(id)) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
  const preview = await previewCarryForward(user.id, id);
  if (!preview) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
  return NextResponse.json(preview);
}

const bodySchema = z.object({ request_key: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/) }).strict();

/** Starts a follow-up visit from this earlier visit. Repeating the request returns the same visit. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    const body = bodySchema.safeParse(await boundedJson(request, 1024));
    if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const result = await startFollowUp(user, id, body.data.request_key);
    if (!result) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    return NextResponse.json({ case_id: result.caseId, created: result.created }, { status: result.created ? 201 : 200 });
  } catch (err) {
    console.error('Start follow-up failed:', err);
    return NextResponse.json({ error: 'Could not start the follow-up visit.' }, { status: 500 });
  }
}
