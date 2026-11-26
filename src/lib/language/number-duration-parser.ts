// src/lib/language/number-duration-parser.ts
// DocMate AI - Deterministic Numbers, Durations & Vitals Parser

import { convertBanglaDigitsToAscii } from './preprocessor';
import { ExtractedDuration, ExtractedVital } from './types';

const WORD_TO_NUMBER: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  twenty: 20, thirty: 30,

  // Bangla Script
  'শূন্য': 0, 'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5,
  'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9, 'দশ': 10,
  'এগারো': 11, 'বারো': 12, 'তেরো': 13, 'চৌদ্দ': 14, 'পনেরো': 15,
  'কুড়ি': 20, 'বিশ': 20, 'ত্রিশ': 30,

  // Banglish
  shunno: 0, ek: 1, dui: 2, tin: 3, char: 4, panch: 5, pas: 5,
  choy: 6, choi: 6, shat: 7, sat: 7, at: 8, aath: 8, noy: 9, noi: 9, dosh: 10,
  egaro: 11, baro: 12, tero: 13, choddo: 14, ponero: 15,
  kuri: 20, bish: 20, trish: 30,
};

/**
 * Extracts all numeric values from text (both digit strings and spelled words).
 */
export function extractNumbers(text: string): number[] {
  if (!text) return [];
  const asciiText = convertBanglaDigitsToAscii(text);
  const numbers: number[] = [];

  // 1. Find all digit sequences (supporting decimals)
  const digitRegex = /(?<![a-zA-Z0-9])(\d+(?:\.\d+)?)(?![a-zA-Z0-9])/g;
  let match: RegExpExecArray | null;
  while ((match = digitRegex.exec(asciiText)) !== null) {
    const val = parseFloat(match[1]);
    if (!isNaN(val)) {
      numbers.push(val);
    }
  }

  // 2. Find word-based numbers
  const wordTokens = asciiText.toLowerCase().split(/[^a-zA-Z\u0980-\u09FF]+/);
  for (const token of wordTokens) {
    if (WORD_TO_NUMBER[token] !== undefined) {
      numbers.push(WORD_TO_NUMBER[token]);
    }
  }

  return numbers;
}

/**
 * Extracts clinical durations from text (e.g. '3 din', 'তিন দিন', '5 days', '2 weeks').
 */
export function extractDurations(text: string): ExtractedDuration[] {
  if (!text) return [];
  const asciiText = convertBanglaDigitsToAscii(text);
  const durations: ExtractedDuration[] = [];

  // Units definition

  const unitRegexes: Array<{ unit: ExtractedDuration['unit']; regex: RegExp; multiplier: number }> = [
    { unit: 'hour', regex: /^(?:ghonta|ghontar|hours?|hr|h|ঘণ্টা|ঘন্টা)$/i, multiplier: 1 / 24 },
    { unit: 'day', regex: /^(?:din|deen|days?|d|দিন|দিবস)$/i, multiplier: 1 },
    { unit: 'week', regex: /^(?:soptaho|shoptaho|weeks?|w|wk|সপ্তাহ)$/i, multiplier: 7 },
    { unit: 'month', regex: /^(?:mash|months?|mo|m|মাস)$/i, multiplier: 30 },
    { unit: 'year', regex: /^(?:bochhor|bochor|years?|yr|y|বছর)$/i, multiplier: 365 },
  ];

  // More direct regex extraction
  const tokens = asciiText.split(/([,.;!?\n]+)/);

  for (const segment of tokens) {
    const directRegex = /(\d+(?:\.\d+)?|[a-zA-Z\u0980-\u09FF]+)\s*(din|deen|days?|d|দিন|দিবস|soptaho|shoptaho|weeks?|w|wk|সপ্তাহ|mash|months?|mo|m|মাস|ghonta|ghontar|hours?|hr|h|ঘণ্টা|ঘন্টা|bochhor|bochor|years?|yr|y|বছর)(?:\s*(?:dhore|dhoria|jabot|ধরে|যাবত))?/giu;

    let m: RegExpExecArray | null;
    while ((m = directRegex.exec(segment)) !== null) {
      const numRaw = m[1].toLowerCase();
      const unitRaw = m[2].toLowerCase();

      let numVal: number | undefined;
      if (/^\d+(?:\.\d+)?$/.test(numRaw)) {
        numVal = parseFloat(numRaw);
      } else if (WORD_TO_NUMBER[numRaw] !== undefined) {
        numVal = WORD_TO_NUMBER[numRaw];
      }

      if (numVal !== undefined && numVal > 0) {
        for (const u of unitRegexes) {
          if (u.regex.test(unitRaw)) {
            durations.push({
              rawText: m[0].trim(),
              value: numVal,
              unit: u.unit,
              daysEquivalent: Number((numVal * u.multiplier).toFixed(2)),
            });
            break;
          }
        }
      }
    }
  }

  return durations;
}

/**
 * Extracts patient vitals from text (BP, Temperature, Pulse, SpO2, Weight).
 */
export function extractVitals(text: string): ExtractedVital[] {
  if (!text) return [];
  const asciiText = convertBanglaDigitsToAscii(text);
  const vitals: ExtractedVital[] = [];

  // 1. Blood Pressure: e.g. "120/80", "130/85 mmHg", "BP 140/90"
  const bpRegex = /(?:bp|blood\s*pressure|প্রেসার|ব্লাড\s*প্রেসার)?\s*(\d{2,3})\s*\/\s*(\d{2,3})(?:\s*mmHg)?/giu;
  let bpMatch: RegExpExecArray | null;
  while ((bpMatch = bpRegex.exec(asciiText)) !== null) {
    const systolic = parseInt(bpMatch[1], 10);
    const diastolic = parseInt(bpMatch[2], 10);
    if (systolic >= 60 && systolic <= 260 && diastolic >= 30 && diastolic <= 150) {
      vitals.push({
        type: 'bp',
        value: `${systolic}/${diastolic}`,
        unit: 'mmHg',
        rawText: bpMatch[0].trim(),
      });
    }
  }

  // 2. Temperature: e.g. "102F", "102.5 °F", "38.5 C", "১০২ ডিগ্রি", "temp 101"
  const tempRegex = /(?:temp(?:erature)?|জর|তাপমাত্রা|জ্বর)?\s*(\d{2,3}(?:\.\d+)?)\s*(?:°?\s*(?:f|c|fahrenheit|celsius|ডিগ্রি|degree))(?![a-zA-Z])/giu;
  let tempMatch: RegExpExecArray | null;
  while ((tempMatch = tempRegex.exec(asciiText)) !== null) {
    const val = parseFloat(tempMatch[1]);
    if (val >= 35 && val <= 110) {
      const isCelsius = /c|celsius/i.test(tempMatch[0]) || val < 45;
      vitals.push({
        type: 'temperature',
        value: `${val}`,
        numericValue: val,
        unit: isCelsius ? '°C' : '°F',
        rawText: tempMatch[0].trim(),
      });
    }
  }

  // 3. SpO2: e.g. "SpO2 98%", "98% oxygen", "স্যাচুরেশন ৯৮%"
  const spo2Regex = /(?:spo2|o2|oxygen|স্যাচুরেশন|অক্সিজেন)?\s*(\d{2,3})\s*%(?:\s*(?:spo2|o2|saturation))?/giu;
  let spo2Match: RegExpExecArray | null;
  while ((spo2Match = spo2Regex.exec(asciiText)) !== null) {
    const val = parseInt(spo2Match[1], 10);
    if (val >= 50 && val <= 100) {
      vitals.push({
        type: 'spo2',
        value: `${val}`,
        numericValue: val,
        unit: '%',
        rawText: spo2Match[0].trim(),
      });
    }
  }

  // 4. Pulse / Heart Rate: e.g. "pulse 72", "HR 80 bpm", "নাড়ি ৮৫"
  const pulseRegex = /(?:pulse|hr|heart\s*rate|নাড়ি|পালস)\s*[:=]?\s*(\d{2,3})(?:\s*bpm|\/min)?/giu;
  let pulseMatch: RegExpExecArray | null;
  while ((pulseMatch = pulseRegex.exec(asciiText)) !== null) {
    const val = parseInt(pulseMatch[1], 10);
    if (val >= 30 && val <= 240) {
      vitals.push({
        type: 'pulse',
        value: `${val}`,
        numericValue: val,
        unit: 'bpm',
        rawText: pulseMatch[0].trim(),
      });
    }
  }

  return vitals;
}
