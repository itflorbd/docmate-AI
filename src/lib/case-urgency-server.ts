import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { analyses, auditLogs, cases } from '@/db/schema';
import { abstentionModel } from '@/lib/analysis-policy';
import { mergeUrgentFindings, type FindingResolution, type UrgentFinding } from '@/lib/case-urgency';
import type { StructuredPatientInput } from '@/types';

export const EVENT_RESOLVED = 'URGENT_FINDING_RESOLVED';

type Db = Pick<typeof db, 'select' | 'query'>;

/** Latest clinician resolution per finding id, from the audit log. */
export async function loadResolutions(caseId: string, client: Db = db): Promise<Map<string, FindingResolution>> {
  const rows = await client
    .select({ userId: auditLogs.userId, payload: auditLogs.payload, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(and(eq(auditLogs.caseId, caseId), eq(auditLogs.event, EVENT_RESOLVED)))
    .orderBy(asc(auditLogs.createdAt));
  const map = new Map<string, FindingResolution>();
  for (const row of rows) {
    const payload = row.payload as { finding_id: string; basis: FindingResolution['basis']; rationale: string; case_version: string };
    map.set(payload.finding_id, {
      by: row.userId ?? '',
      basis: payload.basis,
      rationale: payload.rationale,
      case_version: payload.case_version,
      at: row.createdAt.toISOString(),
    });
  }
  return map;
}

/** Current urgent findings for a case: saved, freshly detected and resolved ones. */
export async function currentUrgentFindings(
  record: Pick<typeof cases.$inferSelect, 'id' | 'status' | 'structuredInput'>,
  client: Db = db,
  round?: number,
): Promise<UrgentFinding[]> {
  const latest = await client.query.analyses.findFirst({
    columns: { round: true, output: true },
    where: and(eq(analyses.caseId, record.id), eq(analyses.model, abstentionModel)),
    orderBy: [desc(analyses.round)],
  });
  const previous = ((latest?.output as { urgent_findings?: UrgentFinding[] } | undefined)?.urgent_findings) ?? [];
  return mergeUrgentFindings({
    input: record.structuredInput as Partial<StructuredPatientInput>,
    previous,
    priorStatus: record.status,
    resolutions: await loadResolutions(record.id, client),
    round: round ?? latest?.round ?? 0,
  });
}
