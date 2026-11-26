/**
 * Deterministic Number Parser for Bangla and English Digits and Number Words.
 * Never allows an LLM to guess numerical clinical values (vitals, ages, doses).
 */

const BN_DIGIT_MAP: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

const BN_WORD_MAP: Record<string, number> = {
  'শূন্য': 0, 'এক': 1, 'দেড়': 1.5, 'দুই': 2, 'আড়াই': 2.5, 'তিন': 3, 'চার': 4,
  'পাঁচ': 5, 'ছয়': 6, 'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9, 'নয়': 9, 'দশ': 10,
  'এগারো': 11, 'বারো': 12, 'তেরো': 13, 'চৌদ্দ': 14, 'পনেরো': 15, 'ষোলো': 16,
  'সতেরো': 17, 'আঠারো': 18, 'উনিশ': 19, 'বিশ': 20, 'কুড়ি': 20, 'কুড়ি': 20,
  'একুশ': 21, 'বাইশ': 22, 'তেইশ': 23, 'চব্বিশ': 24, 'পঁচিশ': 25, 'ছাব্বিশ': 26,
  'সাতাশ': 27, 'আঠাশ': 28, 'উনত্রিশ': 29, 'ত্রিশ': 30, 'একত্রিশ': 31, 'বত্রিশ': 32,
  'তেত্রিশ': 33, 'চৌত্রিশ': 34, 'পঁয়ত্রিশ': 35, 'ছত্রিশ': 36, 'সাইত্রিশ': 37,
  'আটত্রিশ': 38, 'উনচল্লিশ': 39, 'চল্লিশ': 40, 'একচল্লিশ': 41, 'বিয়াল্লিশ': 42,
  'তেতাল্লিশ': 43, 'চুয়াল্লিশ': 44, 'পঁয়তাল্লিশ': 45, 'পঁয়তাল্লিশ': 45, 'পয়তাল্লিশ': 45, 'পয়তাল্লিশ': 45,
  'ছেচল্লিশ': 46, 'সাতচল্লিশ': 47, 'আটচল্লিশ': 48, 'উনপঞ্চাশ': 49, 'পঞ্চাশ': 50, 'ষাট': 60, 'সত্তর': 70,
  'আশি': 80, 'নব্বই': 90, 'একশো': 100, 'দুইশো': 200, 'তিনশো': 300,
  'চারশো': 400, 'পাঁচশো': 500, 'ছয়শো': 600, 'সাতশো': 700, 'আটশো': 800,
  'নয়শো': 900, 'হাজার': 1000,
};

const EN_WORD_MAP: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000,
};

/**
 * Normalizes all Bengali numerals (০-৯) in a text string to standard ASCII digits (0-9)
 */
export function normalizeDigits(input: string): string {
  if (!input) return '';
  return input.replace(/[০-৯]/g, (char) => BN_DIGIT_MAP[char] || char);
}

/**
 * Extracts a single primary number from text (e.g. age, temperature, heart rate, days)
 */
export function parseNumber(input: string): number | null {
  if (!input) return null;
  const normalized = normalizeDigits(input.trim().toLowerCase());

  // 1. Direct digit match (supports decimals like 38.5, 101.4, or units like 500mg)
  const directMatch = normalized.match(/(?<=[^\d.]|^)(\d+(?:\.\d+)?)(?=[^\d.]|$)/);
  if (directMatch) {
    const val = parseFloat(directMatch[1]);
    if (!Number.isNaN(val)) return val;
  }

  // 2. Bangla word lookup
  for (const [word, num] of Object.entries(BN_WORD_MAP)) {
    const regex = new RegExp(`(?:^|[^\\p{L}\\p{N}])${word}(?=[^\\p{L}\\p{N}]|$)`, 'u');
    if (regex.test(normalized)) {
      return num;
    }
  }

  // 3. English word lookup
  for (const [word, num] of Object.entries(EN_WORD_MAP)) {
    const regex = new RegExp(`(?:^|[^\\p{L}\\p{N}])${word}(?=[^\\p{L}\\p{N}]|$)`, 'u');
    if (regex.test(normalized)) {
      return num;
    }
  }

  return null;
}

/**
 * Alias for parseNumber for clarity
 */
export const parseBanglaNumber = parseNumber;

/**
 * Extracts all numeric values (both digits and spelled out words) present in text.
 */
export function parseAllNumbers(input: string): number[] {
  if (!input) return [];
  const normalized = normalizeDigits(input.toLowerCase());
  const numbers: number[] = [];

  // Match all numeric tokens (including when adjacent to units, e.g. 500mg, 120mmHg)
  const digitMatches = normalized.matchAll(/(?<=[^\d.]|^)(\d+(?:\.\d+)?)(?=[^\d.]|$)/g);
  for (const m of digitMatches) {
    const val = parseFloat(m[1]);
    if (!Number.isNaN(val)) numbers.push(val);
  }

  // Check word maps (sorted by length descending to match composite words first)
  const sortedWords = Object.keys(BN_WORD_MAP).sort((a, b) => b.length - a.length);
  for (const word of sortedWords) {
    const regex = new RegExp(`(?:^|[^\\p{L}\\p{N}])${word}(?=[^\\p{L}\\p{N}]|$)`, 'u');
    if (regex.test(normalized)) {
      const val = BN_WORD_MAP[word];
      if (!numbers.includes(val)) {
        numbers.push(val);
      }
    }
  }

  const sortedEnWords = Object.keys(EN_WORD_MAP).sort((a, b) => b.length - a.length);
  for (const word of sortedEnWords) {
    const regex = new RegExp(`(?:^|[^\\p{L}\\p{N}])${word}(?=[^\\p{L}\\p{N}]|$)`, 'u');
    if (regex.test(normalized)) {
      const val = EN_WORD_MAP[word];
      if (!numbers.includes(val)) {
        numbers.push(val);
      }
    }
  }

  return numbers;
}

/**
 * Parses Blood Pressure strings in diverse clinical formats:
 * - "120/80", "১২০/৮০", "120 over 80", "120 by 80", "১২০ বাই ৮০"
 */
export function parseBloodPressure(input: string): { systolic: number; diastolic: number } | null {
  if (!input) return null;
  const normalized = normalizeDigits(input.toLowerCase());

  // Match: (\d{2,3}) (over | by | / | বাই) (\d{2,3})
  const bpMatch = normalized.match(/(\d{2,3})\s*(?:\/|over|by|বাই|x)\s*(\d{2,3})/i);
  if (bpMatch) {
    const sys = parseInt(bpMatch[1], 10);
    const dia = parseInt(bpMatch[2], 10);
    if (sys >= 50 && sys <= 260 && dia >= 30 && dia <= 160) {
      return { systolic: sys, diastolic: dia };
    }
  }

  return null;
}

/**
 * Parses Temperature in Celsius or Fahrenheit
 */
export function parseTemperature(input: string): {
  value: number;
  valueCelsius: number;
  unit: 'C' | 'F';
  originalUnit: 'C' | 'F';
} | null {
  if (!input) return null;
  const normalized = normalizeDigits(input.toLowerCase());

  // Fahrenheit: e.g. "101.5 f", "102 ডিগ্রি", "fever 101"
  const fMatch = normalized.match(/(\b10\d(?:\.\d)?|\b9\d(?:\.\d)?)\s*(?:°?\s*f|fahrenheit|ডিগ্রি)?/i);
  if (fMatch) {
    const fahr = parseFloat(fMatch[1]);
    if (fahr >= 94 && fahr <= 108) {
      const celsius = Math.round(((fahr - 32) * (5 / 9)) * 10) / 10;
      return { value: fahr, valueCelsius: celsius, unit: 'F', originalUnit: 'F' };
    }
  }

  // Celsius: e.g. "38.5 c", "৩৯ সেলসিয়াস", "38.2"
  const cMatch = normalized.match(/(\b[34]\d(?:\.\d)?)\s*(?:°?\s*c|celsius|সেলসিয়াস)?/i);
  if (cMatch) {
    const celsius = parseFloat(cMatch[1]);
    if (celsius >= 34.0 && celsius <= 43.0) {
      return { value: celsius, valueCelsius: celsius, unit: 'C', originalUnit: 'C' };
    }
  }

  return null;
}
