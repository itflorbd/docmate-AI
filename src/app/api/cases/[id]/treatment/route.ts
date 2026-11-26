import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/audit';
import { validCaseId } from '@/lib/case-access';
import { clinicalGate } from '@/lib/clinical-release';
import { buildCaseDraft, conflictReviews, latestApproval, requireTreatingDoctor } from '@/lib/treatment-draft-server';

/** Latest approved plan for the report preview, with whether it still matches the record. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireTreatingDoctor();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  const built = await buildCaseDraft(id, user.id);
  if (!built) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  if (built === 'no_diagnosis' || built === 'reconciliation_required') return NextResponse.json({ approval: null });
  return NextResponse.json({ approval: await latestApproval(id, built.record), official_issuance: clinicalGate().officialIssuance });
}

/**
 * Builds a draft treatment plan for the confirmed working diagnosis. Each option
 * carries a verified guideline quote, formulary dosing and a server safety result.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTreatingDoctor();
    if (user instanceof NextResponse) return user;
    if (!clinicalGate().treatmentDrafts) {
      return NextResponse.json({ error: 'Treatment drafts are switched off until clinical release is approved.', code: 'release_gate' }, { status: 423 });
    }
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const built = await buildCaseDraft(id, user.id);
    if (!built) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (built === 'reconciliation_required') {
      return NextResponse.json({ error: 'Review what was carried forward from the earlier visit first.', code: 'reconciliation_required' }, { status: 409 });
    }
    if (built === 'no_diagnosis') {
      return NextResponse.json({ error: 'Confirm a working diagnosis first.', code: 'diagnosis_required' }, { status: 409 });
    }

    await recordAuditLog({
      userId: user.id,
      caseId: id,
      event: 'TREATMENT_DRAFT_GENERATED',
      payload: {
        status: built.draft.status,
        diagnosis: built.draft.diagnosis,
        case_version: built.caseVersion,
        options: built.draft.options.map((option) => ({ drug_id: option.drug_id, chunk_id: option.citation.chunk_id, safety: option.safety.status })),
        excluded: built.draft.excluded,
        history_used: built.historyUsed.map((use) => ({ item_id: use.item_id, used_for: use.used_for, source_case_id: use.source.case_id })),
        conflicts: built.draft.conflicts.map((conflict) => ({
          key: conflict.key,
          drug_id: conflict.drug_id,
          kind: conflict.kind,
          blocking: conflict.blocking,
          chunk_ids: conflict.sides.map((side) => side.citation.chunk_id),
        })),
      },
    });

    return NextResponse.json({
      draft: built.draft,
      case_version: built.caseVersion,
      conflict_reviews: await conflictReviews(id, built.caseVersion),
      history_used: built.historyUsed,
      synthetic_only: !clinicalGate().officialIssuance,
    });
  } catch (err) {
    console.error('Treatment draft failed:', err);
    return NextResponse.json({ error: 'Could not build the treatment draft.' }, { status: 500 });
  }
}
