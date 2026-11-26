// src/lib/language/preprocessor.ts
// DocMate AI - Multilingual Input Preprocessing

export interface PreprocessedText {
  original: string;
  normalized: string; // Unicode NFC, trimmed
  lowercased: string; // Lowercased normalized
  asciiDigitsText: string; // Bangla digits converted to ASCII digits, original preserved in `original`
}

const BANGLA_TO_ASCII_DIGIT_MAP: Record<string, string> = {
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

const ASCII_TO_BANGLA_DIGIT_MAP: Record<string, string> = {
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

/**
 * Converts any Bengali digits (০-৯) in text to ASCII digits (0-9).
 */
export function convertBanglaDigitsToAscii(text: string): string {
  if (!text) return '';
  return text.replace(/[০-৯]/g, (ch) => BANGLA_TO_ASCII_DIGIT_MAP[ch] || ch);
}

/**
 * Converts any ASCII digits (0-9) in text to Bengali digits (০-৯).
 */
export function convertAsciiDigitsToBangla(text: string | number): string {
  const str = String(text ?? '');
  return str.replace(/[0-9]/g, (ch) => ASCII_TO_BANGLA_DIGIT_MAP[ch] || ch);
}

/**
 * Normalizes user input string:
 * - Strips invisible zero-width characters (\u200B-\u200D, \uFEFF)
 * - Unicode NFC decomposition/composition
 * - Trims external whitespace
 * - Generates asciiDigitsText and lowercased copies
 */
export function preprocessText(raw: string): PreprocessedText {
  if (typeof raw !== 'string') {
    return {
      original: '',
      normalized: '',
      lowercased: '',
      asciiDigitsText: '',
    };
  }

  // Strip zero-width control chars that sometimes leak from keyboards/browsers
  const clean = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const normalized = clean.normalize('NFC');
  const lowercased = normalized.toLowerCase();
  const asciiDigitsText = convertBanglaDigitsToAscii(normalized);

  return {
    original: raw,
    normalized,
    lowercased,
    asciiDigitsText,
  };
}
