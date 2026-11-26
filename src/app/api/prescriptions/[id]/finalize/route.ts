import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { prescriptions } from '@/db/schema';
import { recordAuditLog } from '@/lib/audit';
import { clinicalGate, RELEASE_GATE_MESSAGE } from '@/lib/clinical-release';
import {
  decisionJson,
  loadPrescriptionSafety,
  recordOverride,
  requirePrescriber,
} from '@/lib/prescription-safety-server';

const bodySchema = z
  .object({
    // The regimen and patient context the doctor reviewed. A mismatch means the
    // prescription or the record changed after review.
    regimen_hash: z.string().length(64),
    context_version: z.string().length(64),
    overrides: z
      .array(z.object({ alert_id: z.string().min(1).max(200), reason: z.string().trim().min(10).max(500) }))
      .max(20)
      .default([]),
  })
  .strict();

/**
 * Finalizes (issues) a prescription. Order of checks:
 * prescriber, exact reviewed regimen and context, safety decision with
 * overrides, clinical release gate. Nothing is written as finalized unless all pass.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePrescriber();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });

    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ error: 'Run the safety check, then confirm the result before finalizing.' }, { status: 400 });
    }

    let loaded = await loadPrescriptionSafety(id, user.id);
    if (!loaded || loaded.rx.doctorId !== user.id) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    if (loaded.rx.status === 'finalized') return NextResponse.json({ error: 'This prescription is already final.' }, { status: 409 });

    const { decision } = loaded;
    if (decision.regimenHash !== body.data.regimen_hash || decision.contextVersion !== body.data.context_version) {
      return NextResponse.json(
        { error: 'The medicines or patient record changed. Check safety again.', code: 'stale_review', safety: decisionJson(decision, loaded.context) },
        { status: 409 },
      );
    }

    // Record requested overrides only for alerts that allow one.
    let recorded = 0;
    for (const requested of body.data.overrides) {
      const alert = decision.alerts.find((entry) => entry.id === requested.alert_id);
      if (!alert) continue;
      if (alert.stop === 'hard') {
        return NextResponse.json(
          { error: `"${alert.title}" can't be overridden.`, code: 'hard_stop', safety: decisionJson(decision, loaded.context) },
          { status: 422 },
        );
      }
      if (alert.stop !== 'override' || alert.override) continue;
      await recordOverride({ prescriptionId: id, userId: user.id, caseId: loaded.caseId, alertId: alert.id, alertTitle: alert.title, reason: requested.reason, decision });
      recorded++;
    }
    if (recorded) loaded = (await loadPrescriptionSafety(id, user.id))!;

    if (!loaded.decision.safeToFinalize) {
      await recordAuditLog({
        userId: user.id,
        caseId: loaded.caseId,
        event: 'PRESCRIPTION_FINALIZE_BLOCKED',
        payload: {
          prescription_id: id,
          status: loaded.decision.status,
          alert_ids: loaded.decision.alerts.filter((alert) => alert.stop !== 'none' && !alert.override).map((alert) => alert.id),
        },
      });
      const message = loaded.decision.status === 'blocked'
        ? 'Safety stop. This prescription can’t be finalized.'
        : 'Give a reason for each critical alert before finalizing.';
      return NextResponse.json({ error: message, code: loaded.decision.status, safety: decisionJson(loaded.decision, loaded.context) }, { status: 422 });
    }

    const gate = clinicalGate();
    if (!gate.officialIssuance) {
      await recordAuditLog({
        userId: user.id,
        caseId: loaded.caseId,
        event: 'PRESCRIPTION_FINALIZE_BLOCKED',
        payload: { prescription_id: id, status: 'release_gate_closed', regimen_hash: loaded.decision.regimenHash },
      });
      return NextResponse.json({ error: RELEASE_GATE_MESSAGE, code: 'release_gate', safety: decisionJson(loaded.decision, loaded.context) }, { status: 423 });
    }

    // Write only if the row is still the unchanged draft that was checked.
    const [updated] = await db
      .update(prescriptions)
      .set({ status: 'finalized', finalizedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(prescriptions.id, id), eq(prescriptions.status, 'draft'), eq(prescriptions.updatedAt, loaded.rx.updatedAt)))
      .returning();
    if (!updated) return NextResponse.json({ error: 'The prescription changed. Check safety again.', code: 'stale_review' }, { status: 409 });

    await recordAuditLog({
      userId: user.id,
      caseId: loaded.caseId,
      event: 'PRESCRIPTION_FINALIZED',
      payload: {
        prescription_id: id,
        rx_number: updated.rxNumber,
        regimen_hash: loaded.decision.regimenHash,
        context_version: loaded.decision.contextVersion,
        overridden_alert_ids: loaded.decision.alerts.filter((alert) => alert.override).map((alert) => alert.id),
        release_ref: gate.releaseRef,
      },
    });

    return NextResponse.json({
      success: true,
      prescription: { id: updated.id, rx_number: updated.rxNumber, status: updated.status, finalized_at: updated.finalizedAt, qr_hash: updated.qrHash },
      safety: decisionJson(loaded.decision),
    });
  } catch (err) {
    console.error('Error finalizing prescription:', err);
    return NextResponse.json({ error: 'Failed to finalize prescription' }, { status: 500 });
  }
}
