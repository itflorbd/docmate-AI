// Clinical release gate.
//
// Treatment drafts can be reviewed with synthetic data while DOCMATE_DEMO_MODE
// is exactly "true". Issuing or printing an official prescription stays closed until the
// organisation records a release approval:
//   DOCMATE_CLINICAL_RELEASE=approved
//   DOCMATE_CLINICAL_RELEASE_REF=<approval reference, e.g. a signed review ID>
// Both are unset by default, so official issuance is blocked.

export interface ClinicalGate {
  /** Draft treatment plans may be generated and reviewed. */
  treatmentDrafts: boolean;
  /** Official prescriptions may be issued, printed or delivered to patients. */
  officialIssuance: boolean;
  /** Approval reference when issuance is open. */
  releaseRef: string | null;
}

export function clinicalGate(env: Record<string, string | undefined> = process.env): ClinicalGate {
  const releaseRef = env.DOCMATE_CLINICAL_RELEASE_REF?.trim() || null;
  const officialIssuance = env.DOCMATE_CLINICAL_RELEASE === 'approved' && releaseRef !== null;
  const syntheticDemo = env.DOCMATE_DEMO_MODE === 'true';
  return {
    treatmentDrafts: officialIssuance || syntheticDemo,
    officialIssuance,
    releaseRef: officialIssuance ? releaseRef : null,
  };
}

export const RELEASE_GATE_MESSAGE =
  'Official prescriptions are switched off until clinical validation and release approval are recorded.';
