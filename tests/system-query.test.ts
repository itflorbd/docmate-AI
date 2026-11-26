import { describe, it, expect } from 'vitest';
import { detectSystemQuery, getDhakaDateTime } from '../src/lib/system-query';

describe('DocMate AI System & Contextual Query Handler', () => {
  const fixedDate = new Date('2026-11-22T21:05:00+06:00');

  describe('1. Date Queries', () => {
    it('accurately detects "what is the date today ?" in English', () => {
      const res = detectSystemQuery('what is the date today ?', fixedDate);
      expect(res).not.toBeNull();
      expect(res?.type).toBe('date');
      expect(res?.answerEn).toContain('22 November 2026');
      expect(res?.speakableEn).toContain('22 November 2026');
    });

    it('accurately detects variations of today date in English', () => {
      const variations = [
        'what is the date today',
        "what's today's date?",
        "what is today's date",
        "today's date",
        'date today',
        'what is the date?',
        'tell me the date',
        'what day is today',
      ];

      for (const v of variations) {
        const res = detectSystemQuery(v, fixedDate);
        expect(res, `Failed for: "${v}"`).not.toBeNull();
        expect(res?.type).toBe('date');
      }
    });

    it('accurately detects date queries in Bangla', () => {
      const bnVariations = [
        'আজকের তারিখ কত ?',
        'আজকে কত তারিখ?',
        'আজ কত তারিখ',
        'আজকের তারিখ কি?',
        'আজ কি বার?',
        'তারিখ কত?',
      ];

      for (const v of bnVariations) {
        const res = detectSystemQuery(v, fixedDate);
        expect(res, `Failed for Bangla: "${v}"`).not.toBeNull();
        expect(res?.type).toBe('date');
        expect(res?.answerBn).toContain('২২ নভেম্বর');
      }
    });

    it('does NOT falsely match clinical inquiries containing the word "date"', () => {
      const clinicalQueries = [
        'what is the date of symptom onset?',
        'date of surgery',
        'expiry date of amoxicillin',
        'what is the date of last chemotherapy cycle?',
        'লক্ষণ শুরুর তারিখ কি?',
      ];

      for (const q of clinicalQueries) {
        const res = detectSystemQuery(q, fixedDate);
        expect(res, `Should NOT be system query: "${q}"`).toBeNull();
      }
    });
  });

  describe('2. Time Queries', () => {
    it('accurately detects "what time is it ?" in English', () => {
      const res = detectSystemQuery('what time is it ?', fixedDate);
      expect(res).not.toBeNull();
      expect(res?.type).toBe('time');
      expect(res?.answerEn).toContain('9:05 PM');
      expect(res?.speakableEn).toContain('9:05 PM');
    });

    it('accurately detects time queries in Bangla', () => {
      const bnTimeVariations = [
        'এখন কয়টা বাজে ?',
        'এখন সময় কত?',
        'বর্তমান সময় কত?',
        'সময় কত?',
        'কয়টা বাজে?',
      ];

      for (const v of bnTimeVariations) {
        const res = detectSystemQuery(v, fixedDate);
        expect(res, `Failed for Bangla time: "${v}"`).not.toBeNull();
        expect(res?.type).toBe('time');
        expect(res?.answerBn).toContain('সময়');
      }
    });

    it('does NOT falsely match clinical inquiries containing the word "time"', () => {
      const clinicalTimeQueries = [
        'what was the time of ingestion of paracetamol?',
        'prothrombin time reference range',
        'clotting time in dengue patient',
        'সময়মতো অ্যান্টিবায়োটিক দেওয়ার নিয়ম কি?',
      ];

      for (const q of clinicalTimeQueries) {
        const res = detectSystemQuery(q, fixedDate);
        expect(res, `Should NOT be system query: "${q}"`).toBeNull();
      }
    });
  });

  describe('3. Combined Date and Time Queries', () => {
    it('detects date and time combination', () => {
      const res = detectSystemQuery('what is the date and time ?', fixedDate);
      expect(res).not.toBeNull();
      expect(res?.type).toBe('date_time');
      expect(res?.answerEn).toContain('22 November 2026');
      expect(res?.answerEn).toContain('9:05 PM');
    });

    it('detects Bangla date and time combination', () => {
      const res = detectSystemQuery('আজকের তারিখ ও সময় কত?', fixedDate);
      expect(res).not.toBeNull();
      expect(res?.type).toBe('date_time');
      expect(res?.answerBn).toContain('২২ নভেম্বর');
    });
  });

  describe('4. Identity & Role Queries', () => {
    it('detects identity queries in English and Bangla', () => {
      const identityQueries = [
        'who are you ?',
        'what is your name?',
        'tell me about yourself',
        'who is docmate?',
        'আপনি কে ?',
        'তোমার নাম কি?',
        'আপনার পরিচয় দিন',
      ];

      for (const q of identityQueries) {
        const res = detectSystemQuery(q, fixedDate);
        expect(res, `Failed for identity: "${q}"`).not.toBeNull();
        expect(res?.type).toBe('identity');
        expect(res?.answerBn).toContain('ডকমেট');
        expect(res?.answerEn).toContain('DocMate');
      }
    });
  });

  describe('5. Dhaka Timezone Formatting', () => {
    it('formats date and time accurately for Asia/Dhaka', () => {
      const { bnDate, enDate, bnTime, enTime } = getDhakaDateTime(fixedDate);
      expect(enDate).toBe('Sunday, 22 November 2026');
      expect(bnDate).toContain('২২ নভেম্বর');
      expect(enTime).toBe('9:05 PM');
      expect(bnTime).toContain('৯:০৫');
    });
  });
});
