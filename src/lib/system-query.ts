/**
 * DocMate AI - System & Contextual Query Handler
 * 
 * Handles non-clinical utility inquiries such as current date, time,
 * assistant identity, and capabilities deterministically using Asia/Dhaka local time.
 * Prevents treating conversational utility questions as medical literature queries.
 */

export interface SystemQueryResponse {
  type: 'date' | 'time' | 'date_time' | 'identity';
  answerBn: string;
  answerEn: string;
  speakableBn: string;
  speakableEn: string;
}

// Exact date questions (must not match clinical queries like "date of onset" or "date of surgery")
const DATE_REGEX = /^(?:what\s*(?:is|'s)?\s*(?:the\s+)?(?:current\s+)?date(?:\s+today)?|what\s*(?:is|'s)?\s*today(?:'s)?(?:\s+date)?|today(?:'s)?\s+date|what\s+day\s+is\s+(?:it\s+)?today|which\s+day\s+is\s+today|date\s+today|tell\s+me\s+(?:the\s+)?date|আজ(?:কে)?র?\s*(?:তারিখ|দিন)(?:\s*(?:কত|কি|কী|বলুন|জানান))?|আজ(?:কে)?\s*(?:কত\s*তারিখ|কি\s*বার|কী\s*বার|কোন\s*দিন|কী\s*তারিখ|কি\s*তারিখ)|তারিখ\s*(?:কত|কি|কী)|aj(?:ke)?r?\s*(?:tarikh|date)(?:\s*koto)?|aj\s*ki\s*bar)[?!\s.]*$/iu;

// Exact time questions (must not match clinical queries like "time of ingestion" or "dosage time")
const TIME_REGEX = /^(?:what\s*(?:is|'s)?\s*(?:the\s+)?(?:current\s+)?time(?:\s+now)?|current\s+time|time\s+now|tell\s+me\s+(?:the\s+)?time|what\s+time\s+is\s+it|এখন\s*(?:কয়টা\s*বাজে|সময়\s*কত|কয়টা)|বর্তমান\s*সময়(?:\s*কত)?|কয়টা\s*বাজে|সময়\s*(?:কত|কয়টা)|ekhon\s*(?:koyta\s*baje|shomoy\s*koto|time\s*koto)|current\s*time\s*koto)[?!\s.]*$/iu;

// Combined date and time
const DATE_TIME_REGEX = /^(?:what\s*(?:is|'s)?\s*(?:the\s+)?(?:current\s+)?date\s+(?:and|&)\s+time|date\s+(?:and|&)\s+time|current\s+date\s+and\s+time|আজকে?র?\s*তারিখ\s*(?:ও|এবং|আর)\s*সময়(?:\s*(?:কত|কি|কী))?|তারিখ\s*(?:ও|এবং|আর)\s*সময়(?:\s*(?:কত|কি|কী))?)[?!\s.]*$/iu;

// Identity and assistant role inquiries
const IDENTITY_REGEX = /^(?:who\s+are\s+you|what\s+is\s+your\s+name|what\s+are\s+you|who\s+made\s+you|who\s+created\s+you|tell\s+me\s+about\s+yourself|who\s+is\s+docmate|আপনি\s*কে|তুমি\s*কে|আপনার\s*নাম\s*(?:কি|কী)|তোমার\s*নাম\s*(?:কি|কী)|আপনার\s*পরিচয়\s*(?:কি|কী|দিন)|তোমার\s*পরিচয়\s*(?:কি|কী|দাও)|ডকমেট\s*(?:কি|কী|কে)|tumi\s*ke|apni\s*ke|tomar\s*nam\s*ki|apnar\s*nam\s*ki)[?!\s.]*$/iu;

/**
 * Returns formatted date and time for Asia/Dhaka
 */
export function getDhakaDateTime(date: Date = new Date()) {
  const bnDate = new Intl.DateTimeFormat('bn-BD', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'full',
  }).format(date);

  const enDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'full',
  }).format(date);

  const bnTime = new Intl.DateTimeFormat('bn-BD', {
    timeZone: 'Asia/Dhaka',
    timeStyle: 'short',
  }).format(date);

  const enTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    timeStyle: 'short',
  }).format(date);

  return { bnDate, enDate, bnTime, enTime };
}

/**
 * Detects if user query is a system utility question (date, time, identity)
 * and returns the appropriate deterministic answer.
 */
export function detectSystemQuery(rawInput: string, now: Date = new Date()): SystemQueryResponse | null {
  if (!rawInput) return null;
  const text = rawInput.trim();

  // 1. Combined Date and Time
  if (DATE_TIME_REGEX.test(text)) {
    const { bnDate, enDate, bnTime, enTime } = getDhakaDateTime(now);
    return {
      type: 'date_time',
      answerBn: `আজকের তারিখ ও সময়:\n📅 **তারিখ**: ${bnDate}\n⏰ **সময়**: ${bnTime} (এশিয়া/ঢাকা)`,
      answerEn: `Current Date & Time:\n📅 **Date**: ${enDate}\n⏰ **Time**: ${enTime} (Asia/Dhaka)`,
      speakableBn: `আজ ${bnDate} এবং সময় ${bnTime}।`,
      speakableEn: `Today is ${enDate}, and the current time is ${enTime}.`,
    };
  }

  // 2. Date Only
  if (DATE_REGEX.test(text)) {
    const { bnDate, enDate } = getDhakaDateTime(now);
    return {
      type: 'date',
      answerBn: `আজকের তারিখ:\n📅 **${bnDate}**`,
      answerEn: `Today's date:\n📅 **${enDate}**`,
      speakableBn: `আজকের তারিখ ${bnDate}।`,
      speakableEn: `Today's date is ${enDate}.`,
    };
  }

  // 3. Time Only
  if (TIME_REGEX.test(text)) {
    const { bnTime, enTime } = getDhakaDateTime(now);
    return {
      type: 'time',
      answerBn: `বর্তমান সময়:\n⏰ **${bnTime}** (এশিয়া/ঢাকা সময়)`,
      answerEn: `Current time:\n⏰ **${enTime}** (Asia/Dhaka time)`,
      speakableBn: `এখন সময় ${bnTime}।`,
      speakableEn: `The current time is ${enTime}.`,
    };
  }

  // 4. Identity & Assistant Role
  if (IDENTITY_REGEX.test(text)) {
    const answerBn =
      'আমি **ডকমেট (DocMate)**, আপনার ক্লিনিকাল সিদ্ধান্ত সহায়তা সহকারী। ' +
      'আমি ভেরিফাইড মেডিকেল গাইডলাইন উদ্ধৃতি, ড্রাগ সেফটি চেক এবং রোগীর রেকর্ড ব্যবস্থাপনায় চিকিৎসকদের সহায়তা করি। ' +
      'চূড়ান্ত ক্লিনিকাল সিদ্ধান্ত সর্বদা ডাক্তারের।';

    const answerEn =
      'I am **DocMate (ডকমেট)**, your clinical decision support assistant. ' +
      'I assist healthcare professionals with verified medical guideline citations, drug interaction safety checks, and patient record management. ' +
      'The final clinical decision always remains with the physician.';

    return {
      type: 'identity',
      answerBn,
      answerEn,
      speakableBn: 'আমি ডকমেট, আপনার ক্লিনিকাল সহকারী। চূড়ান্ত সিদ্ধান্ত সর্বদা আপনার।',
      speakableEn: 'I am DocMate, your clinical decision support assistant. The final decision is always yours.',
    };
  }

  return null;
}
