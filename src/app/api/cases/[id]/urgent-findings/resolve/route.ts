import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { cases } from '@/db/schema';
import { boundedJson } from '@/lib/api-input';
import { recordAuditLog } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { ownedCase, validCaseId } from '@/lib/case-access';
import { activeFindings, caseVersion, RESOLUTION_BASES } from '@/lib/case-urgency';
import { currentUrgentFindings, EVENT_RESOLVED } from '@/lib/case-urgency-server';
import { canUse } from '@/lib/permissions';
import type { StructuredPatientInput } from '@/types';

const bodySchema = z
  .object({
    finding_id: z.string().min(1).max(100),
    basis: z.enum(RESOLUTION_BASES),
    rationale: z.string().trim().min(15).max(1000),
  })
  .strict();

/**
 * A treating doctor records why an urgent finding is resolved. The record is
 * audited with the doctor, the basis, the rationale and the case version.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
    if (user.role !== 'doctor') return NextResponse.json({ error: 'Only the treating doctor can resolve an urgent finding.' }, { status: 403 });
    const permission = await canUse(user, 'patients.manage');
    if (!permission.allowed) return NextResponse.json({ error: `Access denied (${permission.reason})` }, { status: 403 });

    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const body = bodySchema.safeParse(await boundedJson(request, 4096));
    if (!body.success) return NextResponse.json({ error: 'Choose a basis and write at least 15 characters.' }, { status: 400 });

    const record = await db.query.cases.findFirst({ where: ownedCase(id, user.id) });
    if (!record) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const findings = await currentUrgentFindings(record);
    const finding = findings.find((entry) => entry.id === body.data.finding_id);
    if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    if (finding.status === 'resolved') return NextResponse.json({ error: 'Already resolved' }, { status: 409 });

    await recordAuditLog({
      userId: user.id,
      caseId: id,
      event: EVENT_RESOLVED,
      payload: {
        finding_id: finding.id,
        finding_source: finding.source,
        basis: body.data.basis,
        rationale: body.data.rationale,
        case_version: caseVersion(record.structuredInput as Partial<StructuredPatientInput>),
      },
    });

    const updated = await currentUrgentFindings(record);
    const stillActive = activeFindings(updated).length > 0;
    if (!stillActive && record.status === 'red_flag') {
      await db
        .update(cases)
        .set({ status: record.confirmedDiagnosis ? 'confirmed' : 'insufficient_evidence', updatedAt: new Date() })
        .where(ownedCase(id, user.id));
    }
    return NextResponse.json({ urgent_findings: updated });
  } catch (err) {
    console.error('Resolve urgent finding failed:', err);
    return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
  }
}
