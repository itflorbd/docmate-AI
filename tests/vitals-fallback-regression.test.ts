import { describe, it, expect } from 'vitest';
import { caseInput } from '@/lib/case-input';
import type { StructuredPatientInput } from '@/types';
import bn from '../messages/bn.json';
import en from '../messages/en.json';

// Test implementation of abstain logic matching src/app/api/cases/[id]/analyze/route.ts
function checkAbstain(patient: StructuredPatientInput, locale: 'bn' | 'en') {
  const t = (locale === 'bn' ? bn : en).analysisGuard;
  const missing = { why_it_helps: '', which_diagnoses_it_separates: [] };
  const vitals = patient.vitals ?? {};
  const hasRecordedVitals = Object.values(vitals).some((v) => v !== undefined && v !== null && v !== '');
  return {
    status: 'insufficient_evidence',
    confidence: { label: 'insufficient', score: 0, reasoning: t.reason },
    differentials: [],
    missing_information: [
      ...(!hasRecordedVitals
        ? [{ ...missing, id: 'vitals', type: 'exam' as const, text: t.vitals }]
        : []),
      { ...missing, id: 'exam', type: 'question', text: t.exam },
    ],
    red_flags: [],
    summary: t.reason,
  };
}

describe('Patient Intake Vital Signs & Weight Fallback Regression Tests', () => {
  it('1. Untouched fields: creates case without injecting preset vitals or fallback weight', () => {
    const rawPayload = {
      patient_code: 'P-2026-101',
      structured_input: {
        age: 45,
        gender: 'female' as const,
        chief_complaint: 'Fever and fatigue for 3 days',
        symptoms: ['Fever', 'Fatigue'],
        vitals: {},
        // weight_kg omitted
      },
    };

    const parsed = caseInput.safeParse(rawPayload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const { structured_input } = parsed.data;

    // Must NOT have injected preset vitals
    expect(structured_input.weight_kg).toBeUndefined();
    expect(structured_input.vitals.blood_pressure_systolic).toBeUndefined();
    expect(structured_input.vitals.blood_pressure_diastolic).toBeUndefined();
    expect(structured_input.vitals.heart_rate).toBeUndefined();
    expect(structured_input.vitals.temperature_celsius).toBeUndefined();
    expect(structured_input.vitals.respiratory_rate).toBeUndefined();
    expect(structured_input.vitals.spo2_percent).toBeUndefined();

    // Confirm that missing vitals are recognized by the assessment as missing information
    const analysisEn = checkAbstain(structured_input as StructuredPatientInput, 'en');
    const vitalsItemEn = analysisEn.missing_information.find((m) => m.id === 'vitals');
    expect(vitalsItemEn).toBeDefined();
    expect(vitalsItemEn?.text).toBe(en.analysisGuard.vitals);

    const analysisBn = checkAbstain(structured_input as StructuredPatientInput, 'bn');
    const vitalsItemBn = analysisBn.missing_information.find((m) => m.id === 'vitals');
    expect(vitalsItemBn).toBeDefined();
    expect(vitalsItemBn?.text).toBe(bn.analysisGuard.vitals);
  });

  it('2. Cleared fields: cleared vitals do not restore default values', () => {
    // Simulate user clearing inputs (empty vitals object)
    const rawPayload = {
      patient_code: 'P-2026-102',
      structured_input: {
        age: 30,
        gender: 'male' as const,
        chief_complaint: 'Cough',
        vitals: {
          blood_pressure_systolic: undefined,
          blood_pressure_diastolic: undefined,
          heart_rate: undefined,
          temperature_celsius: undefined,
          respiratory_rate: undefined,
          spo2_percent: undefined,
        },
      },
    };

    const parsed = caseInput.safeParse(rawPayload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const { structured_input } = parsed.data;
    expect(structured_input.vitals.blood_pressure_systolic).toBeUndefined();
    expect(structured_input.vitals.heart_rate).toBeUndefined();
    expect(structured_input.vitals.respiratory_rate).toBeUndefined();

    const analysis = checkAbstain(structured_input as StructuredPatientInput, 'en');
    const vitalsMissing = analysis.missing_information.some((m) => m.id === 'vitals');
    expect(vitalsMissing).toBe(true);
  });

  it('3. Explicitly entered readings: preserves all recorded measurements faithfully', () => {
    const rawPayload = {
      patient_code: 'P-2026-103',
      structured_input: {
        age: 58,
        gender: 'male' as const,
        weight_kg: 74.5,
        chief_complaint: 'Severe headache and palpitations',
        symptoms: ['Headache', 'Palpitations'],
        vitals: {
          blood_pressure_systolic: 175,
          blood_pressure_diastolic: 105,
          heart_rate: 112,
          temperature_celsius: 37.8,
          respiratory_rate: 22,
          spo2_percent: 96,
        },
      },
    };

    const parsed = caseInput.safeParse(rawPayload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const { structured_input } = parsed.data;
    expect(structured_input.weight_kg).toBe(74.5);
    expect(structured_input.vitals.blood_pressure_systolic).toBe(175);
    expect(structured_input.vitals.blood_pressure_diastolic).toBe(105);
    expect(structured_input.vitals.heart_rate).toBe(112);
    expect(structured_input.vitals.temperature_celsius).toBe(37.8);
    expect(structured_input.vitals.respiratory_rate).toBe(22);
    expect(structured_input.vitals.spo2_percent).toBe(96);

    // Because vitals ARE recorded, vitals should NOT be flagged as missing
    const analysis = checkAbstain(structured_input as StructuredPatientInput, 'en');
    const vitalsMissing = analysis.missing_information.some((m) => m.id === 'vitals');
    expect(vitalsMissing).toBe(false);
  });

  it('4. Display localization parity: "Not recorded" / "রেকর্ড করা হয়নি"', () => {
    expect(en.intake.notRecorded).toBe('Not recorded');
    expect(bn.intake.notRecorded).toBe('রেকর্ড করা হয়নি');
    expect(en.common.notRecorded).toBe('Not recorded');
    expect(bn.common.notRecorded).toBe('রেকর্ড করা হয়নি');
  });
});
