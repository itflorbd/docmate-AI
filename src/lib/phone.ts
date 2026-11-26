/**
 * DocMate AI — Bangladeshi Mobile Phone Normalization & Formatting Helper
 * 
 * Supports:
 * - Local formats: 017XXXXXXXX (11 digits, prefixes 013-019)
 * - Country code formats: 88017XXXXXXXX, +88017XXXXXXXX
 * - Bengali numerals: ০১৭১২৩৪৫৬৭৮ -> +8801712345678
 * - Spacing and separators: 01712-345678, +880 1712 345678
 * - Standardized E.164 normalization: +8801XXXXXXXXX
 * - Bangladeshi local display formatting: 01712-345678 or +880 1712-345678
 */

const BANGLA_DIGIT_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const ENGLISH_TO_BANGLA_DIGIT_MAP: Record<string, string> = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

// Valid Bangladeshi Mobile Operator Prefixes: 013 (Grameenphone), 014 (Banglalink),
// 015 (Teletalk), 016 (Robi/Airtel), 017 (Grameenphone), 018 (Robi), 019 (Banglalink)
const VALID_OPERATOR_PREFIXES = ['013', '014', '015', '016', '017', '018', '019'];

/**
 * Converts Bengali digits in a string to standard ASCII English digits.
 */
export function convertBanglaDigitsToEnglish(input: string): string {
  if (!input) return '';
  return input
    .split('')
    .map((char) => BANGLA_DIGIT_MAP[char] ?? char)
    .join('');
}

/**
 * Converts ASCII English digits in a string to Bengali numerals.
 */
export function convertEnglishDigitsToBangla(input: string): string {
  if (!input) return '';
  return input
    .split('')
    .map((char) => ENGLISH_TO_BANGLA_DIGIT_MAP[char] ?? char)
    .join('');
}

export interface PhoneNormalizationResult {
  isValid: boolean;
  e164: string;           // E.g. "+8801712345678"
  national: string;       // E.g. "01712345678"
  formattedLocal: string; // E.g. "01712-345678"
  formattedBangla: string;// E.g. "০১৭১২-৩৪৫৬৭৮"
  operator: string;       // E.g. "Grameenphone", "Robi", etc.
  error?: string;
}

/**
 * Normalizes an arbitrary phone number string to E.164 format (+8801XXXXXXXXX).
 * Returns PhoneNormalizationResult.
 */
export function normalizeBangladeshiPhone(input: string): PhoneNormalizationResult {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      e164: '',
      national: '',
      formattedLocal: '',
      formattedBangla: '',
      operator: '',
      error: 'ফোন নম্বর প্রদান করা হয়নি (Phone number is empty)',
    };
  }

  // 1. Convert any Bengali digits to English
  const english = convertBanglaDigitsToEnglish(input);

  // 2. Strip all non-digit characters except leading plus if any
  let digits = english.replace(/[^\d]/g, '');

  // 3. Handle prefix variations:
  // If starts with 00880, strip 0088 to get the 11-digit national number
  if (digits.startsWith('00880') && digits.length === 15) {
    digits = digits.slice(4); // '01XXXXXXXXX'
  }
  // If starts with 880, strip 88 to get the 11-digit national number
  if (digits.startsWith('880') && digits.length === 13) {
    digits = digits.slice(2); // '01XXXXXXXXX'
  }
  // If user entered 10 digits starting with 1 (omitted leading 0 e.g. 17XXXXXXXX)
  if (digits.length === 10 && digits.startsWith('1')) {
    digits = '0' + digits; // '01XXXXXXXXX'
  }

  // 4. Validate national number length (must be exactly 11 digits starting with 01)
  if (digits.length !== 11) {
    return {
      isValid: false,
      e164: '',
      national: digits,
      formattedLocal: digits,
      formattedBangla: convertEnglishDigitsToBangla(digits),
      operator: '',
      error: 'ফোন নম্বরটি ১১ সংখ্যার হতে হবে (Phone number must be 11 digits)',
    };
  }

  const prefix = digits.slice(0, 3);
  if (!VALID_OPERATOR_PREFIXES.includes(prefix)) {
    return {
      isValid: false,
      e164: '',
      national: digits,
      formattedLocal: digits,
      formattedBangla: convertEnglishDigitsToBangla(digits),
      operator: '',
      error: `অচল অপারেটর কোড (${prefix})। বৈধ কোড: ০১৩-০১৯ (Invalid mobile prefix)`,
    };
  }

  // Operator Identification
  let operator = 'Unknown';
  if (prefix === '017' || prefix === '013') operator = 'Grameenphone';
  else if (prefix === '018' || prefix === '016') operator = 'Robi / Airtel';
  else if (prefix === '019' || prefix === '014') operator = 'Banglalink';
  else if (prefix === '015') operator = 'Teletalk';

  const e164 = `+88${digits}`;
  const formattedLocal = `${digits.slice(0, 5)}-${digits.slice(5)}`;
  const formattedBangla = convertEnglishDigitsToBangla(formattedLocal);

  return {
    isValid: true,
    e164,
    national: digits,
    formattedLocal,
    formattedBangla,
    operator,
  };
}

/**
 * Quick boolean checker for phone number validity.
 */
export function isValidBangladeshiPhone(input: string): boolean {
  return normalizeBangladeshiPhone(input).isValid;
}

/**
 * Mask a phone number for privacy display (e.g. "01712-345678" -> "01712-***678" or "+88017****5678").
 */
export function maskPhoneNumber(phone: string): string {
  const norm = normalizeBangladeshiPhone(phone);
  if (!norm.isValid) return phone;
  const national = norm.national; // e.g. 01712345678
  return `${national.slice(0, 5)}-***${national.slice(8)}`;
}
