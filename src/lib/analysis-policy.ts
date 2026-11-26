export const abstentionModel = 'docmate-abstention-v1';
/** Analyses produced by the gated synthetic evidence assessment. */
export const assessmentModel = 'docmate-assessment-v1';
export const analysisModels = [abstentionModel, assessmentModel];

/**
 * The evidence-grounded Analyze path is a synthetic demo feature. It runs only
 * when both flags are set explicitly; otherwise Analyze keeps abstaining.
 * It never enables treatment, prescription issuance or official printing.
 */
export function syntheticAssessmentEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DOCMATE_DEMO_MODE === 'true' && env.DOCMATE_SYNTHETIC_ASSESSMENT === 'on';
}
