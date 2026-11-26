// tests/language-layer.test.ts
import { describe, it, expect } from 'vitest';
import {
  preprocessText,
  convertBanglaDigitsToAscii,
  detectLanguage,
  matchTerms,
  restoreTransliteratedTerms,
  isTermNegated,
  splitClauses,
  extractNumbers,
  extractDurations,
  extractVitals,
  isCapabilitiesQuery,
  getCapabilitiesExplanation,
  segmentForSpeech,
  transliterateBanglishToBangla,
  understandText,
} from '../src/lib/language';

describe('Phase 8: Multilingual Language Layer Core Tests', () => {
  describe('1. Preprocessor & Digit Normalization', () => {
    it('normalizes Unicode NFC and trims whitespace', () => {
      const input = '  রোগীর তিন দিন ধরে জ্বর \u200B ';
      const prep = preprocessText(input);
      expect(prep.normalized).toBe('রোগীর তিন দিন ধরে জ্বর');
      expect(prep.lowercased).toBe('রোগীর তিন দিন ধরে জ্বর');
    });

    it('converts Bengali digits to ASCII digits', () => {
      expect(convertBanglaDigitsToAscii('৩ দিন')).toBe('3 দিন');
      expect(convertBanglaDigitsToAscii('১০২ ডিগ্রি')).toBe('102 ডিগ্রি');
      expect(convertBanglaDigitsToAscii('১২০/৮০ mmHg')).toBe('120/80 mmHg');
    });
  });

  describe('2. Language Detection (Bangla, English, Banglish, Mixed)', () => {
    it('detects pure Bangla script', () => {
      const res = detectLanguage('রোগীর তিন দিন ধরে জ্বর');
      expect(res.lang).toBe('bn');
      expect(res.dominantLang).toBe('bn');
      expect(res.confidence).toBeGreaterThan(0.9);
    });

    it('detects pure English clinical inquiry', () => {
      const res = detectLanguage('What is the first-line treatment of pneumonia?');
      expect(res.lang).toBe('en');
      expect(res.dominantLang).toBe('en');
      expect(res.confidence).toBeGreaterThan(0.85);
    });

    it('detects Banglish (romanized Bangla) inquiries', () => {
      const res1 = detectLanguage('pneumonia er first line treatment ki?');
      expect(res1.lang).toBe('banglish');
      expect(res1.dominantLang).toBe('bn');

      const res2 = detectLanguage('jor nai kintu kashi ache 5 din');
      expect(res2.lang).toBe('banglish');
      expect(res2.dominantLang).toBe('bn');
    });

    it('detects Mixed code-switching (Bangla script + Latin words)', () => {
      const res = detectLanguage('রোগীর তিন দিন ধরে jor ar kashi, কাঁপুনি নেই');
      expect(res.lang).toBe('mixed');
      expect(res.dominantLang).toBe('bn');
    });
  });

  describe('3. Clinical Term Matcher & Transliteration Restoration', () => {
    it('matches symptoms in Bangla script', () => {
      const matches = matchTerms('রোগীর তীব্র মাথা ব্যথা এবং জ্বর আছে');
      const canonicals = matches.map((m) => m.canonicalEn);
      expect(canonicals).toContain('headache');
      expect(canonicals).toContain('fever');
    });

    it('matches symptoms in Banglish', () => {
      const matches = matchTerms('rogir kashi ar matha betha ache');
      const canonicals = matches.map((m) => m.canonicalEn);
      expect(canonicals).toContain('cough');
      expect(canonicals).toContain('headache');
    });

    it('restores browser STT transliterated English terms (bn_translit_en)', () => {
      const text = 'রোগীর ফিভার রয়েছে এবং অ্যামোক্সিসিলিন দিতে হবে';
      const restored = restoreTransliteratedTerms(text);
      expect(restored).toContain('fever');
      expect(restored).toContain('amoxicillin');
    });
  });

  describe('4. Deterministic Negation Scope Engine (Safety Critical)', () => {
    it('splits clauses on adversatives (kintu / কিন্তু)', () => {
      const clauses = splitClauses('jor nai kintu kashi ache 5 din');
      expect(clauses.length).toBe(2);
      expect(clauses[0].text).toContain('jor nai');
      expect(clauses[1].text).toContain('kashi ache 5 din');
    });

    it('correctly isolates negation in Banglish split clause', () => {
      const text = 'jor nai kintu kashi ache 5 din';
      // Term 'jor' is at 0..3
      const jorNeg = isTermNegated(text, 0, 3);
      expect(jorNeg.isNegated).toBe(true);
      expect(jorNeg.matchedMarker).toBe('nai');

      // Term 'kashi' is at 16..21
      const kashiNeg = isTermNegated(text, 16, 21);
      expect(kashiNeg.isNegated).toBe(false);
    });

    it('correctly identifies post-position negation in Bangla script', () => {
      const text = 'কাশি আছে তবে কাঁপুনি নেই';
      // কাঁপুনি is negated by নেই
      const kapuniIndex = text.indexOf('কাঁপুনি');
      const res = isTermNegated(text, kapuniIndex, kapuniIndex + 7);
      expect(res.isNegated).toBe(true);
      expect(res.matchedMarker).toBe('নেই');
    });

    it('correctly identifies pre-position negation in English', () => {
      const text = 'patient has persistent cough but no fever';
      const feverIndex = text.indexOf('fever');
      const res = isTermNegated(text, feverIndex, feverIndex + 5);
      expect(res.isNegated).toBe(true);
      expect(res.matchedMarker).toBe('no');
    });
  });

  describe('5. Deterministic Numbers, Durations & Vitals', () => {
    it('extracts numbers and number words in Bengali and Banglish', () => {
      const nums = extractNumbers('রোগীর ৩ দিন ধরে জ্বর, ৫ বার বমি হয়েছে');
      expect(nums).toContain(3);
      expect(nums).toContain(5);

      const wordNums = extractNumbers('tin din dhore jor');
      expect(wordNums).toContain(3);
    });

    it('extracts duration with standard unit normalization', () => {
      const durs = extractDurations('রোগীর ৩ দিন ধরে জ্বর');
      expect(durs.length).toBeGreaterThanOrEqual(1);
      expect(durs[0].value).toBe(3);
      expect(durs[0].unit).toBe('day');
      expect(durs[0].daysEquivalent).toBe(3);
    });

    it('extracts vitals correctly (BP, Temperature)', () => {
      const vitals = extractVitals('বিপি ১৩০/৮৫ এবং জ্বর ১০২°F');
      const bp = vitals.find((v) => v.type === 'bp');
      const temp = vitals.find((v) => v.type === 'temperature');

      expect(bp?.value).toBe('130/85');
      expect(temp?.value).toBe('102');
      expect(temp?.unit).toBe('°F');
    });
  });

  describe('6. Capabilities Inquiry ("What can you see?")', () => {
    it('identifies capabilities query in Banglish', () => {
      const q = 'tmi ki dekhte paro how much efficient this is ?';
      expect(isCapabilitiesQuery(q)).toBe(true);
    });

    it('returns honest, deterministic response declaring vision boundaries', () => {
      const { replyText, ambiguity } = getCapabilitiesExplanation('bn');
      expect(replyText).toContain('আমি শুধুমাত্র এই মুহূর্তে খোলা রোগীর কেস এবং আমাদের অভ্যন্তরীণ ভেরিফাইড ক্লিনিক্যাল লাইব্রেরি');
      expect(replyText).toContain('আমি ইন্টারনেট, বাইরের কোনো ফাইল বা আপনার স্ক্রিন দেখতে পারি না');
      expect(ambiguity.isAmbiguous).toBe(true);
      expect(ambiguity.quickChips?.length).toBeGreaterThan(0);
    });
  });

  describe('7. Bilingual Speech Segmenter & Phonetic Typing', () => {
    it('segments mixed bilingual text into bn and en spans for TTS', () => {
      const text = 'রোগীর নিউমোনিয়া (Pneumonia) রয়েছে। First-line চিকিৎসা Amoxicillin।';
      const segments = segmentForSpeech(text);
      expect(segments.length).toBeGreaterThanOrEqual(2);
      expect(segments.some((s) => s.lang === 'bn')).toBe(true);
      expect(segments.some((s) => s.lang === 'en')).toBe(true);
    });

    it('transliterates Banglish typing to Bengali script', () => {
      expect(transliterateBanglishToBangla('ami daktar')).toBe('আমি ডাক্তার');
      expect(transliterateBanglishToBangla('kashi ar jor')).toBe('কাশি আর জ্বর');
    });
  });

  describe('8. End-to-End Language Understanding Pipeline', () => {
    it('processes "jor nai kintu kashi ache 5 din" with full clinical precision', async () => {
      const result = await understandText('jor nai kintu kashi ache 5 din', { skipCache: true });

      expect(result.detectedLang).toBe('banglish');
      expect(result.dominantLang).toBe('bn');

      // Fever must be absent (negated)
      const fever = result.entities.symptoms.find((s) => s.canonicalEn === 'fever');
      expect(fever).toBeDefined();
      expect(fever?.present).toBe(false);

      // Cough must be present
      const cough = result.entities.symptoms.find((s) => s.canonicalEn === 'cough');
      expect(cough).toBeDefined();
      expect(cough?.present).toBe(true);
      expect(cough?.duration).toContain('5 din');

      // Canonical English query must be generated
      expect(result.canonicalEnglishQuery.toLowerCase()).toContain('cough');
      expect(result.retrievalQueries.length).toBeGreaterThanOrEqual(1);
    });

    it('processes "tmi ki dekhte paro how much efficient this is ?" cleanly', async () => {
      const result = await understandText('tmi ki dekhte paro how much efficient this is ?', { skipCache: true });
      expect(result.intent).toBe('ask_capabilities');
      expect(result.ambiguity.isAmbiguous).toBe(true);
      expect(result.ambiguity.quickChips?.length).toBeGreaterThan(0);
    });
  });
});
