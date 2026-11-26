// src/lib/language/types.ts
// DocMate AI - Multilingual Language Layer Core Types

export type SupportedLanguage = 'bn' | 'en' | 'banglish' | 'mixed';
export type DominantLanguage = 'bn' | 'en';
export type ReplyLanguage = 'bn' | 'en' | 'banglish';

export interface LanguageSegment {
  text: string;
  lang: 'bn' | 'en' | 'banglish';
  start: number;
  end: number;
}

export interface LanguageDetectionResult {
  lang: SupportedLanguage;
  dominantLang: DominantLanguage;
  confidence: number; // 0.0 - 1.0
  banglaCharRatio: number;
  latinCharRatio: number;
  banglishWordRatio: number;
  segments: LanguageSegment[];
}

export interface ExtractedSymptom {
  name: string;
  canonicalEn: string;
  present: boolean; // true = present, false = negated (absent)
  duration?: string;
  durationDays?: number;
  rawText: string;
}

export interface ExtractedMedicine {
  name: string;
  canonicalEn: string;
  brandOrGeneric: 'brand' | 'generic';
  dose?: string;
  frequency?: string;
  rawText: string;
}

export interface ExtractedVital {
  type: 'bp' | 'temperature' | 'pulse' | 'spo2' | 'weight' | 'respiratory_rate';
  value: string;
  numericValue?: number;
  unit?: string;
  rawText: string;
}

export interface ExtractedDuration {
  rawText: string;
  value: number;
  unit: 'hour' | 'day' | 'week' | 'month' | 'year';
  daysEquivalent: number;
}

export interface AmbiguityInfo {
  isAmbiguous: boolean;
  reason?: string;
  clarifyingQuestionBn?: string;
  clarifyingQuestionEn?: string;
  quickChips?: Array<{
    labelBn: string;
    labelEn: string;
    value: string;
  }>;
}

export type LanguageIntent =
  | 'ask_library'
  | 'medicine_lookup'
  | 'dictate_intake'
  | 'answer_followup'
  | 'navigate'
  | 'ask_capabilities'
  | 'patient_history'
  | 'greeting'
  | 'other';

export interface LanguageUnderstandingResult {
  originalText: string;
  detectedLang: SupportedLanguage;
  dominantLang: DominantLanguage;
  canonicalEnglishQuery: string;
  banglaQuery: string;
  intent: LanguageIntent;
  entities: {
    symptoms: ExtractedSymptom[];
    medicines: ExtractedMedicine[];
    vitals: ExtractedVital[];
    durations: ExtractedDuration[];
    numbers: number[];
  };
  ambiguity: AmbiguityInfo;
  fieldsNeedingConfirmation: string[];
  replyLanguage: ReplyLanguage;
  retrievalQueries: string[];
  cached?: boolean;
}

export interface TermVariantMap {
  bn?: string[];
  banglish?: string[];
  en?: string[];
  bn_translit_en?: string[];
}

export interface TermAliasRecord {
  id: string;
  canonical_en: string;
  category: string;
  variants: TermVariantMap;
  status: 'active' | 'pending';
  notes?: string;
}
