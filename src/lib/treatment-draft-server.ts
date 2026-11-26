import { and, asc, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs, caseFollowUps, cases, chunks, drugInteractions, drugs, sourceVersions, sources } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { canUse } from '@/lib/permissions';
import { activeFindings, caseVersion } from '@/lib/case-urgency';
import { currentUrgentFindings } from '@/lib/case-urgency-server';
import { drugRecordFromRow } from '@/lib/prescription-safety';
import { buildTreatmentDraft, type EvidenceChunk, type TreatmentDraft } from '@/lib/treatment-draft';
import type { HistoryUse } from '@/lib/follow-up';
import type { DrugInteractionRecord, StructuredPatientInput } from '@/types';

export const EVENT_APPROVED = 'TREATMENT_APPROVED';
export const EVENT_CONFLICT_REVIEWED = 'TREATMENT_CONFLICT_REVIEWED';

export interface ConflictReview {
  conflict_key: string;
  drug_id: string;
  decision: 'use_recommendation' | 'do_not_use' | 'request_information';
  reasoning: string;
  requested_information: string[];
  case_version: string;
  reviewed_by: string | null;
  reviewed_at: string;
  /** True when the review was made on the current record. */
  current: boolean;
}

/** The latest review per conflict on this case. */
export async function conflictReviews(caseId: string, currentVersion: string): Promise<Record<string, ConflictReview>> {
  const rows = await db
    .select({ userId: auditLogs.userId, payload: auditLogs.payload, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(and(eq(auditLogs.caseId, caseId), eq(auditLogs.event, EVENT_CONFLICT_REVIEWED)))
    .orderBy(desc(auditLogs.createdAt));
  const latest: Record<string, ConflictReview> = {};
  for (const row of rows) {
    const payload = row.payload as Omit<ConflictReview, 'reviewed_by' | 'reviewed_at' | 'current'>;
    if (latest[payload.conflict_key]) continue;
    latest[payload.conflict_key] = {
      ...payload,
      reviewed_by: row.userId,
      reviewed_at: row.createdAt.toISOString(),
      current: payload.case_version === currentVersion,
    };
  }
  return latest;
}

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Treatment decisions belong to a verified, active doctor; administrators do not treat. */
export async function requireTreatingDoctor(): Promise<User | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (user.role !== 'doctor') return NextResponse.json({ error: 'Only the treating doctor can do this.' }, { status: 403 });
  const permission = await canUse(user, 'ai.treatment');
  if (!permission.allowed) return NextResponse.json({ error: `Access denied (${permission.reason})` }, { status: 403 });
  return user;
}

export async function loadFormulary() {
  const [drugRows, interactionRows] = await Promise.all([db.select().from(drugs).orderBy(asc(drugs.genericName)), db.select().from(drugInteractions)]);
  return {
    formulary: drugRows.map(drugRecordFromRow),
    interactions: interactionRows.map(
      (row): DrugInteractionRecord => ({ id: row.id, drug_a: row.drugA, drug_b: row.drugB, severity: row.severity as DrugInteractionRecord['severity'], note: row.note }),
    ),
  };
}

async function loadEvidence(): Promise<EvidenceChunk[]> {
  const rows = await db
    .select({
      id: chunks.id,
      text: chunks.text,
      section: chunks.section,
      page: chunks.page,
      sourceTitle: sources.title,
      sourceType: sources.sourceType,
      lifecycle: sources.lifecycle,
      sourceYear: sources.year,
      sourceVersion: sourceVersions.versionNo,
    })
    .from(chunks)
    .innerJoin(sources, eq(sources.id, chunks.sourceId))
    .leftJoin(sourceVersions, eq(sourceVersions.id, chunks.sourceVersionId))
    .where(and(eq(chunks.status, 'active'), eq(sources.lifecycle, 'published'), eq(sources.sourceType, 'guideline')));
  return rows;
}

export interface CaseDraft {
  record: typeof cases.$inferSelect;
  draft: TreatmentDraft;
  caseVersion: string;
  /** Facts from an earlier visit that the doctor reconciled and this plan relies on. */
  historyUsed: HistoryUse[];
}

/** Rebuilds the draft from the current case, library and formulary. */
export async function buildCaseDraft(caseId: string, doctorId: string): Promise<CaseDraft | null | 'no_diagnosis' | 'reconciliation_required'> {
  const record = await db.query.cases.findFirst({ where: and(eq(cases.id, caseId), eq(cases.doctorId, doctorId)) });
  if (!record) return null;
  // A follow-up visit plans only after the doctor reconciles what was carried forward.
  const [followUp] = await db.select({ status: caseFollowUps.status, reconciliation: caseFollowUps.reconciliation }).from(caseFollowUps).where(eq(caseFollowUps.caseId, caseId)).limit(1);
  if (followUp && followUp.status !== 'reconciled') return 'reconciliation_required';
  if (!record.confirmedDiagnosis) return 'no_diagnosis';
  const patient = record.structuredInput as StructuredPatientInput;
  const [{ formulary, interactions }, evidence, findings] = await Promise.all([loadFormulary(), loadEvidence(), currentUrgentFindings(record)]);
  const draft = buildTreatmentDraft({
    diagnosis: record.confirmedDiagnosis,
    patient,
    formulary,
    interactions,
    chunks: evidence,
    activeUrgentFindings: activeFindings(findings).length,
  });
  const historyUsed = ((followUp?.reconciliation as { history_used?: HistoryUse[] } | null)?.history_used ?? []).filter(
    (use) => use.used_for !== 'working_diagnosis' || use.label.toLowerCase() === record.confirmedDiagnosis!.toLowerCase(),
  );
  return { record, draft, caseVersion: caseVersion(patient), historyUsed };
}

/** The latest approval for a case and whether it still matches the record. */
export async function latestApproval(caseId: string, record: typeof cases.$inferSelect) {
  const [row] = await db
    .select({ userId: auditLogs.userId, payload: auditLogs.payload, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(and(eq(auditLogs.caseId, caseId), eq(auditLogs.event, EVENT_APPROVED)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  if (!row) return null;
  const payload = row.payload as Record<string, unknown>;
  const current = payload.case_version === caseVersion(record.structuredInput as StructuredPatientInput)
    && payload.diagnosis === record.confirmedDiagnosis;
  return { ...payload, approved_by: row.userId, approved_at: row.createdAt.toISOString(), current };
}
