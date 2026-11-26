import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys;
}

describe('i18n Localization Key Parity (Hard Rule: Zero Missing Keys between bn and en)', () => {
  const bnPath = path.resolve(__dirname, '../messages/bn.json');
  const enPath = path.resolve(__dirname, '../messages/en.json');

  const bnMessages = JSON.parse(fs.readFileSync(bnPath, 'utf8'));
  const enMessages = JSON.parse(fs.readFileSync(enPath, 'utf8'));

  const bnKeys = getAllKeys(bnMessages).sort();
  const enKeys = getAllKeys(enMessages).sort();

  it('both bn.json and en.json exist and are valid JSON', () => {
    expect(bnMessages).toBeDefined();
    expect(enMessages).toBeDefined();
    expect(bnKeys.length).toBeGreaterThan(50);
  });

  it('every translation key in bn.json exists in en.json', () => {
    const missingInEn = bnKeys.filter((k) => !enKeys.includes(k));
    expect(
      missingInEn,
      `The following keys exist in bn.json but are missing in en.json:\n${missingInEn.join('\n')}`
    ).toHaveLength(0);
  });

  it('every translation key in en.json exists in bn.json', () => {
    const missingInBn = enKeys.filter((k) => !bnKeys.includes(k));
    expect(
      missingInBn,
      `The following keys exist in en.json but are missing in bn.json:\n${missingInBn.join('\n')}`
    ).toHaveLength(0);
  });

  it('total key count is 100% identical between bn and en', () => {
    expect(bnKeys.length).toBe(enKeys.length);
  });

  it('no translation string in bn.json is an empty string', () => {
    function checkNonEmpty(obj: Record<string, unknown>, prefix = '') {
      for (const [k, v] of Object.entries(obj)) {
        const fullPath = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'string') {
          expect(v.trim().length, `Empty translation found for key: ${fullPath} in bn.json`).toBeGreaterThan(0);
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
          checkNonEmpty(v as Record<string, unknown>, fullPath);
        }
      }
    }
    checkNonEmpty(bnMessages);
  });

  it('no translation string in en.json is an empty string', () => {
    function checkNonEmpty(obj: Record<string, unknown>, prefix = '') {
      for (const [k, v] of Object.entries(obj)) {
        const fullPath = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'string') {
          expect(v.trim().length, `Empty translation found for key: ${fullPath} in en.json`).toBeGreaterThan(0);
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
          checkNonEmpty(v as Record<string, unknown>, fullPath);
        }
      }
    }
    checkNonEmpty(enMessages);
  });
});
