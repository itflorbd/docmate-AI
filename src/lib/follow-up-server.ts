// Server side of follow-up visits: who may continue which visit, what they may
// read, and the create and reconcile writes. Ownership and consent are checked
// here, never in the browser.

import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { accessGrants, analyses, auditLogs, caseFollowUps, cases, prescriptionItems, prescriptions, users } from '@/db/schema';
import { recordAccessLog } from '@/lib/access-log';
import { recordAuditLog } from '@/lib/audit';
import { buildCarryItems, initialFollowUpInput, type CarryItem, type PriorVisit } from '@/lib/follow-up';
import type { AnalysisOutput, StructuredPatientInput } from '@/types';

type CaseRow = typeof cases.$inferSelect;

/** The doctor's active, unexpired consent grant on a patient profile. */
async function activeGrant(profileId: string, doctorId: string) {
  const [grant] = await db
    .select({ id: accessGrants.id, scope: accessGrants.scope })
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.profileId, profileId),
        eq(accessGrants.doctorId, doctorId),
        eq(accessGrants.status, 'active'),
        or(isNull(accessGrants.expiresAt), gt(accessGrants.expiresAt, new Date())),
      ),
    )
    .limit(1);
  return grant ?? null;
}

/**
 * A doctor may continue a visit when:
 * - they wrote it, and (for a linked patient profile) the patient's consent grant is active; or
 * - another doctor wrote it, and the patient granted this doctor full history.
 * Anything else is reported as not found.
 */
export async function authorizePriorVisit(doctorId: string, priorId: string): Promise<{ prior: CaseRow; fullHistory: boolean } | null> {
  const [prior] = await db.select().from(cases).where(eq(cases.id, priorId)).limit(1);
  if (!prior) return null;
  const grant = prior.profileId ? await activeGrant(prior.profileId, doctorId) : null;
  if (prior.doctorId === doctorId) {
    if (prior.profileId && !grant) return null;
    return { prior, fullHistory: grant?.scope === 'full_history' };
  }
  if (prior.profileId && grant?.scope === 'full_history') return { prior, fullHistory: true };
  return null;
}

async function toPriorVisit(row: CaseRow & { doctorName: string | null }): Promise<PriorVisit> {
  const [approval] = await db
    .select({ payload: auditLogs.payload })
    .from(auditLogs)
    .where(and(eq(auditLogs.caseId, row.id), eq(auditLogs.event, 'TREATMENT_APPROVED')))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  const [analysis] = await db.select({ output: analyses.output }).from(analyses).where(eq(analyses.caseId, row.id)).orderBy(desc(analyses.round)).limit(1);
  // Prescriptions explicitly linked to this visit (never guessed by patient/date).
  const linkedRxItems = await db
    .select({
      genericName: prescriptionItems.genericName,
      strength: prescriptionItems.strength,
      dosingSchedule: prescriptionItems.dosingSchedule,
      durationDays: prescriptionItems.durationDays,
    })
    .from(prescriptionItems)
    .innerJoin(prescriptions, eq(prescriptions.id, prescriptionItems.prescriptionId))
    .where(eq(prescriptions.caseId, row.id))
    .orderBy(desc(prescriptions.createdAt));
  const plan = (approval?.payload ?? {}) as { items?: PriorVisit['approvedPlan']; note?: string | null };
  const output = analysis?.output as AnalysisOutput | undefined;
  return {
    id: row.id,
    patientCode: row.patientCode,
    createdAt: row.createdAt,
    structuredInput: row.structuredInput as Partial<StructuredPatientInput>,
    confirmedDiagnosis: row.confirmedDiagnosis,
    doctorName: row.doctorName,
    approvedPlan: (plan.items ?? []).map((item) => ({ generic_name: item.generic_name, dose_text: item.dose_text, frequency: item.frequency, duration_days: item.duration_days })),
    prescribedItems: linkedRxItems.map((item) => ({
      generic_name: item.genericName,
      strength: item.strength,
      dosing_schedule: item.dosingSchedule,
      duration_days: item.durationDays,
    })),
    approvalNote: plan.note ?? null,
    openItems: (output?.missing_information ?? []).map((item) => item.text).filter(Boolean),
  };
}

/** Earlier visits of the same patient that this doctor may read. Other visits are left out. */
async function accessibleEarlierVisits(doctorId: string, prior: CaseRow, fullHistory: boolean) {
  if (!prior.profileId) return { visits: [] as PriorVisit[], excluded: false };
  const rows = await db
    .select({ row: cases, doctorName: users.name })
    .from(cases)
    .leftJoin(users, eq(users.id, cases.doctorId))
    .where(eq(cases.profileId, prior.profileId));
  const earlier = rows.filter(({ row }) => row.id !== prior.id && row.createdAt <= prior.createdAt);
  const allowed = earlier.filter(({ row }) => row.doctorId === doctorId || fullHistory);
  const visits = await Promise.all(allowed.map(({ row, doctorName }) => toPriorVisit({ ...row, doctorName })));
  return { visits, excluded: allowed.length < earlier.length };
}

export interface CarryPreview {
  previous: { id: string; patient_code: string; visit_date: string; doctor_name: string | null; working_diagnosis: string | null };
  items: CarryItem[];
  /** True when some of the patient's history is not visible to this doctor and was left out. */
  history_excluded: boolean;
}

export async function previewCarryForward(doctorId: string, priorId: string): Promise<CarryPreview | null> {
  const access = await authorizePriorVisit(doctorId, priorId);
  if (!access) return null;
  const [author] = access.prior.doctorId ? await db.select({ name: users.name }).from(users).where(eq(users.id, access.prior.doctorId)).limit(1) : [];
  const selected = await toPriorVisit({ ...access.prior, doctorName: author?.name ?? null });
  const { visits, excluded } = await accessibleEarlierVisits(doctorId, access.prior, access.fullHistory);
  return {
    previous: {
      id: access.prior.id,
      patient_code: access.prior.patientCode,
      visit_date: access.prior.createdAt.toISOString(),
      doctor_name: selected.doctorName,
      working_diagnosis: access.prior.confirmedDiagnosis,
    },
    items: buildCarryItems(selected, visits),
    history_excluded: excluded,
  };
}

/**
 * Creates the follow-up draft, or returns the one already created for this
 * request (or still waiting for reconciliation). The prior visit is not changed.
 */
export async function startFollowUp(user: { id: string; role: string }, priorId: string, requestKey: string) {
  const preview = await previewCarryForward(user.id, priorId);
  if (!preview) return null;

  const result = await db.transaction(async (tx) => {
    // Serialise concurrent submissions for the same prior visit.
    await tx.select({ id: cases.id }).from(cases).where(eq(cases.id, priorId)).for('update');
    const existing = await tx
      .select({ caseId: caseFollowUps.caseId, requestKey: caseFollowUps.requestKey })
      .from(caseFollowUps)
      .innerJoin(cases, eq(cases.id, caseFollowUps.caseId))
      .where(
        and(
          eq(caseFollowUps.previousCaseId, priorId),
          eq(caseFollowUps.doctorId, user.id),
          or(eq(caseFollowUps.requestKey, requestKey), and(eq(caseFollowUps.status, 'pending'), eq(cases.status, 'draft'))),
        ),
      )
      .limit(1);
    if (existing[0]) return { caseId: existing[0].caseId, created: false };

    const [prior] = await tx.select().from(cases).where(eq(cases.id, priorId)).limit(1);
    const selected = { structuredInput: prior.structuredInput as Partial<StructuredPatientInput> } as PriorVisit;
    const [created] = await tx
      .insert(cases)
      .values({ doctorId: user.id, profileId: prior.profileId, patientCode: prior.patientCode, status: 'draft', structuredInput: initialFollowUpInput(selected) })
      .returning({ id: cases.id });
    await tx.insert(caseFollowUps).values({
      caseId: created.id,
      previousCaseId: priorId,
      profileId: prior.profileId,
      doctorId: user.id,
      requestKey,
      carried: { previous: preview.previous, items: preview.items, history_excluded: preview.history_excluded },
    });
    return { caseId: created.id, created: true };
  });

  if (result.created) {
    await recordAuditLog({
      userId: user.id,
      caseId: result.caseId,
      event: 'FOLLOW_UP_STARTED',
      payload: {
        previous_case_id: priorId,
        request_key: requestKey,
        carried: preview.items.map((item) => ({ id: item.id, kind: item.kind, source_case_id: item.source.case_id, field: item.source.field })),
        history_excluded: preview.history_excluded,
      },
    });
    const [row] = await db.select({ profileId: cases.profileId }).from(cases).where(eq(cases.id, priorId)).limit(1);
    if (row?.profileId) {
      await recordAccessLog({
        userId: user.id,
        profileId: row.profileId,
        userRole: user.role,
        action: 'history_carry_forward',
        recordType: 'case',
        recordId: priorId,
        reason: 'Doctor started a follow-up visit from an earlier visit',
      });
    }
  }
  return result;
}

export async function followUpFor(caseId: string) {
  const [row] = await db.select().from(caseFollowUps).where(eq(caseFollowUps.caseId, caseId)).limit(1);
  return row ?? null;
}

/** Follow-up visits created from these cases (for the timeline). */
export async function followUpsFrom(caseIds: string[]) {
  if (caseIds.length === 0) return [];
  return db.select({ caseId: caseFollowUps.caseId, previousCaseId: caseFollowUps.previousCaseId }).from(caseFollowUps).where(inArray(caseFollowUps.previousCaseId, caseIds));
}
