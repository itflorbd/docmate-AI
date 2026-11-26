import { boundedJson, rateLimit } from '@/lib/api-input';
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { analyses, auditLogs, cases } from '@/db/schema';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';
import type { AnalysisOutput, StructuredPatientInput } from '@/types';
import bn from '../../../../../../messages/bn.json';
import en from '../../../../../../messages/en.json';

const inputSchema = z.object({ locale: z.enum(['bn', 'en']).default('bn') });
import { abstentionModel, assessmentModel, syntheticAssessmentEnabled } from '@/lib/analysis-policy';
import { assessCase } from '@/lib/assistant/case-assessment';
import { activeFindings } from '@/lib/case-urgency';
import { currentUrgentFindings } from '@/lib/case-urgency-server';

function abstain(patient: StructuredPatientInput, locale: 'bn' | 'en'): AnalysisOutput {
  const t = (locale === 'bn' ? bn : en).analysisGuard;
  const missing = { why_it_helps: '', which_diagnoses_it_separates: [] };
  const vitals = patient.vitals ?? {};
  const hasRecordedVitals = Object.values(vitals).some((v) => v !== undefined && v !== null && v !== '');
  return {
    status: 'insufficient_evidence',
    confidence: { label: 'insufficient', score: 0, reasoning: t.reason },
    differentials: [],
    missing_information: [
      ...(!hasRecordedVitals
        ? [{ ...missing, id: 'vitals', type: 'exam' as const, text: t.vitals }]
        : []),
      { ...missing, id: 'exam', type: 'question', text: t.exam },
    ],
    red_flags: [],
    summary: t.reason,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const limited = rateLimit(`analyze:${user.id}`, 12);
    if (limited) return limited;
    const input = inputSchema.safeParse(await boundedJson(request, 2048));
    if (!input.success) return NextResponse.json({ error: 'Invalid analysis request' }, { status: 400 });

    // Gated synthetic demo: evidence assessment on structured lab fields. Runs
    // before the transaction so no row lock is held during the model call.
    let assessed: Awaited<ReturnType<typeof assessCase>> | null = null;
    if (syntheticAssessmentEnabled()) {
      const current = await db.query.cases.findFirst({ where: ownedCase(id, user.id) });
      if (!current) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      assessed = await assessCase(current.structuredInput as StructuredPatientInput, input.data.locale);
    }

    const result = await db.transaction(async (tx) => {
      const [record] = await tx.select().from(cases).where(ownedCase(id, user.id)).for('update');
      if (!record) return null;

      const last = await tx.query.analyses.findFirst({
        columns: { round: true },
        where: eq(analyses.caseId, id),
        orderBy: [desc(analyses.round)],
      });
      const round = (last?.round ?? 0) + 1;
      // Evidence sufficiency and urgency are separate: neither an abstention nor a
      // supported assessment clears an unresolved urgent finding from an earlier round.
      const urgentFindings = await currentUrgentFindings(record, tx, round);
      const active = activeFindings(urgentFindings);
      const base = assessed?.analysis ?? abstain(record.structuredInput as StructuredPatientInput, input.data.locale);
      const analysis = {
        ...base,
        urgency: active.length ? 'urgent' : 'none',
        urgent_findings: urgentFindings,
        red_flags: active.map((finding) => (input.data.locale === 'bn' ? finding.title_bn : finding.title_en)),
      };
      const model = assessed?.analysis ? assessmentModel : abstentionModel;
      await tx.insert(analyses).values({ caseId: id, round, output: analysis, model, tokens: 0 });
      const [updated] = await tx.update(cases).set({
        status: active.length ? 'red_flag' : analysis.status === 'ok' ? 'analyzed' : 'insufficient_evidence',
        updatedAt: new Date(),
      }).where(ownedCase(id, user.id)).returning();
      await tx.insert(auditLogs).values({
        caseId: id,
        userId: user.id,
        event: 'case_analyzed',
        payload: {
          round,
          status: analysis.status,
          urgency: analysis.urgency,
          active_finding_ids: active.map((finding) => finding.id),
          path: assessed ? 'synthetic_assessment' : 'abstention',
          model: assessed?.model ?? null,
          mode: assessed?.mode ?? null,
          rejections: assessed?.rejections.map((rejection) => rejection.reason) ?? [],
        },
      });

      return {
        case: { ...updated, patient_code: updated.patientCode, structured_input: updated.structuredInput },
        round,
        analysis,
        assessment: assessed ? { model: assessed.model, mode: assessed.mode, rejections: assessed.rejections, synthetic_only: true } : null,
      };
    });
    if (!result) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
