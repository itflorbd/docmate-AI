import { describe, it, expect } from 'vitest';
import { extractClinicalFacts } from '@/lib/clinical-extractor';
import { StructuredPatientInput } from '@/types';

describe('Clinical Fact Extractor (Natural Language to Proposed Patient Record Updates)', () => {
  const basePatient: StructuredPatientInput = {
    age: 45,
    gender: 'female',
    chief_complaint: 'Fever and cough',
    symptoms: ['cough'],
    past_medical_history: [],
    current_medicines: [],
    allergies: [],
    vitals: {},
    lab_values: [],
  };

  it('extracts temperature in Celsius with original wording', () => {
    const text = 'Patient has a high temperature of 38.8 C since this morning.';
    const updates = extractClinicalFacts(text, basePatient);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      field_path: 'vitals.temperature_celsius',
      value: 38.8,
      display_value: '38.8 °C',
      status: 'pending',
    });
    expect(updates[0].original_wording.toLowerCase()).toContain('temperature of 38.8 c');
  });

  it('extracts temperature in Fahrenheit and converts accurately', () => {
    const text = 'Patient is febrile, recorded temp 101.5 F at home.';
    const updates = extractClinicalFacts(text, basePatient);

    expect(updates).toHaveLength(1);
    expect(updates[0].field_path).toBe('vitals.temperature_celsius');
    expect(updates[0].value).toBe(38.6); // (101.5 - 32) * 5/9 = 38.61 -> 38.6
    expect(updates[0].display_value).toContain('38.6 °C (101.5 °F)');
  });

  it('extracts blood pressure accurately', () => {
    const text = 'Clinic triage vitals: BP 135/85 mmHg recorded while sitting.';
    const updates = extractClinicalFacts(text, basePatient);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      field_path: 'vitals.blood_pressure',
      value: '135/85',
      display_value: '135/85 mmHg',
      status: 'pending',
    });
    expect(updates[0].original_wording).toContain('BP 135/85');
  });

  it('extracts heart rate, oxygen saturation, and respiratory rate together', () => {
    const text = 'Pulse 102 bpm, SpO2 94% on room air, respiratory rate 24 /min.';
    const updates = extractClinicalFacts(text, basePatient);

    expect(updates).toHaveLength(3);
    const hr = updates.find((u) => u.field_path === 'vitals.heart_rate');
    const spo2 = updates.find((u) => u.field_path === 'vitals.spo2_percent');
    const rr = updates.find((u) => u.field_path === 'vitals.respiratory_rate');

    expect(hr).toBeDefined();
    expect(hr?.value).toBe(102);

    expect(spo2).toBeDefined();
    expect(spo2?.value).toBe(94);

    expect(rr).toBeDefined();
    expect(rr?.value).toBe(24);
  });

  it('extracts newly mentioned presenting symptoms and skips already recorded ones', () => {
    // basePatient already has 'cough', so it should extract 'dyspnea' and 'chest pain', but not duplicate 'cough'
    const text = 'Patient reports cough, shortness of breath, and sharp pleuritic chest pain.';
    const updates = extractClinicalFacts(text, basePatient);

    const symptomUpdates = updates.filter((u) => u.field_path === 'symptoms');
    expect(symptomUpdates.map((s) => s.value)).toEqual(
      expect.arrayContaining(['dyspnea', 'chest pain'])
    );
    expect(symptomUpdates.some((s) => s.value === 'cough')).toBe(false);
  });

  it('extracts documented drug allergies', () => {
    const text = 'Patient family states she is allergic to penicillin and amoxicillin.';
    const updates = extractClinicalFacts(text, basePatient);

    const allergy = updates.find((u) => u.field_path === 'allergies');
    expect(allergy).toBeDefined();
    expect(allergy?.value).toContain('penicillin');
    expect(allergy?.status).toBe('pending');
  });

  it('leaves unrecorded information completely unknown and returns empty array on general text', () => {
    const text = 'Discussed management plan with the patient. Will review again tomorrow morning.';
    const updates = extractClinicalFacts(text, basePatient);

    expect(updates).toEqual([]);
  });

  it('extracts Bangla script vitals: বিপি ১২০/৮০, পালস ৭৬', () => {
    const text = 'বিপি ১২০/৮০, পালস ৭৬, তাপমাত্রা স্বাভাবিক';
    const updates = extractClinicalFacts(text, basePatient);

    const bp = updates.find((u) => u.field_path === 'vitals.blood_pressure');
    const hr = updates.find((u) => u.field_path === 'vitals.heart_rate');

    expect(bp).toBeDefined();
    expect(bp?.value).toBe('120/80');
    expect(hr).toBeDefined();
    expect(hr?.value).toBe(76);
  });

  it('rejects out-of-range physiological nonsense (e.g. temperature 12C or HR 999)', () => {
    const text = 'Recorded temp 12 C and pulse 999.';
    const updates = extractClinicalFacts(text, basePatient);

    expect(updates).toEqual([]);
  });
});
