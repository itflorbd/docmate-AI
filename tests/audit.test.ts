import { describe, it, expect } from 'vitest';
import { computeAuditHash, recordAuditLog, verifyAuditChain } from '../src/lib/audit';

describe('Cryptographic Hash-Chained Audit Trail', () => {
  it('1. Computes deterministic SHA-256 hash for audit events', () => {
    const prevHash = '0'.repeat(64);
    const ts = '2026-11-21T10:00:00.000Z';
    const payload = { action: 'view_record', note: 'patient access' };

    const hash1 = computeAuditHash(prevHash, 'CASE_VIEWED', 'user-1', 'case-1', payload, ts);
    const hash2 = computeAuditHash(prevHash, 'CASE_VIEWED', 'user-1', 'case-1', payload, ts);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('2. Alters hash if payload or metadata is tampered with (tamper-evident)', () => {
    const prevHash = '0'.repeat(64);
    const ts = '2026-11-21T10:00:00.000Z';

    const originalHash = computeAuditHash(
      prevHash,
      'UPDATE_PERMISSIONS',
      'user-admin',
      null,
      { role: 'doctor', enabled: true },
      ts
    );

    const tamperedPayloadHash = computeAuditHash(
      prevHash,
      'UPDATE_PERMISSIONS',
      'user-admin',
      null,
      { role: 'doctor', enabled: false },
      ts
    );

    const tamperedUserHash = computeAuditHash(
      prevHash,
      'UPDATE_PERMISSIONS',
      'user-attacker',
      null,
      { role: 'doctor', enabled: true },
      ts
    );

    expect(originalHash).not.toBe(tamperedPayloadHash);
    expect(originalHash).not.toBe(tamperedUserHash);
  });

  it('3. Successfully records and links sequential audit entries in database', async () => {
    const hash1 = await recordAuditLog({
      event: 'TEST_AUDIT_ENTRY_1',
      payload: { test: true, sequence: 1 },
    });

    const hash2 = await recordAuditLog({
      event: 'TEST_AUDIT_ENTRY_2',
      payload: { test: true, sequence: 2 },
    });

    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).not.toBe(hash2);
  });

  it('4. Successfully verifies unbroken audit chain in database', async () => {
    const verification = await verifyAuditChain();
    expect(verification.valid).toBe(true);
    expect(verification.totalChecked).toBeGreaterThan(0);
    expect(verification.error).toBeUndefined();
  });
});
