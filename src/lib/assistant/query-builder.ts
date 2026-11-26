// src/lib/assistant/query-builder.ts
// DocMate AI - Patient-Aware Multilingual Retrieval Query Builder
// Builds targeted full-text & vector queries combining doctor inquiry, patient context, and canonical medical terminology.

import { StructuredPatientInput } from '@/types';
import { LanguageUnderstandingResult } from '@/lib/language/types';

const SYMPTOM_TO_DIAGNOSES: Record<string, string[]> = {
  cough: ['pneumonia', 'community-acquired pneumonia', 'bronchitis', 'respiratory infection'],
  fever: ['pneumonia', 'dengue', 'sepsis', 'febrile infection'],
  'chest pain': ['acute coronary syndrome', 'angina', 'myocardial infarction', 'pneumonia'],
  dyspnea: ['pneumonia', 'acute respiratory distress', 'asthma', 'COPD'],
  headache: ['dengue', 'hypertension', 'viral infection'],
  vomiting: ['dengue warning signs', 'acute gastroenteritis'],
};

const BANGLA_CLINICAL_MAP: Record<string, string> = {
  'কাশি': 'cough',
  'জ্বর': 'fever',
  'বুকে ব্যথা': 'chest pain',
  'শ্বাসকষ্ট': 'dyspnea',
  'মাথাব্যথা': 'headache',
  'রক্তবমি': 'hematemesis',
  'সায়ানোসিস': 'cyanosis',
  'ডেঙ্গু': 'dengue',
  'উচ্চ রক্তচাপ': 'hypertension',
  'নিউমোনিয়া': 'pneumonia',
};

export interface QueryBuilderOptions {
  doctorText: string;
  patientInput?: StructuredPatientInput;
  languageResult?: LanguageUnderstandingResult;
  action?: 'observation' | 'evidence_review';
}

/**
 * Builds patient-aware queries for hybrid retrieval.
 * Solves Defect 2.7:
 * - Augments generic queries like "top differentials" with patient complaints & symptoms.
 * - Extracts canonical terms (Bangla -> English) from the language layer.
 * - Produces concise, keyword-rich queries that avoid over-constraining full-text search.
 */
export function buildRetrievalQueries(options: QueryBuilderOptions): string[] {
  const { doctorText, patientInput, languageResult, action } = options;
  const queries: string[] = [];
  const trimmed = doctorText.trim();

  // 1. Primary cleaned doctor query
  if (trimmed) {
    queries.push(trimmed);
  }

  // 2. Canonical English query from language layer
  if (languageResult?.canonicalEnglishQuery && languageResult.canonicalEnglishQuery !== trimmed) {
    queries.push(languageResult.canonicalEnglishQuery);
  }

  // 3. Check if query is generic (e.g. "what are the differentials?", "guideline evidence")
  const isGenericClinicalQuery =
    action === 'evidence_review' ||
    /differential|diagnosis|diagnoses|protocol|treatment|management|guideline|evidence|করণীয়|চিকিৎসা|নির্দেশিকা|রোগ নির্ণয়/i.test(
      trimmed
    );

  // 4. Augment with patient clinical context (chief complaint & symptoms)
  if (patientInput) {
    const complaint = patientInput.chief_complaint?.trim() || '';
    const symptoms = (patientInput.symptoms || []).map((s) => s.trim()).filter(Boolean);

    // Combine symptoms with possible differential conditions
    const relatedConditions = new Set<string>();
    for (const symptom of symptoms) {
      const lowerSymptom = symptom.toLowerCase();
      const mapped = SYMPTOM_TO_DIAGNOSES[lowerSymptom];
      if (mapped) {
        mapped.forEach((c) => relatedConditions.add(c));
      }
    }

    if (isGenericClinicalQuery || symptoms.length > 0 || complaint) {
      const contextKeywords = [
        complaint,
        ...symptoms,
        ...Array.from(relatedConditions).slice(0, 3),
      ].filter(Boolean);

      if (contextKeywords.length > 0) {
        // Patient-aware clinical query
        const patientContextQuery = contextKeywords.join(' ');
        if (!queries.includes(patientContextQuery)) {
          queries.push(patientContextQuery);
        }

        // If generic differential question, create a combined differential query
        if (isGenericClinicalQuery) {
          const combinedDiffQuery = `${complaint} ${symptoms.join(' ')} differential diagnosis guideline`.trim();
          if (!queries.includes(combinedDiffQuery)) {
            queries.push(combinedDiffQuery);
          }
        }
      }
    }
  }

  // 5. Check Bangla terms and map to canonical English search terms
  for (const [bnTerm, enTerm] of Object.entries(BANGLA_CLINICAL_MAP)) {
    if (trimmed.includes(bnTerm)) {
      const translated = trimmed.replace(new RegExp(bnTerm, 'g'), enTerm);
      if (!queries.includes(translated) && translated !== trimmed) {
        queries.push(translated);
      }
    }
  }

  // 6. Bangla canonical query
  if (languageResult?.banglaQuery && !queries.includes(languageResult.banglaQuery)) {
    queries.push(languageResult.banglaQuery);
  }

  // Deduplicate and filter empty queries
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const q of queries) {
    const clean = q.replace(/[?.,!;]/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 2 && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      deduped.push(clean);
    }
  }

  return deduped.slice(0, 5); // At most 5 rich queries
}
