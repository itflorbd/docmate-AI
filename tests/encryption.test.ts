import { describe, it, expect } from 'vitest';
import { encryptPatientPii, decryptPatientPii } from '../src/lib/encryption';

describe('AES-256-GCM Patient PII Encryption', () => {
  it('should encrypt and successfully decrypt plain text patient name', () => {
    const originalName = 'কাজী মোহাম্মদ রফিকুল ইসলাম';
    const encrypted = encryptPatientPii(originalName);

    expect(encrypted).not.toBe(originalName);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decryptPatientPii(encrypted);
    expect(decrypted).toBe(originalName);
  });

  it('should encrypt and decrypt patient mobile number', () => {
    const phone = '+8801712345678';
    const encrypted = encryptPatientPii(phone);

    expect(encrypted).not.toBe(phone);
    expect(decryptPatientPii(encrypted)).toBe(phone);
  });

  it('should produce unique ciphertexts (different IVs) for identical plaintexts', () => {
    const text = 'Fatema Begum';
    const enc1 = encryptPatientPii(text);
    const enc2 = encryptPatientPii(text);

    expect(enc1).not.toBe(enc2);
    expect(decryptPatientPii(enc1)).toBe(text);
    expect(decryptPatientPii(enc2)).toBe(text);
  });

  it('should handle empty or null values gracefully', () => {
    expect(encryptPatientPii('')).toBe('');
    expect(encryptPatientPii(null)).toBe('');
    expect(encryptPatientPii(undefined)).toBe('');

    expect(decryptPatientPii('')).toBe('');
    expect(decryptPatientPii(null)).toBe('');
    expect(decryptPatientPii(undefined)).toBe('');
  });

  it('should detect tampered ciphertext or auth tag', () => {
    const enc = encryptPatientPii('Sensitive Medical Record');
    const parts = enc.split(':');
    // Tamper with the ciphertext segment
    const tamperedCipher = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'b' : 'a');
    const tampered = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    expect(decryptPatientPii(tampered)).toBe('[Decryption Error]');
  });

  it('should return legacy non-encrypted strings as-is for backward compatibility', () => {
    const legacy = 'P-101-Legacy-Patient';
    expect(decryptPatientPii(legacy)).toBe(legacy);
  });
});
