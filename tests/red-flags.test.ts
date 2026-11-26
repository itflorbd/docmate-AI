// tests/red-flags.test.ts
// Unit tests for deterministic bilingual red-flag detection with negation awareness

import { describe, it, expect } from 'vitest';
import { checkRedFlags } from '@/lib/red-flags';

describe('Deterministic Bilingual Red Flag Safety Engine', () => {
  describe('Positive triggers (Must Fire)', () => {
    it('detects Bangla acute respiratory distress: রোগীর তীব্র শ্বাসকষ্ট হচ্ছে', () => {
      const alerts = checkRedFlags('রোগীর তীব্র শ্বাসকষ্ট হচ্ছে', 'bn');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].title).toContain('জরুরি রেসপিরেটরি রেড ফ্ল্যাগ');
    });

    it('detects Bangla acute coronary pain: বুকে তীব্র ব্যথা', () => {
      const alerts = checkRedFlags('বুকে তীব্র ব্যথা', 'bn');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].title).toContain('জরুরি কার্ডিয়াক রেড ফ্ল্যাগ');
    });

    it('detects English radiating chest pain: chest pain radiating to left arm', () => {
      const alerts = checkRedFlags('Patient reports chest pain radiating to left arm', 'en');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].title).toContain('Critical Cardiac Red Flag');
      expect(alerts[0].description).toContain('Troponin I');
    });

    it('detects English crushing chest pain', () => {
      const alerts = checkRedFlags('Severe crushing chest pain since morning', 'en');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].title).toContain('Critical Cardiac Red Flag');
    });

    it('detects English severe dyspnea and stridor', () => {
      const alerts = checkRedFlags('Patient presenting with severe dyspnea and stridor', 'en');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].title).toContain('Respiratory Red Flag');
    });

    it('detects altered consciousness in Bangla and English', () => {
      const bnAlerts = checkRedFlags('রোগী হঠাৎ অচেতন হয়ে পড়েছে', 'bn');
      expect(bnAlerts).toHaveLength(1);
      expect(bnAlerts[0].title).toContain('নিউরোলজিক্যাল / হেমোডায়নামিক রেড ফ্ল্যাগ');

      const enAlerts = checkRedFlags('Patient is unresponsive and in septic shock', 'en');
      expect(enAlerts).toHaveLength(1);
      expect(enAlerts[0].title).toContain('Critical Neurological / Hemodynamic Red Flag');
    });

    it('detects severe hemorrhage: রক্তবমি and hemoptysis', () => {
      const bnAlerts = checkRedFlags('রোগীর বারবার রক্তবমি হচ্ছে', 'bn');
      expect(bnAlerts).toHaveLength(1);
      expect(bnAlerts[0].title).toContain('জরুরি রক্তক্ষরণ রেড ফ্ল্যাগ');

      const enAlerts = checkRedFlags('Patient has acute hemoptysis and coughing up blood', 'en');
      expect(enAlerts).toHaveLength(1);
      expect(enAlerts[0].title).toContain('Critical Hemorrhage Red Flag');
    });

    it('detects cyanosis in Bangla and English', () => {
      const bnAlerts = checkRedFlags('শরীরে সায়ানোসিস দেখা দিয়েছে এবং ঠোঁট নীল', 'bn');
      expect(bnAlerts).toHaveLength(1);
      expect(bnAlerts[0].title).toContain('জরুরি অক্সিজেন রেড ফ্ল্যাগ');

      const enAlerts = checkRedFlags('Severe peripheral cyanosis noted', 'en');
      expect(enAlerts).toHaveLength(1);
      expect(enAlerts[0].title).toContain('Critical Oxygen Red Flag');
    });

    it('detects Banglish emergencies', () => {
      const alerts = checkRedFlags('patient er tibro shashkoshto hocche', 'bn');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
    });
  });

  describe('Negation awareness (Must NOT Fire)', () => {
    it('does NOT fire on English negation: no chest pain', () => {
      const alerts = checkRedFlags('Patient has mild fever, no chest pain', 'en');
      expect(alerts).toHaveLength(0);
    });

    it('does NOT fire on Bangla negation: বুকে তীব্র ব্যথা নেই', () => {
      const alerts = checkRedFlags('রোগীর হালকা কাশি আছে কিন্তু বুকে তীব্র ব্যথা নেই', 'bn');
      expect(alerts).toHaveLength(0);
    });

    it('does NOT fire on Bangla negation: শ্বাসকষ্ট নেই', () => {
      const alerts = checkRedFlags('জ্বর ৩ দিন, তীব্র শ্বাসকষ্ট নেই', 'bn');
      expect(alerts).toHaveLength(0);
    });

    it('does NOT fire on Banglish negation: buke betha nai', () => {
      const alerts = checkRedFlags('jor ache kintu buke betha nai', 'bn');
      expect(alerts).toHaveLength(0);
    });

    it('does NOT fire on English denies: patient denies severe dyspnea or chest pain', () => {
      const alerts = checkRedFlags('Patient denies severe dyspnea and denies chest pain radiating', 'en');
      expect(alerts).toHaveLength(0);
    });

    it('does NOT fire on absent/without cyanosis', () => {
      const alerts = checkRedFlags('Patient is stable without cyanosis', 'en');
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Mixed / Compound clauses with adversative conjunctions', () => {
    it('fires ONLY for the non-negated clause in Bangla', () => {
      // বুকে ব্যথা নেই (negated) কিন্তু তীব্র শ্বাসকষ্ট আছে (active)
      const alerts = checkRedFlags('রোগীর বুকে ব্যথা নেই, কিন্তু তীব্র শ্বাসকষ্ট আছে', 'bn');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].title).toContain('জরুরি রেসপিরেটরি রেড ফ্ল্যাগ');
      expect(alerts[0].title).not.toContain('কার্ডিয়াক');
    });

    it('fires ONLY for the non-negated clause in English', () => {
      // No chest pain, but severe dyspnea present
      const alerts = checkRedFlags('No chest pain, however severe dyspnea observed', 'en');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].title).toContain('Critical Respiratory Red Flag');
      expect(alerts[0].title).not.toContain('Cardiac');
    });
  });
});
