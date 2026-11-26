import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  sendOtp,
  verifyOtp,
  isDemoMode,
  assertProductionDemoGuard,
  DEMO_OTP,
} from '../src/lib/otp';
import { db } from '../src/db';
import { otpRequests } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('Patient Phone + OTP Authentication & Security Guard', () => {
  const originalEnv = { ...process.env };
  const testPhone = '+8801799887766';

  beforeEach(async () => {
    // Clear test phone requests
    await db.delete(otpRequests).where(eq(otpRequests.phone, testPhone));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('1. Generates fixed OTP 123456 when DEMO_MODE=true', async () => {
    process.env.DEMO_MODE = 'true';
    expect(isDemoMode()).toBe(true);

    const sendRes = await sendOtp(testPhone, 'login');
    expect(sendRes.success).toBe(true);
    expect(sendRes.isDemo).toBe(true);

    // Verify with 123456 succeeds
    const verifyRes = await verifyOtp(testPhone, '123456', 'login');
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.accountId).toBeDefined();
  });

  it('2. Enforces 60-second cooldown between consecutive OTP requests', async () => {
    process.env.DEMO_MODE = 'true';

    const first = await sendOtp(testPhone, 'login');
    expect(first.success).toBe(true);

    // Immediate second attempt triggers cooldown
    const second = await sendOtp(testPhone, 'login');
    expect(second.success).toBe(false);
    expect(second.cooldownSeconds).toBeGreaterThan(0);
    expect(second.error).toContain('অপেক্ষা করুন');
  });

  it('3. Fails verification on incorrect code and decrements remaining attempts', async () => {
    process.env.DEMO_MODE = 'false';

    const sendRes = await sendOtp(testPhone, 'login');
    expect(sendRes.success).toBe(true);

    // Submit wrong OTP
    const verifyRes = await verifyOtp(testPhone, '000000', 'login');
    expect(verifyRes.success).toBe(false);
    expect(verifyRes.attemptsRemaining).toBe(4);
    expect(verifyRes.error).toContain('ভুল ওটিপি কোড');
  });

  it('4. Refuses already-used OTP codes', async () => {
    process.env.DEMO_MODE = 'true';

    await sendOtp(testPhone, 'login');
    const firstVerify = await verifyOtp(testPhone, DEMO_OTP, 'login');
    expect(firstVerify.success).toBe(true);

    // Replay attack with same code
    const secondVerify = await verifyOtp(testPhone, DEMO_OTP, 'login');
    expect(secondVerify.success).toBe(false);
    expect(secondVerify.error).toContain('আগেই ব্যবহৃত হয়েছে');
  });

  it('5. Refuses to start in production if DEMO_MODE=true without ALLOW_DEMO_IN_PRODUCTION', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;

    expect(() => assertProductionDemoGuard()).toThrow(
      /FATAL SECURITY VIOLATION: DEMO_MODE=true is strictly prohibited in production/
    );
  });

  it('6. Starts in production if ALLOW_DEMO_IN_PRODUCTION=true is explicitly set', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';
    process.env.ALLOW_DEMO_IN_PRODUCTION = 'true';

    expect(() => assertProductionDemoGuard()).not.toThrow();
  });
});
