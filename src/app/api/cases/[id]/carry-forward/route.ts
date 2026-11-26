import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { caseFollowUps, cases } from '@/db/schema';
import { boundedJson } from '@/lib/api-input';
import { recordAuditLog } from '@/lib/audit';
import { requirePhysician, validCaseId } from '@/lib/case-access';
import { applyReconciliation, checkReconciliation, reconciliationSchema, type CarryItem } from '@/lib/follow-up';
import { authorizePriorVisit, followUpFor } from '@/lib/follow-up-server';
import type { StructuredPatientInput } from '@/types';

/** The carry-forward record of this follow-up visit. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePhysician();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  const [record] = await db.select({ id: cases.id }).from(cases).where(and(eq(cases.id, id), eq(cases.doctorId, user.id))).limit(1);
  if (!record) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  const followUp = await followUpFor(id);
  return NextResponse.json({ follow_up: followUp ? { status: followUp.status, previous_case_id: followUp.previousCaseId, carried: followUp.carried, reconciliation: followUp.reconciliation } : null });
}

/**
 * The doctor reconciles what was carried forward: confirm or remove each
 * allergy, continue, change or stop each medicine, confirm today's working
 * diagnosis, and record today's measurements. Consent is checked again.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const body = reconciliationSchema.safeParse(await boundedJson(request, 32_768));
    if (!body.success) {
      return NextResponse.json({ error: 'Check the form: confirm today’s working diagnosis and fill the required fields.', details: body.error.flatten().fieldErrors }, { status: 400 });
    }

    const followUp = await followUpFor(id);
    if (!followUp || followUp.doctorId !== user.id) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (!(await authorizePriorVisit(user.id, followUp.previousCaseId))) {
      return NextResponse.json({ error: 'Access to the earlier visit has ended. Ask the patient to share it again.', code: 'consent_required' }, { status: 403 });
    }
    const items = (followUp.carried as { items: CarryItem[] }).items;
    const errors = checkReconciliation(items, body.data);
    if (errors.length) return NextResponse.json({ error: 'Decide on every allergy and medicine first.', code: 'reconciliation_incomplete', errors }, { status: 422 });

    const result = await db.transaction(async (tx) => {
      const [record] = await tx.select().from(cases).where(and(eq(cases.id, id), eq(cases.doctorId, user.id))).for('update');
      if (!record) return null;
      const [current] = await tx.select({ status: caseFollowUps.status }).from(caseFollowUps).where(eq(caseFollowUps.caseId, id)).for('update');
      if (current?.status === 'reconciled') return 'already' as const;
      const applied = applyReconciliation(record.structuredInput as StructuredPatientInput, items, body.data, followUp.previousCaseId);
      const [updated] = await tx
        .update(cases)
        .set({ structuredInput: applied.input, confirmedDiagnosis: applied.workingDiagnosis, status: 'confirmed', updatedAt: new Date() })
        .where(eq(cases.id, id))
        .returning();
      const reconciliation = { decisions: body.data.decisions, added_allergies: body.data.added_allergies, working_diagnosis: applied.workingDiagnosis, history_used: applied.used };
      await tx.update(caseFollowUps).set({ status: 'reconciled', reconciliation, reconciledAt: new Date() }).where(eq(caseFollowUps.caseId, id));
      return { updated, reconciliation };
    });
    if (!result) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (result === 'already') return NextResponse.json({ error: 'This visit is already reconciled.', code: 'already_reconciled' }, { status: 409 });

    await recordAuditLog({
      userId: user.id,
      caseId: id,
      event: 'FOLLOW_UP_RECONCILED',
      payload: {
        previous_case_id: followUp.previousCaseId,
        decisions: body.data.decisions,
        added_allergies: body.data.added_allergies,
        working_diagnosis: result.reconciliation.working_diagnosis,
        today_recorded: { vitals: Object.keys(body.data.today.vitals), labs: body.data.today.labs.map((lab) => lab.name), weight: Boolean(body.data.today.weight_kg) },
        history_used: result.reconciliation.history_used.map((use) => ({ item_id: use.item_id, used_for: use.used_for, source_case_id: use.source.case_id })),
      },
    });
    return NextResponse.json({ case: { id, status: result.updated.status, confirmed_diagnosis: result.updated.confirmedDiagnosis, structured_input: result.updated.structuredInput }, reconciliation: result.reconciliation });
  } catch (err) {
    console.error('Reconcile follow-up failed:', err);
    return NextResponse.json({ error: 'Could not save the reconciliation.' }, { status: 500 });
  }
}
