import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/audit';
import { validCaseId } from '@/lib/case-access';
import { clinicalGate, RELEASE_GATE_MESSAGE } from '@/lib/clinical-release';
import { buildCaseDraft, latestApproval, requireTreatingDoctor } from '@/lib/treatment-draft-server';

/**
 * Official issuance from a case. Requires a current clinician approval, then
 * the clinical release gate. Until release is approved this always stops at
 * the gate; no official prescription is created.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireTreatingDoctor();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  const built = await buildCaseDraft(id, user.id);
  if (!built) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  const approval = built === 'no_diagnosis' || built === 'reconciliation_required' ? null : await latestApproval(id, built.record);
  if (!approval || !approval.current) {
    return NextResponse.json({ error: 'Approve the treatment plan first. It must match the current record.', code: 'approval_required' }, { status: 409 });
  }

  if (!clinicalGate().officialIssuance) {
    await recordAuditLog({ userId: user.id, caseId: id, event: 'PRESCRIPTION_FINALIZE_BLOCKED', payload: { status: 'release_gate_closed', source: 'case' } });
    return NextResponse.json({ error: RELEASE_GATE_MESSAGE, code: 'release_gate' }, { status: 423 });
  }

  // Issuing from a case needs a linked patient record and prescription pad,
  // which belong to the coordinated release work. Use the prescription editor.
  return NextResponse.json({ error: 'Issue the prescription from the prescription editor.', code: 'not_available' }, { status: 501 });
}
