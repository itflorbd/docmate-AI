import { describe, it, expect } from 'vitest';
import { buildRetrievalQueries } from '@/lib/assistant/query-builder';
import { StructuredPatientInput } from '@/types';
import { LanguageUnderstandingResult } from '@/lib/language/types';

describe('Patient-Aware Retrieval Query Builder', () => {
  const patientWithRespSymptoms: StructuredPatientInput = {
    age: 52,
    gender: 'male',
    chief_complaint: 'fever and cough for 5 days',
    symptoms: ['cough', 'fever', 'dyspnea'],
    past_medical_history: ['hypertension'],
    current_medicines: ['Amlodipine 5mg'],
    allergies: [],
    vitals: {
      temperature_celsius: 38.6,
      blood_pressure_systolic: 130,
      blood_pressure_diastolic: 85,
    },
    lab_values: [],
  };

  it('1. Augments generic "differential diagnoses" question with patient context', () => {
    const queries = buildRetrievalQueries({
      doctorText: 'What are the top differential diagnoses based on these findings?',
      patientInput: patientWithRespSymptoms,
    });

    expect(queries.length).toBeGreaterThan(1);
    // Must include the doctor text
    expect(queries[0]).toContain('differential diagnoses');
    // Must include patient complaint and symptoms
    const contextQuery = queries.find((q) => q.includes('fever') && q.includes('cough'));
    expect(contextQuery).toBeDefined();
    // Must map symptoms like cough/dyspnea to probable diagnoses like pneumonia
    const pneumoniaQuery = queries.find((q) => q.toLowerCase().includes('pneumonia'));
    expect(pneumoniaQuery).toBeDefined();
  });

  it('2. Maps Bangla symptom terms to canonical English medical terms', () => {
    const queries = buildRetrievalQueries({
      doctorText: 'রোগীর কাশি ও বুকে ব্যথা হচ্ছে',
      patientInput: patientWithRespSymptoms,
    });

    // Should include original Bangla text
    expect(queries.some((q) => q.includes('কাশি'))).toBe(true);
    // Should produce English mapped terms: cough, chest pain
    expect(queries.some((q) => q.includes('cough') || q.includes('chest pain'))).toBe(true);
  });

  it('3. Integrates canonical query from language layer', () => {
    const mockLangResult: LanguageUnderstandingResult = {
      originalText: 'kashi ar jor 3 din',
      detectedLang: 'banglish',
      dominantLang: 'bn',
      canonicalEnglishQuery: 'cough and fever for 3 days',
      banglaQuery: 'কাশি এবং জ্বর ৩ দিন',
      intent: 'ask_library',
      entities: { symptoms: [], medicines: [], vitals: [], durations: [], numbers: [] },
      ambiguity: { isAmbiguous: false },
      fieldsNeedingConfirmation: [],
      replyLanguage: 'bn',
      retrievalQueries: ['cough fever guidelines'],
    };

    const queries = buildRetrievalQueries({
      doctorText: 'kashi ar jor 3 din',
      languageResult: mockLangResult,
    });

    expect(queries).toContain('cough and fever for 3 days');
    expect(queries).toContain('কাশি এবং জ্বর ৩ দিন');
  });

  it('4. Cleans trailing punctuation and limits max queries to 5', () => {
    const queries = buildRetrievalQueries({
      doctorText: 'Is Amoxicillin indicated for community-acquired pneumonia???',
      patientInput: patientWithRespSymptoms,
    });

    expect(queries.length).toBeLessThanOrEqual(5);
    for (const q of queries) {
      expect(q).not.toMatch(/[?.,!;]$/);
    }
  });
});
