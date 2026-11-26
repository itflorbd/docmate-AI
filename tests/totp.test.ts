import { describe, it, expect } from 'vitest';
import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotpCode,
  generateTotpCodeForTesting,
} from '../src/lib/totp';

describe('TOTP MFA Engine (RFC 6238)', () => {
  it('1. Generates a cryptographically random Base32 secret', () => {
    const secret = generateTotpSecret(20);
    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThanOrEqual(32);
    // Base32 characters: A-Z, 2-7
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it('2. Generates valid standard otpauth:// URI for authenticator apps', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const email = 'doctor@docmate.ai';
    const uri = generateTotpUri({ secret, email });

    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=DocMate%20AI');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });

  it('3. Generates and verifies accurate 6-digit TOTP code for current window', () => {
    const secret = generateTotpSecret(20);
    const code = generateTotpCodeForTesting(secret);

    expect(code).toMatch(/^\d{6}$/);
    const isValid = verifyTotpCode({ secret, code });
    expect(isValid).toBe(true);
  });

  it('4. Rejects invalid or corrupted codes', () => {
    const secret = generateTotpSecret(20);
    expect(verifyTotpCode({ secret, code: '000000' })).toBe(false);
    expect(verifyTotpCode({ secret, code: '123456' })).toBe(false);
    expect(verifyTotpCode({ secret, code: 'invalid' })).toBe(false);
    expect(verifyTotpCode({ secret, code: '' })).toBe(false);
  });

  it('5. Tolerates clock drift of ±1 window (30 seconds)', () => {
    const secret = generateTotpSecret(20);
    const pastTime = Math.floor(Date.now() / 1000) - 25; // 25s ago (within window)
    const code = generateTotpCodeForTesting(secret, pastTime);

    const isValid = verifyTotpCode({ secret, code, window: 1 });
    expect(isValid).toBe(true);
  });
});
