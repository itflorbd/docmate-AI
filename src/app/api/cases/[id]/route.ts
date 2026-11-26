import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';
import { analysisModels } from '@/lib/analysis-policy';
import { followUpFor } from '@/lib/follow-up-server';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cases, analyses, caseTurns, auditLogs } from '@/db/schema';
import { and, eq, desc, inArray } from 'drizzle-orm';
import { activeFindings } from '@/lib/case-urgency';
import { currentUrgentFindings } from '@/lib/case-urgency-server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const caseRecord = await db.query.cases.findFirst({
      where: ownedCase(id, user.id),
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Get latest analysis
    const latestAnalysis = await db.query.analyses.findFirst({
      where: and(eq(analyses.caseId, id), inArray(analyses.model, analysisModels)),
      orderBy: [desc(analyses.round)],
    });

    // Get all analyses for this case (history)
    const allAnalyses = await db.query.analyses.findMany({
      where: and(eq(analyses.caseId, id), inArray(analyses.model, analysisModels)),
      orderBy: [desc(analyses.round)],
    });

    // Get turns (Q&A history)
    const turns = await db.query.caseTurns.findMany({
      where: eq(caseTurns.caseId, id),
      orderBy: [caseTurns.createdAt],
    });

    const followUp = await followUpFor(id);

    const formattedCase = {
      ...caseRecord,
      patient_code: caseRecord.patientCode,
      structured_input: caseRecord.structuredInput,
      confirmed_diagnosis: caseRecord.confirmedDiagnosis,
      doctor_id: caseRecord.doctorId,
      created_at: caseRecord.createdAt,
      updated_at: caseRecord.updatedAt,
    };

    return NextResponse.json({
      case: formattedCase,
      urgent_findings: await currentUrgentFindings(caseRecord),
      analysis: latestAnalysis ? latestAnalysis.output : null,
      analysisRecord: latestAnalysis,
      analyses: allAnalyses,
      turns,
      follow_up: followUp
        ? { status: followUp.status, previous_case_id: followUp.previousCaseId, carried: followUp.carried, reconciliation: followUp.reconciliation }
        : null,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const input = z.object({
      confirmedDiagnosis: z.string().trim().min(1).max(250),
    }).strict().safeParse(await boundedJson(request));
    if (!input.success) return NextResponse.json({ error: 'Invalid working diagnosis' }, { status: 400 });

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(cases).where(ownedCase(id, user.id)).for('update');
      if (!current) return null;
      // A working diagnosis does not resolve an urgent finding; the case stays urgent until each is reviewed.
      const stillUrgent = activeFindings(await currentUrgentFindings(current, tx)).length > 0;
      const [record] = await tx.update(cases).set({
        status: stillUrgent ? 'red_flag' : 'confirmed', confirmedDiagnosis: input.data.confirmedDiagnosis, updatedAt: new Date(),
      }).where(ownedCase(id, user.id)).returning();
      await tx.insert(auditLogs).values({
        caseId: id, userId: user.id, event: 'diagnosis_confirmed', payload: { diagnosis: input.data.confirmedDiagnosis, urgent: stillUrgent },
      });
      return record;
    });

    if (!updated) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    return NextResponse.json({ case: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
  }
}
