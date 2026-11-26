import { describe, expect, it } from 'vitest';
import { caseInput } from '@/lib/case-input';
import { buildTreatmentDraft, type EvidenceChunk } from '@/lib/treatment-draft';
import type { DrugRecord, StructuredPatientInput } from '@/types';

const metformin: DrugRecord = {
  id: 'drug-metformin',
  generic_name: 'Metformin',
  drug_class: 'Biguanide',
  indications: ['Type 2 Diabetes Mellitus'],
  dose_rules: {
    standard_adult: '500 mg orally twice daily',
    route: 'oral',
    frequency: 'Every 12 hours (BD)',
    duration_days: 30,
    max_daily_dose: '2000 mg',
  },
  contraindications: { conditions: [], allergies: [] },
  pregnancy_category: 'B',
  renal_adjustment: {
    egfr_threshold: 30,
    action: 'avoid',
    note: 'Contraindicated when eGFR < 30 mL/min.',
  },
};

const syntheticA: EvidenceChunk = {
  id: 'syn-a',
  sourceTitle: 'SYNTHETIC TEST Guideline A - Type 2 Diabetes Initial Therapy (2025)',
  sourceType: 'guideline',
  lifecycle: 'published',
  sourceYear: 2025,
  sourceVersion: 1,
  section: 'Initial drug therapy',
  page: 1,
  text: 'For adult outpatients with type 2 diabetes mellitus, Metformin is the recommended first-line therapy at diagnosis.',
};

const syntheticB: EvidenceChunk = {
  id: 'syn-b',
  sourceTitle: 'SYNTHETIC TEST Guideline B - Type 2 Diabetes Lifestyle First (2026)',
  sourceType: 'guideline',
  lifecycle: 'published',
  sourceYear: 2026,
  sourceVersion: 2,
  section: 'Initial drug therapy',
  page: 1,
  text: 'For adult outpatients with type 2 diabetes mellitus, Metformin should not be used as first-line therapy.',
};

describe('Task 1: Care setting at intake', () => {
  const basePayload = {
    patient_code: 'P-2026-910',
    structured_input: {
      age: 52,
      gender: 'male' as const,
      chief_complaint: 'Routine diabetes follow-up',
      egfr: 78,
    },
  };

  it('accepts outpatient, inpatient, intensive_care, and unset in caseInput schema, and rejects invalid values', () => {
    for (const setting of ['outpatient', 'inpatient', 'intensive_care'] as const) {
      const parsed = caseInput.safeParse({
        ...basePayload,
        structured_input: { ...basePayload.structured_input, care_setting: setting },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.structured_input.care_setting).toBe(setting);
      }
    }

    const unset = caseInput.safeParse(basePayload);
    expect(unset.success).toBe(true);
    if (unset.success) {
      expect(unset.data.structured_input.care_setting).toBeUndefined();
    }

    const invalid = caseInput.safeParse({
      ...basePayload,
      structured_input: { ...basePayload.structured_input, care_setting: 'home_visit' },
    });
    expect(invalid.success).toBe(false);
  });

  it('builds treatment draft without care_setting need when intake sets care_setting=outpatient, while A+B still classify as same_context (blocking)', () => {
    const parsed = caseInput.parse({
      ...basePayload,
      structured_input: { ...basePayload.structured_input, care_setting: 'outpatient' },
    });
    const draft = buildTreatmentDraft({
      diagnosis: 'Type 2 Diabetes Mellitus',
      patient: parsed.structured_input as unknown as StructuredPatientInput,
      formulary: [metformin],
      interactions: [],
      chunks: [syntheticA, syntheticB],
      activeUrgentFindings: 0,
    });
    expect(draft.conflicts).toHaveLength(1);
    expect(draft.conflicts[0]).toMatchObject({
      generic_name: 'Metformin',
      kind: 'same_context',
      blocking: true,
    });
    expect(draft.conflicts[0].needs).not.toContain('care_setting');
  });

  it('still asks for care_setting in draft when intake leaves care_setting unset', () => {
    const parsed = caseInput.parse(basePayload);
    const draft = buildTreatmentDraft({
      diagnosis: 'Type 2 Diabetes Mellitus',
      patient: parsed.structured_input as unknown as StructuredPatientInput,
      formulary: [metformin],
      interactions: [],
      chunks: [syntheticA, syntheticB],
      activeUrgentFindings: 0,
    });
    expect(draft.conflicts).toHaveLength(1);
    expect(draft.conflicts[0]).toMatchObject({
      generic_name: 'Metformin',
      kind: 'same_context',
      blocking: true,
    });
    expect(draft.conflicts[0].needs).toContain('care_setting');
  });
});
