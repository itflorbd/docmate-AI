import { NextResponse } from 'next/server';
import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';
import { recordAuditLog } from '@/lib/audit';
import { validCaseId } from '@/lib/case-access';
import { clinicalGate } from '@/lib/clinical-release';
import { buildCaseDraft, conflictReviews, EVENT_CONFLICT_REVIEWED, requireTreatingDoctor } from '@/lib/treatment-draft-server';

const bodySchema = z
  .object({
    conflict_key: z.string().regex(/^[0-9a-f]{32}$/),
    case_version: z.string().length(64),
    decision: z.enum(['use_recommendation', 'do_not_use', 'request_information']),
    reasoning: z.string().trim().min(10).max(1000),
    requested_information: z.array(z.string().trim().min(2).max(200)).max(10).default([]),
  })
  .strict();

/**
 * The doctor reviews a guideline disagreement: use the recommending passage,
 * do not use the medicine, or ask for the missing facts. The server rebuilds the
 * draft, so the review is bound to the evidence and record the doctor saw.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTreatingDoctor();
    if (user instanceof NextResponse) return user;
    if (!clinicalGate().treatmentDrafts) return NextResponse.json({ error: 'Treatment drafts are switched off.', code: 'release_gate' }, { status: 423 });
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const body = bodySchema.safeParse(await boundedJson(request, 8192));
    if (!body.success) return NextResponse.json({ error: 'Write a short reason (at least 10 characters).', details: body.error.flatten().fieldErrors }, { status: 400 });

    const built = await buildCaseDraft(id, user.id);
    if (!built) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (built === 'reconciliation_required') {
      return NextResponse.json({ error: 'Review what was carried forward from the earlier visit first.', code: 'reconciliation_required' }, { status: 409 });
    }
    if (built === 'no_diagnosis') return NextResponse.json({ error: 'Confirm a working diagnosis first.', code: 'diagnosis_required' }, { status: 409 });
    if (built.caseVersion !== body.data.case_version) {
      return NextResponse.json({ error: 'The patient record changed. Review the new draft.', code: 'stale_review' }, { status: 409 });
    }
    const conflict = built.draft.conflicts.find((entry) => entry.key === body.data.conflict_key);
    if (!conflict) return NextResponse.json({ error: 'This disagreement is no longer in the draft.', code: 'not_in_draft' }, { status: 404 });
    if (body.data.decision === 'request_information' && body.data.requested_information.length === 0) {
      return NextResponse.json({ error: 'Say which information you need.' }, { status: 400 });
    }

    await recordAuditLog({
      userId: user.id,
      caseId: id,
      event: EVENT_CONFLICT_REVIEWED,
      payload: {
        conflict_key: conflict.key,
        drug_id: conflict.drug_id,
        generic_name: conflict.generic_name,
        kind: conflict.kind,
        decision: body.data.decision,
        reasoning: body.data.reasoning,
        // Requested facts belong only to a request for information.
        requested_information: body.data.decision === 'request_information' ? body.data.requested_information : [],
        case_version: built.caseVersion,
        sides: conflict.sides.map((side) => ({ stance: side.stance, chunk_id: side.citation.chunk_id, quote: side.citation.quote, source_title: side.citation.source_title })),
      },
    });
    return NextResponse.json({ reviews: await conflictReviews(id, built.caseVersion) });
  } catch (err) {
    console.error('Conflict review failed:', err);
    return NextResponse.json({ error: 'Could not save the review.' }, { status: 500 });
  }
}
