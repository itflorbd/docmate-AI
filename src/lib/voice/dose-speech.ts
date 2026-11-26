/**
 * Deterministic Prescription Dose-to-Speech Converter.
 * Strictly translates structured prescription records into speakable Bangla and English phrases.
 * Zero LLM involvement to eliminate dosage hallucinations.
 */

export interface StructuredDoseItem {
  brandName?: string;
  genericName?: string;
  strength?: string;
  form?: string;
  dosingSchedule: string; // e.g. '1+0+1', '1+1+1', '1+0+0'
  mealTiming?: string; // 'খাবারের পর', 'খাবারের আগে'
  durationDays?: number;
  durationText?: string;
  instructions?: string;
}

const SCHEDULE_SPEECH_MAP_BN: Record<string, string> = {
  '1+0+1': 'সকালে একটি, রাতে একটি',
  '1+1+1': 'সকালে একটি, দুপুরে একটি, রাতে একটি',
  '1+0+0': 'সকালে একটি',
  '0+0+1': 'রাতে একটি',
  '0+1+0': 'দুপুরে একটি',
  '1+1+0': 'সকালে একটি, দুপুরে একটি',
  '0+1+1': 'দুপুরে একটি, রাতে একটি',
  '1+1+1+1': 'দিনে চারবার একটি করে',
  '2+0+2': 'সকালে দুইটি, রাতে দুইটি',
  '2+2+2': 'সকালে দুইটি, দুপুরে দুইটি, রাতে দুইটি',
  '1/2+0+1/2': 'সকালে অর্ধেক, রাতে অর্ধেক',
  '1/2+1/2+1/2': 'সকালে অর্ধেক, দুপুরে অর্ধেক, রাতে অর্ধেক',
  'prn': 'প্রয়োজনে',
  'sos': 'জরুরি প্রয়োজনে',
};

const SCHEDULE_SPEECH_MAP_EN: Record<string, string> = {
  '1+0+1': 'one in the morning, one at night',
  '1+1+1': 'one morning, noon, and night',
  '1+0+0': 'one in the morning',
  '0+0+1': 'one at night',
  '0+1+0': 'one at noon',
  '1+1+0': 'one in the morning, one at noon',
  '0+1+1': 'one at noon, one at night',
  '1+1+1+1': 'one four times daily',
  '2+0+2': 'two in the morning, two at night',
  '2+2+2': 'two morning, noon, and night',
  '1/2+0+1/2': 'half in the morning, half at night',
  '1/2+1/2+1/2': 'half in the morning, at noon, and at night',
  'prn': 'as needed',
  'sos': 'in emergency',
};

const DURATION_WORDS_BN: Record<number, string> = {
  1: 'এক দিন',
  2: 'দুই দিন',
  3: 'তিন দিন',
  5: 'পাঁচ দিন',
  7: 'সাত দিন',
  10: 'দশ দিন',
  14: 'চৌদ্দ দিন',
  21: 'একুশ দিন',
  30: 'ত্রিশ দিন',
};

const DURATION_WORDS_EN: Record<number, string> = {
  1: 'for one day',
  2: 'for two days',
  3: 'for three days',
  5: 'for five days',
  7: 'for seven days',
  10: 'for ten days',
  14: 'for fourteen days',
  21: 'for twenty-one days',
  30: 'for thirty days',
};

/**
 * Converts a structured dose item into a clear, natural spoken sentence
 */
export function formatDoseForSpeech(item: StructuredDoseItem, locale: 'bn' | 'en' = 'bn'): string {
  const normSchedule = item.dosingSchedule?.trim().toLowerCase();
  if (!normSchedule || !Object.hasOwn(SCHEDULE_SPEECH_MAP_EN, normSchedule)) {
    const label = item.brandName || item.genericName || (locale === 'bn' ? 'ওষুধ' : 'Medicine');
    return locale === 'bn'
      ? `${label}: ওষুধ নেওয়ার সময় জানতে পর্দায় প্রেসক্রিপশন দেখুন।`
      : `${label}: Please check the prescription on screen for the dosing schedule.`;
  }
  const meal = item.mealTiming?.trim().toLowerCase();

  if (locale === 'bn') {
    const medicineLabel = item.brandName || item.genericName || 'ওষুধ';
    const schedulePhrase = SCHEDULE_SPEECH_MAP_BN[normSchedule];
    let mealPhrase = '';
    if (meal && /আগে|before/.test(meal)) mealPhrase = ', খাওয়ার আগে';
    else if (meal && /সাথে|with/.test(meal)) mealPhrase = ', খাওয়ার সাথে';
    else if (meal && /খালি|empty/.test(meal)) mealPhrase = ', খালি পেটে';
    else if (meal && /পর|after/.test(meal)) mealPhrase = ', খাওয়ার পরে';

    // Duration
    let durationPhrase = '';
    if (item.durationDays && DURATION_WORDS_BN[item.durationDays]) {
      durationPhrase = `, ${DURATION_WORDS_BN[item.durationDays]}`;
    } else if (item.durationText) {
      durationPhrase = `, ${item.durationText}`;
    }

    return `${medicineLabel}: ${schedulePhrase}${mealPhrase}${durationPhrase}।`;
  }

  // English
  const medicineLabel = item.brandName || item.genericName || 'Medicine';
  const schedulePhrase = SCHEDULE_SPEECH_MAP_EN[normSchedule];
  let mealPhrase = '';
  if (meal && /before|আগে/.test(meal)) mealPhrase = ', before meal';
  else if (meal && /with|সাথে/.test(meal)) mealPhrase = ', with meal';
  else if (meal && /empty|খালি/.test(meal)) mealPhrase = ', on an empty stomach';
  else if (meal && /after|পর/.test(meal)) mealPhrase = ', after meal';

  let durationPhrase = '';
  if (item.durationDays && DURATION_WORDS_EN[item.durationDays]) {
    durationPhrase = ` ${DURATION_WORDS_EN[item.durationDays]}`;
  } else if (item.durationText) {
    durationPhrase = ` for ${item.durationText}`;
  }

  return `${medicineLabel}: ${schedulePhrase}${mealPhrase}${durationPhrase}.`;
}

/**
 * Helper to format a single schedule, meal relation, and duration directly for speech
 */
export function formatDoseScheduleSpeech(
  schedule: string,
  mealRelation: string,
  durationDays?: number,
  locale: 'bn' | 'en' = 'bn'
): string {
  return formatDoseForSpeech(
    {
      dosingSchedule: schedule,
      mealTiming: mealRelation,
      durationDays,
    },
    locale
  );
}

/**
 * Converts an entire prescription list into a complete, verified spoken summary
 */
export function formatPrescriptionSpeech(items: StructuredDoseItem[], locale: 'bn' | 'en' = 'bn'): string {
  if (!items || items.length === 0) {
    return locale === 'bn' ? 'কোনো ওষুধ নির্ধারিত নেই।' : 'No medications prescribed.';
  }

  const parts = items.map((it) => formatDoseForSpeech(it, locale));
  const closing =
    locale === 'bn'
      ? 'ওষুধ বন্ধ বা বদলানোর আগে ডাক্তারের সাথে কথা বলুন।'
      : 'Consult your doctor before stopping or modifying any medication.';

  return `${parts.join(' ')} ${closing}`;
}
