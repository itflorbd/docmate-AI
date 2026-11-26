import { describe, it, expect, beforeEach } from 'vitest';
import {
  selectPhrase,
  resetSessionVariantHistory,
  getTimeOfDayDhaka,
  formatDoctorTitle,
  PHRASEBANK_DATA,
} from '../src/lib/persona/phrasebank';

describe('Phrase Bank & Selector Architecture', () => {
  beforeEach(() => {
    resetSessionVariantHistory();
  });

  it('1. Phrase bank has at least 8 reviewed variants for all 17 categories in BN and EN', () => {
    const categories = [
      'greeting',
      'acknowledge',
      'thinking',
      'understood',
      'clarify',
      'confirm_readback',
      'success',
      'small_error',
      'big_error',
      'no_evidence',
      'alert_intro',
      'disagree_respected',
      'thanks_reply',
      'goodbye',
      'waiting_long',
      'limit_reached',
      'first_use_welcome',
    ] as const;

    for (const cat of categories) {
      const bnVariants = PHRASEBANK_DATA.filter((p) => p.category === cat && p.locale === 'bn');
      const enVariants = PHRASEBANK_DATA.filter((p) => p.category === cat && p.locale === 'en');

      expect(
        bnVariants.length,
        `Category '${cat}' in BN must have at least 8 variants, found ${bnVariants.length}`
      ).toBeGreaterThanOrEqual(8);

      expect(
        enVariants.length,
        `Category '${cat}' in EN must have at least 8 variants, found ${enVariants.length}`
      ).toBeGreaterThanOrEqual(8);
    }
  });

  it('2. Enforces deterministic selection when seed is provided', () => {
    const p1 = selectPhrase('acknowledge', 'bn', { seed: 42, sessionId: 's-1' });
    const p2 = selectPhrase('acknowledge', 'bn', { seed: 42, sessionId: 's-2' });
    expect(p1).toBe(p2);

    const p3 = selectPhrase('thinking', 'en', { seed: 99, sessionId: 's-3' });
    const p4 = selectPhrase('thinking', 'en', { seed: 99, sessionId: 's-4' });
    expect(p3).toBe(p4);
  });

  it('3. Never repeats the same variant within the last 5 turns in a session', () => {
    const sessionId = 'test-session-no-repeat';
    const seen = new Set<string>();

    // Call 5 times
    for (let i = 0; i < 5; i++) {
      const phrase = selectPhrase('acknowledge', 'bn', { sessionId, seed: i * 7 + 1 });
      expect(seen.has(phrase)).toBe(false);
      seen.add(phrase);
    }
    expect(seen.size).toBe(5);
  });

  it('4. Correctly formats Doctor Title across all address styles', () => {
    expect(formatDoctorTitle('doctor', 'bn')).toBe('ডাক্তার');
    expect(formatDoctorTitle('doctor_sahib', 'bn')).toBe('ডাক্তার সাহেব');
    expect(formatDoctorTitle('doctor_madam', 'bn')).toBe('ডাক্তার ম্যাডাম');
    expect(formatDoctorTitle('name', 'bn', 'ফারহানা রহমান')).toBe('ডাঃ ফারহানা রহমান');
    expect(formatDoctorTitle('name', 'bn', 'ডাঃ তানভীর আহমেদ')).toBe('ডাঃ তানভীর আহমেদ');

    expect(formatDoctorTitle('doctor', 'en')).toBe('Doctor');
    expect(formatDoctorTitle('name', 'en', 'Farhana Rahman')).toBe('Dr. Farhana Rahman');
  });

  it('5. Computes correct Time of Day in Asia/Dhaka', () => {
    // 09:00 UTC = 15:00 Dhaka (+6h) -> afternoon
    const dateAfternoon = new Date('2026-11-22T09:00:00Z');
    expect(getTimeOfDayDhaka(dateAfternoon)).toBe('afternoon');

    // 01:00 UTC = 07:00 Dhaka (+6h) -> morning
    const dateMorning = new Date('2026-11-22T01:00:00Z');
    expect(getTimeOfDayDhaka(dateMorning)).toBe('morning');

    // 13:00 UTC = 19:00 Dhaka (+6h) -> evening
    const dateEvening = new Date('2026-11-22T13:00:00Z');
    expect(getTimeOfDayDhaka(dateEvening)).toBe('evening');

    // 20:00 UTC = 02:00 Dhaka next day (+6h) -> night
    const dateNight = new Date('2026-11-22T20:00:00Z');
    expect(getTimeOfDayDhaka(dateNight)).toBe('night');
  });

  it('6. Substitutes placeholders correctly in phrases', () => {
    const greeting = selectPhrase('greeting', 'bn', {
      timeOfDay: 'morning',
      preset: 'friendly',
      doctorTitle: 'ডাঃ ফারহানা',
      seed: 1,
    });
    expect(greeting).toContain('ডাঃ ফারহানা');

    const clarify = selectPhrase('clarify', 'bn', {
      preset: 'friendly',
      substitutions: { detail: 'প্যারাসিটামল ৫০০ মিগ্রা' },
      seed: 2,
    });
    expect(clarify).toContain('প্যারাসিটামল ৫০০ মিগ্রা');
  });
});
