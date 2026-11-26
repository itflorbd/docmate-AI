// Synthetic demo mode (demo passwords, relaxed rate limits, treatment drafts on
// test data). Off unless DOCMATE_DEMO_MODE is exactly "true": a missing or
// misspelled variable must never turn demo bypasses on.
// In production it also needs ALLOW_DEMO_IN_PRODUCTION=true, an explicit
// acknowledgement that the deployment holds synthetic data only.

export class DemoModeInProductionError extends Error {}

export function isDemoMode(env: Record<string, string | undefined> = process.env): boolean {
  if (env.DOCMATE_DEMO_MODE !== 'true') return false;
  if (env.NODE_ENV === 'production' && env.ALLOW_DEMO_IN_PRODUCTION !== 'true') {
    throw new DemoModeInProductionError(
      'DOCMATE_DEMO_MODE=true in production needs ALLOW_DEMO_IN_PRODUCTION=true. Use demo mode only with synthetic data.',
    );
  }
  return true;
}
