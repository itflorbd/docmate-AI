import { describe, expect, it } from 'vitest';
import { classifyConflict, differentContexts, passageContext } from '@/lib/guideline-conflict';
import type { StructuredPatientInput } from '@/types';

const drug = { id: 'drug-1', generic_name: 'Metformin' };

function basePatient(overrides: Partial<StructuredPatientInput> = {}): StructuredPatientInput {
  return {
    age: 50,
    gender: 'male',
    chief_complaint: 'Synthetic test case',
    symptoms: [],
    past_medical_history: [],
    current_medicines: [],
    allergies: ['No known drug allergies'],
    vitals: {},
    lab_values: [],
    care_setting: 'outpatient',
    ...overrides,
  };
}

function side(stance: 'recommends' | 'advises_against', sentence: string, id: string) {
  return {
    stance,
    sentence,
    chunkId: id,
    citation: { chunk_id: id, quote: sentence },
  };
}

describe('Task 2: Guideline conflict context dimensions (severity, renal function, region)', () => {
  describe('Severity dimension', () => {
    it('same_context: two passages disagreeing on mild disease block', () => {
      const result = classifyConflict(
        drug,
        [
          side('recommends', 'For adults with mild community-acquired pneumonia, Amoxicillin is recommended.', 's1'),
          side('advises_against', 'For adults with mild community-acquired pneumonia, Amoxicillin should not be used.', 's2'),
        ],
        basePatient({ severity: 'mild' }),
      );
      expect(result).toMatchObject({ kind: 'same_context', blocking: true, applicable_stance: null });
    });

    it('same_context: unclear/adjacent severities (mild vs moderate) stay same_context and block', () => {
      const a = passageContext('For adults with mild pneumonia, Amoxicillin is recommended.');
      const b = passageContext('For adults with moderate pneumonia, Amoxicillin should not be used.');
      expect(differentContexts(a, b)).toBe(false);
    });

    it('different_context: mild vs severe with recorded mild severity resolves to recommends (non-blocking)', () => {
      const result = classifyConflict(
        drug,
        [
          side('recommends', 'For adults with mild pneumonia, Amoxicillin is recommended.', 's1'),
          side('advises_against', 'For adults with severe pneumonia, Amoxicillin should not be used.', 's2'),
        ],
        basePatient({ severity: 'mild' }),
      );
      expect(result).toMatchObject({ kind: 'different_context', blocking: false, applicable_stance: 'recommends' });
    });

    it('needs_information: mild vs severe when severity is not recorded blocks and asks for severity', () => {
      const result = classifyConflict(
        drug,
        [
          side('recommends', 'For adults with mild pneumonia, Amoxicillin is recommended.', 's1'),
          side('advises_against', 'For adults with severe pneumonia, Amoxicillin should not be used.', 's2'),
        ],
        basePatient({ severity: undefined }),
      );
      expect(result).toMatchObject({ kind: 'needs_information', blocking: true, applicable_stance: null });
      expect(result?.needs).toContain('severity');
    });
  });

  describe('Renal function dimension', () => {
    it('same_context: two passages disagreeing for renal impairment block', () => {
      const result = classifyConflict(
        drug,
        [
          side('recommends', 'In adults with renal impairment, Metformin is recommended at reduced dose.', 'r1'),
          side('advises_against', 'In adults with renal impairment, Metformin should not be used.', 'r2'),
        ],
        basePatient({ egfr: 42 }),
      );
      expect(result).toMatchObject({ kind: 'same_context', blocking: true, applicable_stance: null });
    });

    it('different_context: normal renal function vs eGFR < 30 with recorded eGFR 78 resolves to recommends', () => {
      const result = classifyConflict(
        drug,
        [
          side('recommends', 'For adults with normal renal function, Metformin is recommended first-line.', 'r1'),
          side('advises_against', 'For adults with eGFR < 30, Metformin should not be used.', 'r2'),
        ],
        basePatient({ egfr: 78 }),
      );
      expect(result).toMatchObject({ kind: 'different_context', blocking: false, applicable_stance: 'recommends' });
      expect(result?.sides.find((s) => s.stance === 'recommends')?.fit.matches).toContainEqual({
        dimension: 'renal',
        value: 'normal_renal',
        patient: 'egfr:78',
      });
    });

    it('needs_information: normal renal function vs eGFR < 30 with no eGFR recorded blocks and asks for egfr', () => {
      const result = classifyConflict(
        drug,
        [
          side('recommends', 'For adults with normal renal function, Metformin is recommended first-line.', 'r1'),
          side('advises_against', 'For adults with eGFR < 30, Metformin should not be used.', 'r2'),
        ],
        basePatient({ egfr: undefined }),
      );
      expect(result).toMatchObject({ kind: 'needs_information', blocking: true, applicable_stance: null });
      expect(result?.needs).toContain('egfr');
    });
  });

  describe('Region dimension', () => {
    it('same_context: two passages disagreeing in regions with high macrolide resistance block', () => {
      const result = classifyConflict(
        drug,
        [
          side('recommends', 'In regions with high macrolide resistance, Azithromycin is recommended.', 'reg1'),
          side('advises_against', 'In regions with high macrolide resistance, Azithromycin should not be used.', 'reg2'),
        ],
        basePatient({ region: 'high macrolide resistance' }),
      );
      expect(result).toMatchObject({ kind: 'same_context', blocking: true, applicable_stance: null });
    });

    it('same_context: unrelated regions are not assumed disjoint and stay blocking', () => {
      const a = passageContext('In regions with high macrolide resistance, Azithromycin should not be used.');
      const b = passageContext('In regions with endemic malaria, Azithromycin is recommended.');
      expect(differentContexts(a, b)).toBe(false);
    });

    it('different_context: high vs low macrolide resistance with patient in low resistance region resolves to recommends', () => {
      const result = classifyConflict(
        drug,
        [
          side('recommends', 'In regions with low macrolide resistance, Azithromycin is recommended.', 'reg1'),
          side('advises_against', 'In regions with high macrolide resistance, Azithromycin should not be used.', 'reg2'),
        ],
        basePatient({ region: 'low macrolide resistance' }),
      );
      expect(result).toMatchObject({ kind: 'different_context', blocking: false, applicable_stance: 'recommends' });
    });

    it('needs_information: high vs low macrolide resistance with no region recorded blocks and asks for region', () => {
      const result = classifyConflict(
        drug,
        [
          side('recommends', 'In regions with low macrolide resistance, Azithromycin is recommended.', 'reg1'),
          side('advises_against', 'In regions with high macrolide resistance, Azithromycin should not be used.', 'reg2'),
        ],
        basePatient({ region: undefined }),
      );
      expect(result).toMatchObject({ kind: 'needs_information', blocking: true, applicable_stance: null });
      expect(result?.needs).toContain('region');
    });
  });
});
