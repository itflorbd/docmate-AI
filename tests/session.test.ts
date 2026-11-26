import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireAuthSecret } from '@/lib/session';

describe('Session signing configuration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rejects missing configuration even in demo mode', () => {
    vi.stubEnv('DOCMATE_DEMO_MODE', 'true');
    vi.stubEnv('AUTH_SECRET', '');
    expect(() => requireAuthSecret()).toThrow('deployment-specific AUTH_SECRET');
  });

  it('rejects the recognizable published default format', () => {
    vi.stubEnv('AUTH_SECRET', `docmate_production_secure_signing_key_${'0'.repeat(32)}`);
    expect(() => requireAuthSecret()).toThrow('deployment-specific AUTH_SECRET');
  });
});
