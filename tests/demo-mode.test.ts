import { describe, expect, it } from 'vitest';
import { DemoModeInProductionError, isDemoMode } from '@/lib/demo-mode';

describe('demo mode', () => {
  it('is off unless explicitly "true"', () => {
    expect(isDemoMode({})).toBe(false);
    expect(isDemoMode({ DOCMATE_DEMO_MODE: 'TRUE' })).toBe(false);
    expect(isDemoMode({ DOCMATE_DEMO_MODE: '1' })).toBe(false);
    expect(isDemoMode({ DOCMATE_DEMO_MODE: 'true' })).toBe(true);
  });

  it('refuses to run in production without an explicit synthetic-data acknowledgement', () => {
    expect(() => isDemoMode({ DOCMATE_DEMO_MODE: 'true', NODE_ENV: 'production' })).toThrow(DemoModeInProductionError);
    expect(isDemoMode({ DOCMATE_DEMO_MODE: 'true', NODE_ENV: 'production', ALLOW_DEMO_IN_PRODUCTION: 'true' })).toBe(true);
    expect(isDemoMode({ NODE_ENV: 'production' })).toBe(false);
  });
});
