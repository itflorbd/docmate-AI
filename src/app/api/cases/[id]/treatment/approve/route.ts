import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { cases } from '@/db/schema';
import { boundedJson } from '@/lib/api-input';
import { recordAuditLog } from '@/lib/audit';
import { validCaseId } from '@/lib/case-access';
import { clinicalGate } from '@/lib/clinical-release';
import { evaluatePrescriptionSafety, type SafetyOverride } from '@/lib/prescription-safety';
import { safetyContextFromCase } from '@/lib/treatment-draft';
import { buildCaseDraft, conflictReviews, EVENT_APPROVED, loadFormulary, requireTreatingDoctor } from '@/lib/treatment-draft-server';
import type { StructuredPatientInput } from '@/types';

const bodySchema = z
  .object({
    approved_drug_ids: z.array(z.uuid()).min(1).max(10),
    // The record version the doctor reviewed. A mismatch means the record changed.
    case_version: z.string().length(64),
    overrides: z.array(z.object({ alert_id: z.string().min(1).max(200), reason: z.string().trim().min(10).max(500) })).max(20).default([]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

/**
 * The doctor approves some or all draft options. The server rebuilds the draft,
 * checks the selection is still proposed for the current record, and runs the
 * safety decision on the combined regimen before recording the approval.
 * Approval is not an official prescription.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTreatingDoctor();
    if (user instanceof NextResponse) return user;
    if (!clinicalGate().treatmentDrafts) return NextResponse.json({ error: 'Treatment drafts are switched off.', code: 'release_gate' }, { status: 423 });
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const body = bodySchema.safeParse(await boundedJson(request, 16_384));
    if (!body.success) return NextResponse.json({ error: 'Choose at least one medicine.' }, { status: 400 });

    const built = await buildCaseDraft(id, user.id);
    if (!built) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (built === 'reconciliation_required') {
      return NextResponse.json({ error: 'Review what was carried forward from the earlier visit first.', code: 'reconciliation_required' }, { status: 409 });
    }
    if (built === 'no_diagnosis') return NextResponse.json({ error: 'Confirm a working diagnosis first.', code: 'diagnosis_required' }, { status: 409 });
    if (built.caseVersion !== body.data.case_version) {
      return NextResponse.json({ error: 'The patient record changed. Review the new draft.', code: 'stale_review' }, { status: 409 });
    }
    if (built.draft.status !== 'proposed') {
      return NextResponse.json({ error: 'There is no treatment draft to approve.', code: built.draft.status, draft: built.draft }, { status: 409 });
    }

    const selected = built.draft.options.filter((option) => body.data.approved_drug_ids.includes(option.drug_id));
    if (selected.length !== new Set(body.data.approved_drug_ids).size) {
      return NextResponse.json({ error: 'A chosen medicine is not in the current draft.', code: 'not_in_draft' }, { status: 422 });
    }

    // A medicine the guidelines disagree about needs the doctor's recorded reasoning
    // for this exact record and evidence. It is never approved by default.
    const disputed = selected.filter((option) => option.dispute);
    if (disputed.length) {
      const reviews = await conflictReviews(id, built.caseVersion);
      const unreviewed = disputed.filter((option) => {
        const review = reviews[option.dispute!.key];
        return !review || !review.current || review.decision !== 'use_recommendation';
      });
      if (unreviewed.length) {
        await recordAuditLog({
          userId: user.id,
          caseId: id,
          event: 'TREATMENT_APPROVAL_BLOCKED',
          payload: { reason: 'guideline_conflict', drug_ids: unreviewed.map((option) => option.drug_id), conflict_keys: unreviewed.map((option) => option.dispute!.key) },
        });
        return NextResponse.json(
          {
            error: 'The guidelines disagree about this medicine. Review both passages and record your reasoning first.',
            code: 'guideline_conflict',
            drug_ids: unreviewed.map((option) => option.drug_id),
          },
          { status: 422 },
        );
      }
    }

    // Safety of the combined regimen, with overrides bound to this exact review.
    const { formulary, interactions } = await loadFormulary();
    const context = safetyContextFromCase(built.record.structuredInput as StructuredPatientInput);
    const items = selected.map((option) => ({
      genericName: option.generic_name,
      strength: option.dose_text,
      form: option.route,
      dosingSchedule: option.frequency,
      durationDays: option.duration_days,
    }));
    const first = evaluatePrescriptionSafety({ context, items, formulary, interactions });
    const overrides: SafetyOverride[] = body.data.overrides.map((entry) => ({
      alertId: entry.alert_id,
      reason: entry.reason,
      clinicianId: user.id,
      contextVersion: first.contextVersion,
      regimenHash: first.regimenHash,
      recordedAt: new Date().toISOString(),
    }));
    const decision = evaluatePrescriptionSafety({ context, items, formulary, interactions, overrides });
    if (!decision.safeToFinalize) {
      return NextResponse.json(
        {
          error: decision.status === 'blocked' ? 'Safety stop. Remove the blocked medicine.' : 'Give a reason for each critical alert.',
          code: decision.status,
          safety: decision,
        },
        { status: 422 },
      );
    }

    const approval = {
      diagnosis: built.draft.diagnosis,
      case_version: built.caseVersion,
      regimen_hash: decision.regimenHash,
      context_version: decision.contextVersion,
      note: body.data.note ?? null,
      items: selected.map((option) => ({
        drug_id: option.drug_id,
        generic_name: option.generic_name,
        dose_text: option.dose_text,
        route: option.route,
        frequency: option.frequency,
        duration_days: option.duration_days,
        citation: option.citation,
        guideline_conflict: option.dispute ? { key: option.dispute.key, kind: option.dispute.kind } : null,
      })),
      overrides: decision.alerts.filter((alert) => alert.override).map((alert) => ({ alert_id: alert.id, title: alert.title, reason: alert.override!.reason })),
      warnings: decision.alerts.filter((alert) => alert.stop === 'none').map((alert) => alert.title),
      history_used: built.historyUsed.map((use) => ({ item_id: use.item_id, label: use.label, used_for: use.used_for, source_case_id: use.source.case_id, visit_date: use.source.visit_date })),
    };
    await recordAuditLog({ userId: user.id, caseId: id, event: EVENT_APPROVED, payload: approval });
    await db.update(cases).set({ status: 'treated', updatedAt: new Date() }).where(and(eq(cases.id, id), eq(cases.doctorId, user.id)));

    return NextResponse.json({ approval: { ...approval, approved_by: user.id, current: true }, official_issuance: clinicalGate().officialIssuance });
  } catch (err) {
    console.error('Treatment approval failed:', err);
    return NextResponse.json({ error: 'Could not save the approval.' }, { status: 500 });
  }
}
