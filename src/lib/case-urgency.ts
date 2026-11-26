// Urgent findings on a case, kept separate from evidence sufficiency.
//
// A case can lack evidence for a diagnosis and still need urgent action, so
// "insufficient evidence" never clears an urgent warning. A finding stays
// active across analysis rounds until a clinician resolves it with a basis
// and rationale. A resolution is bound to the patient record version: if the
// record changes and the rule still fires, the finding becomes active again.
//
// Detection uses only the existing deterministic rules in red-flags.ts. New
// rules need an approved clinical source and clinician-reviewed fixtures.

import crypto from 'node:crypto';
import { matchRedFlagRules } from './red-flags';
import type { StructuredPatientInput } from '@/types';

export { RESOLUTION_BASES } from './case-urgency-shared';
export type { FindingResolution, ResolutionBasis, UrgentFinding } from './case-urgency-shared';
import type { FindingResolution, UrgentFinding } from './case-urgency-shared';

/** Text the rules scan: complaint, symptoms, history and notes. */
export function caseText(input: Partial<StructuredPatientInput>): string {
  return [
    input.chief_complaint,
    ...(input.symptoms ?? []),
    input.history_of_present_illness,
    input.examination_findings,
    input.clinical_notes,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('. ');
}

/** Hash of the clinical record, used to bind a resolution to what the clinician saw. */
export function caseVersion(input: Partial<StructuredPatientInput>): string {
  return crypto.createHash('sha256').update(JSON.stringify(input ?? {})).digest('hex');
}

const PRIOR_FLAG: Omit<UrgentFinding, 'first_detected_round' | 'status'> = {
  id: 'prior-red-flag',
  title_en: 'Earlier urgent warning not yet reviewed',
  title_bn: 'আগের জরুরি সতর্কতা এখনও দেখা হয়নি',
  description_en: 'This case was marked urgent before. Review the patient and record your decision.',
  description_bn: 'এই কেসটি আগে জরুরি হিসেবে চিহ্নিত ছিল। রোগী দেখে আপনার সিদ্ধান্ত লিখুন।',
  source: 'prior_case_status',
};

export interface MergeInput {
  input: Partial<StructuredPatientInput>;
  /** Findings saved with the latest analysis round. */
  previous: UrgentFinding[];
  /** Case status before this computation; "red_flag" with no saved findings is carried over. */
  priorStatus: string;
  /** Latest clinician resolution per finding id. */
  resolutions: Map<string, FindingResolution>;
  round: number;
}

/** Combines saved findings, fresh rule matches and clinician resolutions. Pure. */
export function mergeUrgentFindings({ input, previous, priorStatus, resolutions, round }: MergeInput): UrgentFinding[] {
  const version = caseVersion(input);
  const byId = new Map(previous.map((finding) => [finding.id, { ...finding }]));

  const detected = new Set<string>();
  for (const rule of matchRedFlagRules(caseText(input))) {
    const id = `rule:${rule.id}`;
    detected.add(id);
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        title_en: rule.title_en.replace(/^🚨\s*/u, ''),
        title_bn: rule.title_bn.replace(/^🚨\s*/u, ''),
        description_en: rule.description_en,
        description_bn: rule.description_bn,
        source: id,
        first_detected_round: round,
        status: 'active',
      });
    }
  }

  if (priorStatus === 'red_flag' && byId.size === 0) {
    byId.set(PRIOR_FLAG.id, { ...PRIOR_FLAG, first_detected_round: round, status: 'active' });
  }

  return [...byId.values()].map((finding) => {
    const resolution = resolutions.get(finding.id) ?? finding.resolution;
    if (!resolution) return { ...finding, status: 'active', resolution: undefined };
    // A rule that still fires on a changed record needs a fresh review.
    if (detected.has(finding.id) && resolution.case_version !== version) {
      return { ...finding, status: 'active', resolution: undefined, reraised: true };
    }
    return { ...finding, status: 'resolved', resolution };
  });
}

export const activeFindings = (findings: UrgentFinding[]) => findings.filter((finding) => finding.status === 'active');
