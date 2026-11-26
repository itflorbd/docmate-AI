import { describe, it, expect } from 'vitest';
import { routeVoiceIntent } from '../src/lib/voice/intent-router';
import {
  parseBloodPressure,
  parseTemperature,
  parseAllNumbers,
  normalizeDigits,
} from '../src/lib/voice/number-parser';
import {
  formatDoseScheduleSpeech,
  formatPrescriptionSpeech,
} from '../src/lib/voice/dose-speech';
import { makeSpeakable, cleanMarkdown } from '../src/lib/voice/speakable';
import { getCachedSpeechAudio, cacheSpeechAudio, getAudioCacheKey } from '../src/lib/voice/audio-cache';
import { matchMedicineNames, levenshteinDistance } from '../src/lib/voice/medicine-matcher';

describe('Voice Assistant Architecture & State Machine Tests', () => {
  describe('1. Intent Routing & Hard Clinical Safety Blocks (AGENTS.md Compliance)', () => {
    it('strictly blocks prescription finalization requests', () => {
      const resBn = routeVoiceIntent('প্রেসক্রিপশন সাইন করে ফাইনাল করে দিন', 'bn');
      expect(resBn.blocked).toBe(true);
      expect(resBn.intent).toBe('blocked_action');
      expect(resBn.speakableResponse).toContain('স্ক্রিনে নিশ্চিত করুন');

      const resEn = routeVoiceIntent('finalize the prescription now', 'en');
      expect(resEn.blocked).toBe(true);
      expect(resEn.intent).toBe('blocked_action');
      expect(resEn.speakableResponse).toContain('confirm this on screen');
    });

    it('strictly blocks allergy removal or modification', () => {
      const res = routeVoiceIntent('এই রোগীর এলার্জির তালিকা থেকে পেনিসিলিন বাদ দিন', 'bn');
      expect(res.blocked).toBe(true);
      expect(res.intent).toBe('blocked_action');

      const res2 = routeVoiceIntent('remove penicillin allergy from patient', 'en');
      expect(res2.blocked).toBe(true);
      expect(res2.intent).toBe('blocked_action');
    });

    it('strictly blocks dosage alterations by voice', () => {
      const res = routeVoiceIntent('রোগীর ওষুধের ডোজ অর্ধেক কমিয়ে দিন', 'bn');
      expect(res.blocked).toBe(true);
      expect(res.intent).toBe('blocked_action');

      const res2 = routeVoiceIntent('alter the dose to double', 'en');
      expect(res2.blocked).toBe(true);
      expect(res2.intent).toBe('blocked_action');
    });

    it('strictly blocks record deletion and permission tampering', () => {
      const res = routeVoiceIntent('delete patient record permanently', 'en');
      expect(res.blocked).toBe(true);
      expect(res.intent).toBe('blocked_action');

      const res2 = routeVoiceIntent('রোগীর সকল হিস্ট্রি মুছে ফেলুন', 'bn');
      expect(res2.blocked).toBe(true);
      expect(res2.intent).toBe('blocked_action');
    });

    it('routes valid navigation commands correctly', () => {
      const nav1 = routeVoiceIntent('নতুন রোগীর ফাইল খুলুন', 'bn');
      expect(nav1.blocked).toBe(false);
      expect(nav1.intent).toBe('navigate');
      expect(nav1.targetRoute).toBe('/patients/new');

      const nav2 = routeVoiceIntent('show evidence and citations', 'en');
      expect(nav2.blocked).toBe(false);
      expect(nav2.intent).toBe('navigate');
      expect(nav2.targetRoute).toBe('action:open_evidence');
    });

    it('routes follow-up answers and read-aloud prompts', () => {
      const followUp = routeVoiceIntent('হ্যাঁ, রাতে কাশি বেশি হয়', 'bn');
      expect(followUp.blocked).toBe(false);
      expect(followUp.intent).toBe('answer_followup');

      const readAloud = routeVoiceIntent('সারসংক্ষেপ পড়ে শোনান', 'bn');
      expect(readAloud.blocked).toBe(false);
      expect(readAloud.intent).toBe('read_aloud');
    });
  });

  describe('2. Deterministic Number & Vitals Parser (Zero LLM Hallucination)', () => {
    it('normalizes Bengali numerals to standard ASCII digits', () => {
      expect(normalizeDigits('১২০/৮০')).toBe('120/80');
      expect(normalizeDigits('বয়স ৪৫ বছর')).toBe('বয়স 45 বছর');
    });

    it('parses blood pressure across English and Bangla speech phrasing', () => {
      const bp1 = parseBloodPressure('১২০/৮০');
      expect(bp1).toEqual({ systolic: 120, diastolic: 80 });

      const bp2 = parseBloodPressure('130 over 85');
      expect(bp2).toEqual({ systolic: 130, diastolic: 85 });

      const bp3 = parseBloodPressure('১৪০ বাই ৯০');
      expect(bp3).toEqual({ systolic: 140, diastolic: 90 });
    });

    it('parses temperature in Celsius and Fahrenheit', () => {
      const t1 = parseTemperature('১০২ ডিগ্রি ফারেনহাইট');
      expect(t1?.value).toBe(102);
      expect(t1?.unit).toBe('F');
      expect(t1?.valueCelsius).toBe(38.9);

      const t2 = parseTemperature('39 celsius');
      expect(t2?.value).toBe(39);
      expect(t2?.unit).toBe('C');
    });

    it('extracts all numbers from complex clinical dictation', () => {
      const nums = parseAllNumbers('Give Tab Napa 500mg 1+0+1 after food for 5 days');
      expect(nums).toContain(500);
      expect(nums).toContain(5);

      const numsBn = parseAllNumbers('রোগীর বয়স পঁয়তাল্লিশ বছর, তিন দিন ধরে তীব্র জ্বর');
      expect(numsBn).toContain(45);
      expect(numsBn).toContain(3);
    });
  });

  describe('3. Deterministic Dose-to-Speech Generation', () => {
    it('converts 1+0+1 dosing schedule to polite Bangla without LLM', () => {
      const speech = formatDoseScheduleSpeech('1+0+1', 'খাবারের পর', 5, 'bn');
      expect(speech).toContain('সকালে একটি, রাতে একটি');
      expect(speech).toContain('খাওয়ার পরে');
      expect(speech).toContain('পাঁচ দিন');
    });

    it('converts 1+1+1 dosing schedule to clear English', () => {
      const speech = formatDoseScheduleSpeech('1+1+1', 'after meal', 7, 'en');
      expect(speech).toContain('one morning, noon, and night');
      expect(speech).toContain('after meal');
      expect(speech).toContain('for seven days');
    });

    it('formats entire prescription list with closing medical disclaimer', () => {
      const fullSpeechBn = formatPrescriptionSpeech(
        [
          {
            brandName: 'Napa',
            strength: '500mg',
            dosingSchedule: '1+0+1',
            mealTiming: 'after_food',
            durationDays: 3,
          },
        ],
        'bn'
      );
      expect(fullSpeechBn).toContain('Napa: সকালে একটি, রাতে একটি');
      expect(fullSpeechBn).toContain('ওষুধ বন্ধ বা বদলানোর আগে ডাক্তারের সাথে কথা বলুন');
    });
  });

  describe('4. Closed-Library Verification (makeSpeakable)', () => {
    it('drops unverified claims completely (Hard Rule: Abstention by Design)', () => {
      const unverified = {
        summary: 'সম্পূর্ণ অপ্রমাণিত ড্রাগ দাবি যা গাইডলাইনে নেই।',
        verified: false,
      };
      const spoken = makeSpeakable(unverified, 'bn');
      expect(spoken).toContain('পর্যাপ্ত প্রমাণ নেই');
      expect(spoken).not.toContain('অপ্রমাণিত ড্রাগ দাবি');
    });

    it('appends citation notice "প্রমাণ স্ক্রিনে আছে" for verified clinical findings', () => {
      const verified = {
        summary: 'রোগীর লক্ষণ অনুযায়ী তীব্র ব্রঙ্কাইটিসের সম্ভাবনা রয়েছে। অ্যান্টিবায়োটিকের তাৎক্ষণিক প্রয়োজন নেই।',
        citations: [{ chunk_id: 'chk-1', quote: 'rest is primary' }],
        verified: true,
      };
      const spoken = makeSpeakable(verified, 'bn');
      expect(spoken).toContain('প্রমাণ স্ক্রিনে আছে');
      expect(spoken).toContain('তীব্র ব্রঙ্কাইটিসের সম্ভাবনা রয়েছে');
    });

    it('caps spoken answer to at most 2 to 3 sentences to keep speech concise', () => {
      const longText = {
        summary: 'প্রথম বাক্য সম্পন্ন। দ্বিতীয় বাক্য সম্পন্ন। তৃতীয় বাক্য এখানে আছে। চতুর্থ বাক্য বাদ যাবে। পঞ্চম বাক্য বাদ যাবে।',
        citations: [{ chunk_id: 'chk-2', quote: 'evidence' }],
        verified: true,
      };
      const spoken = makeSpeakable(longText, 'bn');
      expect(spoken).toContain('প্রথম বাক্য সম্পন্ন');
      expect(spoken).toContain('দ্বিতীয় বাক্য সম্পন্ন');
      expect(spoken).not.toContain('চতুর্থ বাক্য বাদ যাবে');
    });

    it('cleans markdown symbols from spoken text', () => {
      const markdownInput = 'Check **WHO guideline** [1] for *hydration* and `dosage`.';
      const cleaned = cleanMarkdown(markdownInput);
      expect(cleaned).toBe('Check WHO guideline for hydration and dosage.');
    });
  });

  describe('5. Audio Caching & Privacy Ledger', () => {
    it('generates consistent SHA-256 cache keys based on text and voice params', async () => {
      const key1 = await getAudioCacheKey('প্যারাসিটামল ৫০০ মিলিগ্রাম', 'male', 1.0);
      const key2 = await getAudioCacheKey('প্যারাসিটামল ৫০০ মিলিগ্রাম', 'male', 1.0);
      const key3 = await getAudioCacheKey('প্যারাসিটামল ৫০০ মিলিগ্রাম', 'female', 1.0);

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('stores and retrieves cached speech audio in memory', () => {
      const mockKey = 'test-cache-key-12345';
      const mockBuffer = new Uint8Array([1, 2, 3, 4, 5]);

      cacheSpeechAudio(mockKey, mockBuffer);
      const cached = getCachedSpeechAudio(mockKey);
      expect(cached).toBeDefined();
      expect(cached?.length).toBe(5);
    });
  });

  describe('6. Medicine Formulary Matching & Fuzzy Distance', () => {
    it('computes accurate Levenshtein distance', () => {
      expect(levenshteinDistance('Napa', 'Napa')).toBe(0);
      expect(levenshteinDistance('Napa', 'Napo')).toBe(1);
      expect(levenshteinDistance('Amoxicillin', 'Amoxacillin')).toBe(1);
    });

    it('identifies formulary brand and generic names from speech transcripts', () => {
      const matches = matchMedicineNames('Give Tab Napa 500mg and Seclo 20mg daily');
      expect(matches.some((m) => m.brandName === 'Napa')).toBe(true);
      expect(matches.some((m) => m.brandName === 'Seclo')).toBe(true);
    });
  });
});
