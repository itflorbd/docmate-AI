import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  decisionJson,
  loadPrescriptionSafety,
  recordSafetyInputs,
  requirePrescriber,
  safetyInputsSchema,
} from '@/lib/prescription-safety-server';

const bodySchema = z.object({ safety_inputs: safetyInputsSchema.optional() }).strict();

/**
 * Runs the server-side safety decision for a saved prescription draft.
 * Optional `safety_inputs` record missing patient facts (audited) first.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePrescriber();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });

    const text = await request.text();
    const body = bodySchema.safeParse(text ? JSON.parse(text) : {});
    if (!body.success) return NextResponse.json({ error: 'Invalid safety check request' }, { status: 400 });

    let loaded = await loadPrescriptionSafety(id, user.id);
    if (!loaded || loaded.rx.doctorId !== user.id) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    if (body.data.safety_inputs) {
      await recordSafetyInputs(id, user.id, loaded.caseId, body.data.safety_inputs);
      loaded = (await loadPrescriptionSafety(id, user.id))!;
    }

    return NextResponse.json({ ...decisionJson(loaded.decision, loaded.context), checked_items_count: loaded.items.length });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: 'Invalid safety check request' }, { status: 400 });
    console.error('Safety check failed:', err);
    return NextResponse.json({ error: 'Safety check failed' }, { status: 500 });
  }
}
