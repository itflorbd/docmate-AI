import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateLimit } from '@/lib/api-input';

describe('API rate limits', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('bounds account requests in demo mode and resets after the window', () => {
    vi.stubEnv('DOCMATE_DEMO_MODE', 'true');
    vi.useFakeTimers();
    const key = 'login:qa-rate-limit@docmate.ai';

    expect(rateLimit(key, 1, 1_000)).toBeNull();
    const limited = rateLimit(key, 1, 1_000);
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get('Retry-After')).toBe('1');

    vi.advanceTimersByTime(1_000);
    expect(rateLimit(key, 1, 1_000)).toBeNull();
  });
});
