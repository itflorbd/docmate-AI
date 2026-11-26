// Types and constants for urgent findings that are safe to import in the browser.

export const RESOLUTION_BASES = ['examination', 'investigation', 'senior_review', 'referred_or_admitted', 'entered_in_error'] as const;
export type ResolutionBasis = (typeof RESOLUTION_BASES)[number];

export interface FindingResolution {
  by: string;
  basis: ResolutionBasis;
  rationale: string;
  at: string;
  case_version: string;
}

export interface UrgentFinding {
  id: string;
  title_en: string;
  title_bn: string;
  description_en: string;
  description_bn: string;
  /** "rule:<rule id>" or "prior_case_status". */
  source: string;
  first_detected_round: number;
  status: 'active' | 'resolved';
  resolution?: FindingResolution;
  /** Set when a resolved finding became active again after the record changed. */
  reraised?: boolean;
}
