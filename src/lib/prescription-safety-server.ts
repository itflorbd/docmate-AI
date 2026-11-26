// Loads the latest patient context for a prescription and returns the one
// server-side safety decision. Every prescription route calls this module;
// nothing trusts a safety result computed in the browser.

import { and, desc, eq, gt, isNull, ne, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import {
  accessGrants,
  auditLogs,
  cases,
  drugInteractions,
  drugs,
  encounters,
  medicineNotices,
  patients,
  prescriptionItems,
  prescriptions,
  profileHealthSummary,
} from '@/db/schema';
import { recordAuditLog } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { canUse } from '@/lib/permissions';
import {
  drugRecordFromRow,
  evaluatePrescriptionSafety,
  type RegimenItem,
  type SafetyContext,
  type SafetyDecision,
  type SafetyOverride,
} from '@/lib/prescription-safety';
import type { DrugInteractionRecord, StructuredPatientInput } from '@/types';

export const EVENT_OVERRIDE = 'SAFETY_OVERRIDE';
export const EVENT_INPUTS = 'SAFETY_INPUTS_RECORDED';

/** Inputs a clinician may record at prescribing time when the record lacks them. */
export const safetyInputsSchema = z
  .object({
    no_known_allergies: z.literal(true).optional(),
    is_pregnant: z.boolean().optional(),
    weight_kg: z.number().positive().max(400).optional(),
    egfr: z.number().min(1).max(200).optional(),
    care_setting: z.enum(['outpatient', 'inpatient', 'intensive_care']).optional(),
  })
  .strict();
export type SafetyInputs = z.infer<typeof safetyInputsSchema>;

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Only a verified, active doctor who wrote the prescription may check,
 * override or finalize it. Administrators manage the system; they do not prescribe.
 */
export async function requirePrescriber(): Promise<User | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (user.role !== 'doctor') return NextResponse.json({ error: 'Only doctors can prescribe.' }, { status: 403 });
  const permission = await canUse(user, 'prescription.create');
  if (!permission.allowed) return NextResponse.json({ error: `You can't prescribe yet (${permission.reason}).` }, { status: 403 });
  return user;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : [];

const numberOrNull = (...values: unknown[]): number | null => {
  for (const value of values) if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

async function auditEntriesFor(prescriptionId: string, event: string) {
  return db
    .select({ userId: auditLogs.userId, payload: auditLogs.payload, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(and(eq(auditLogs.event, event), sql`${auditLogs.payload}->>'prescription_id' = ${prescriptionId}`))
    .orderBy(desc(auditLogs.createdAt));
}

export interface LoadedPrescription {
  rx: typeof prescriptions.$inferSelect;
  items: (typeof prescriptionItems.$inferSelect)[];
  decision: SafetyDecision;
  context: SafetyContext;
  caseId: string | null;
}

/** Recomputes the safety decision from the database for an exact prescription. */
export async function loadPrescriptionSafety(prescriptionId: string, prescriberId: string): Promise<LoadedPrescription | null> {
  const [rx] = await db.select().from(prescriptions).where(eq(prescriptions.id, prescriptionId)).limit(1);
  if (!rx) return null;
  const items = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, rx.id));
  const [patient] = await db.select().from(patients).where(eq(patients.id, rx.patientId)).limit(1);
  const [encounter] = rx.encounterId
    ? await db.select().from(encounters).where(eq(encounters.id, rx.encounterId)).limit(1)
    : [];
  const [linkedCase] = encounter?.caseId
    ? await db.select().from(cases).where(eq(cases.id, encounter.caseId)).limit(1)
    : [];
  const caseInput = (linkedCase?.structuredInput ?? {}) as Partial<StructuredPatientInput>;
  const [summary] = rx.profileId
    ? await db
        .select()
        .from(profileHealthSummary)
        .where(eq(profileHealthSummary.profileId, rx.profileId))
        .orderBy(desc(profileHealthSummary.version))
        .limit(1)
    : [];

  // Latest clinician-recorded inputs for this prescription.
  const [inputsEntry] = await auditEntriesFor(rx.id, EVENT_INPUTS);
  const recorded = (inputsEntry?.payload as { inputs?: SafetyInputs } | undefined)?.inputs ?? {};

  const encounterVitals = (encounter?.vitals ?? {}) as Record<string, unknown>;
  const currentMedicines = [
    ...strings(encounter?.currentMedications),
    ...strings(caseInput.current_medicines),
    ...((summary?.currentMedicines as { brand?: string; generic?: string }[] | undefined) ?? [])
      .map((medicine) => medicine.generic || medicine.brand || '')
      .filter(Boolean),
  ];

  // Other doctors' prescriptions count only while the patient has granted full history.
  if (rx.profileId) {
    const now = new Date();
    const [grant] = await db
      .select({ id: accessGrants.id })
      .from(accessGrants)
      .where(
        and(
          eq(accessGrants.profileId, rx.profileId),
          eq(accessGrants.doctorId, prescriberId),
          eq(accessGrants.status, 'active'),
          eq(accessGrants.scope, 'full_history'),
          or(isNull(accessGrants.expiresAt), gt(accessGrants.expiresAt, now)),
        ),
      )
      .limit(1);
    if (grant) {
      const others = await db
        .select({ genericName: prescriptionItems.genericName })
        .from(prescriptionItems)
        .innerJoin(prescriptions, eq(prescriptions.id, prescriptionItems.prescriptionId))
        .where(and(eq(prescriptions.profileId, rx.profileId), ne(prescriptions.doctorId, prescriberId), eq(prescriptions.status, 'finalized')));
      currentMedicines.push(...others.map((other) => other.genericName));
    }
  }

  const context: SafetyContext = {
    age: numberOrNull(patient?.age, caseInput.age),
    gender: patient?.gender ?? caseInput.gender ?? null,
    weightKg: numberOrNull(recorded.weight_kg, caseInput.weight_kg, encounterVitals.weight_kg),
    allergies: [
      ...new Set([
        ...strings(encounter?.allergies),
        ...strings(caseInput.allergies),
        ...strings(summary?.allergies),
        ...(recorded.no_known_allergies ? ['No known allergies'] : []),
      ]),
    ],
    isPregnant: typeof recorded.is_pregnant === 'boolean' ? recorded.is_pregnant : typeof caseInput.is_pregnant === 'boolean' ? caseInput.is_pregnant : null,
    egfr: numberOrNull(recorded.egfr, caseInput.egfr),
    conditions: [
      ...new Set([
        ...strings(caseInput.past_medical_history),
        ...strings(summary?.chronicConditions),
        ...(encounter?.pastHistory ?? '').split(/[,;\n]/).map((entry) => entry.trim()).filter(Boolean),
      ]),
    ],
    currentMedicines: [...new Set(currentMedicines)],
  };

  const regimen: RegimenItem[] = items.map((entry) => ({
    genericName: entry.genericName,
    brandName: entry.brandName,
    strength: entry.strength,
    form: entry.form,
    dosingSchedule: entry.dosingSchedule,
    durationDays: entry.durationDays,
  }));

  const [formularyRows, interactionRows, recallRows, overrideRows] = await Promise.all([
    db.select().from(drugs),
    db.select().from(drugInteractions),
    db.select({ title: medicineNotices.title, body: medicineNotices.body }).from(medicineNotices).where(eq(medicineNotices.severity, 'critical_recall')),
    auditEntriesFor(rx.id, EVENT_OVERRIDE),
  ]);

  const overrides: SafetyOverride[] = overrideRows.map((row) => {
    const payload = row.payload as Record<string, string>;
    return {
      alertId: payload.alert_id,
      reason: payload.reason,
      clinicianId: row.userId ?? '',
      contextVersion: payload.context_version,
      regimenHash: payload.regimen_hash,
      recordedAt: row.createdAt.toISOString(),
    };
  });

  const decision = evaluatePrescriptionSafety({
    context,
    items: regimen,
    formulary: formularyRows.map(drugRecordFromRow),
    interactions: interactionRows.map(
      (row): DrugInteractionRecord => ({ id: row.id, drug_a: row.drugA, drug_b: row.drugB, severity: row.severity as DrugInteractionRecord['severity'], note: row.note }),
    ),
    recalls: recallRows,
    overrides,
  });

  return { rx, items, decision, context, caseId: linkedCase?.id ?? null };
}

/** Records clinician-supplied safety inputs, audited with the clinician's identity. */
export async function recordSafetyInputs(prescriptionId: string, userId: string, caseId: string | null, inputs: SafetyInputs) {
  if (Object.keys(inputs).length === 0) return;
  const [previous] = await auditEntriesFor(prescriptionId, EVENT_INPUTS);
  const merged = { ...((previous?.payload as { inputs?: SafetyInputs } | undefined)?.inputs ?? {}), ...inputs };
  await recordAuditLog({ userId, caseId, event: EVENT_INPUTS, payload: { prescription_id: prescriptionId, inputs: merged } });
}

/** Records one override, bound to the current regimen and patient context. */
export async function recordOverride(params: {
  prescriptionId: string;
  userId: string;
  caseId: string | null;
  alertId: string;
  alertTitle: string;
  reason: string;
  decision: SafetyDecision;
}) {
  await recordAuditLog({
    userId: params.userId,
    caseId: params.caseId,
    event: EVENT_OVERRIDE,
    payload: {
      prescription_id: params.prescriptionId,
      alert_id: params.alertId,
      alert_title: params.alertTitle,
      reason: params.reason,
      context_version: params.decision.contextVersion,
      regimen_hash: params.decision.regimenHash,
    },
  });
}

/** API shape of a decision; keeps the field names the existing UI reads. */
export function decisionJson(decision: SafetyDecision, context?: SafetyContext) {
  return {
    status: decision.status,
    safe_to_finalize: decision.safeToFinalize,
    has_critical_stop: decision.alerts.some((alert) => alert.stop !== 'none' && !alert.override),
    alerts: decision.alerts,
    missing_inputs: decision.missingInputs,
    context_version: decision.contextVersion,
    regimen_hash: decision.regimenHash,
    stale_overrides: decision.staleOverrides,
    ...(context
      ? {
          allergies_checked: context.allergies,
          chronic_conditions_checked: context.conditions,
          external_medicines_checked: context.currentMedicines,
        }
      : {}),
  };
}
