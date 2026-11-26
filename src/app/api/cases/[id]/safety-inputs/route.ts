import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cases } from '@/db/schema';
import { boundedJson } from '@/lib/api-input';
import { recordAuditLog } from '@/lib/audit';
import { validCaseId } from '@/lib/case-access';
import { safetyInputsSchema } from '@/lib/prescription-safety-server';
import { requireTreatingDoctor } from '@/lib/treatment-draft-server';
import type { StructuredPatientInput } from '@/types';

/**
 * Records safety facts the doctor asked the patient (no known allergies,
 * pregnancy status, weight, eGFR) on the case record, with an audit entry.
 * Changing the record invalidates earlier treatment approvals.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireTreatingDoctor();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  const body = safetyInputsSchema.safeParse(await boundedJson(request, 2048));
  if (!body.success || Object.keys(body.data).length === 0) return NextResponse.json({ error: 'Nothing to record.' }, { status: 400 });

  const updated = await db.transaction(async (tx) => {
    const [record] = await tx.select().from(cases).where(and(eq(cases.id, id), eq(cases.doctorId, user.id))).for('update');
    if (!record) return null;
    const input = { ...(record.structuredInput as StructuredPatientInput) };
    if (body.data.no_known_allergies && (input.allergies ?? []).length === 0) input.allergies = ['No known allergies'];
    if (typeof body.data.is_pregnant === 'boolean') input.is_pregnant = body.data.is_pregnant;
    if (body.data.weight_kg) input.weight_kg = body.data.weight_kg;
    if (body.data.egfr) input.egfr = body.data.egfr;
    if (body.data.care_setting) input.care_setting = body.data.care_setting;
    const [row] = await tx.update(cases).set({ structuredInput: input, updatedAt: new Date() }).where(eq(cases.id, id)).returning();
    return row;
  });
  if (!updated) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  await recordAuditLog({ userId: user.id, caseId: id, event: 'CASE_SAFETY_INPUTS_RECORDED', payload: { inputs: body.data } });
  return NextResponse.json({ case: { id: updated.id, structured_input: updated.structuredInput } });
}
