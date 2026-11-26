import { describe, it, expect } from 'vitest';
import {
  normalizeBangladeshiPhone,
  isValidBangladeshiPhone,
  convertBanglaDigitsToEnglish,
  convertEnglishDigitsToBangla,
  maskPhoneNumber,
} from '../src/lib/phone';

describe('Bangladeshi Phone Normalization & Formatting Helper', () => {
  it('1. Normalizes standard 11-digit national phone numbers (017XXXXXXXX)', () => {
    const res = normalizeBangladeshiPhone('01712345678');
    expect(res.isValid).toBe(true);
    expect(res.e164).toBe('+8801712345678');
    expect(res.national).toBe('01712345678');
    expect(res.formattedLocal).toBe('01712-345678');
    expect(res.operator).toBe('Grameenphone');
  });

  it('2. Normalizes 13-digit numbers with 88 country code without plus', () => {
    const res = normalizeBangladeshiPhone('8801812345678');
    expect(res.isValid).toBe(true);
    expect(res.e164).toBe('+8801812345678');
    expect(res.national).toBe('01812345678');
    expect(res.operator).toBe('Robi / Airtel');
  });

  it('3. Normalizes 14-character numbers with +88 country code', () => {
    const res = normalizeBangladeshiPhone('+8801912345678');
    expect(res.isValid).toBe(true);
    expect(res.e164).toBe('+8801912345678');
    expect(res.national).toBe('01912345678');
    expect(res.operator).toBe('Banglalink');
  });

  it('4. Converts Bengali numerals to English and normalizes correctly', () => {
    const bengaliInput = '০১৭১২৩৪৫৬৭৮';
    const res = normalizeBangladeshiPhone(bengaliInput);
    expect(res.isValid).toBe(true);
    expect(res.e164).toBe('+8801712345678');
    expect(res.formattedBangla).toBe('০১৭১২-৩৪৫৬৭৮');
  });

  it('5. Handles spaces, dashes, and parentheses in input', () => {
    const res = normalizeBangladeshiPhone('017-12 34(56)78');
    expect(res.isValid).toBe(true);
    expect(res.e164).toBe('+8801712345678');
  });

  it('6. Identifies all major Bangladeshi operators (013, 014, 015, 016, 017, 018, 019)', () => {
    expect(normalizeBangladeshiPhone('01300000000').operator).toBe('Grameenphone');
    expect(normalizeBangladeshiPhone('01400000000').operator).toBe('Banglalink');
    expect(normalizeBangladeshiPhone('01500000000').operator).toBe('Teletalk');
    expect(normalizeBangladeshiPhone('01600000000').operator).toBe('Robi / Airtel');
    expect(normalizeBangladeshiPhone('01700000000').operator).toBe('Grameenphone');
    expect(normalizeBangladeshiPhone('01800000000').operator).toBe('Robi / Airtel');
    expect(normalizeBangladeshiPhone('01900000000').operator).toBe('Banglalink');
  });

  it('7. Rejects invalid phone numbers and prefixes', () => {
    // Too short
    expect(isValidBangladeshiPhone('017123456')).toBe(false);
    // Too long
    expect(isValidBangladeshiPhone('0171234567899')).toBe(false);
    // Invalid operator prefix (010, 011, 012 are inactive/legacy)
    expect(isValidBangladeshiPhone('01112345678')).toBe(false);
    expect(isValidBangladeshiPhone('01212345678')).toBe(false);
    // Empty
    expect(isValidBangladeshiPhone('')).toBe(false);
  });

  it('8. Masks phone numbers correctly for privacy', () => {
    expect(maskPhoneNumber('01712345678')).toBe('01712-***678');
    expect(maskPhoneNumber('+8801898765432')).toBe('01898-***432');
  });

  it('9. Converts between English and Bengali digits correctly', () => {
    expect(convertBanglaDigitsToEnglish('১২৩৪৫৬৭৮৯০')).toBe('1234567890');
    expect(convertEnglishDigitsToBangla('1234567890')).toBe('১২৩৪৫৬৭৮৯০');
  });

  it('10. Normalizes 10-digit numbers omitting leading zero and numbers with 00880', () => {
    const res10 = normalizeBangladeshiPhone('1712345678');
    expect(res10.isValid).toBe(true);
    expect(res10.e164).toBe('+8801712345678');
    expect(res10.national).toBe('01712345678');

    const res0088 = normalizeBangladeshiPhone('008801712345678');
    expect(res0088.isValid).toBe(true);
    expect(res0088.e164).toBe('+8801712345678');
  });
});
