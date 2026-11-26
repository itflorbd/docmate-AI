// src/lib/clinical/follow-up-engine.ts
// DocMate AI — Adaptive Clinical Follow-up Question Engine
// Prioritizes missing diagnostic facts by urgency, avoids repetition, and preserves emergency escalation

import type { StructuredPatientInput, MissingInformation } from '@/types';
import type { ComprehensiveLabReport } from './lab-engine';
import type { MasterDiseaseReasoningOutput } from './disease-reasoning';
import { normalizeQuestion } from '../assistant/context';

export type QuestionUrgency = 'emergency' | 'urgent' | 'diagnostic_separator' | 'routine';

export type ClinicalDimension =
  | 'location_character'
  | 'duration_progression'
  | 'severity_warning_signs'
  | 'associated_symptoms'
  | 'risk_factors_exposure'
  | 'medical_surgical_history'
  | 'physical_examination'
  | 'laboratory_investigation';

export interface AdaptiveQuestion {
  id: string;
  dimension: ClinicalDimension;
  urgency: QuestionUrgency;
  urgencyScore: number; // 1 to 10
  questionEn: string;
  questionBn: string;
  whyItHelpsEn: string;
  whyItHelpsBn: string;
  whichDiagnosesItSeparatesEn: string[];
  whichDiagnosesItSeparatesBn: string[];
  quickAnswersEn: string[];
  quickAnswersBn: string[];
  isEmergencyAlert: boolean;
  emergencyProtocolEn?: string;
  emergencyProtocolBn?: string;
}

export interface AdaptiveQuestioningOutput {
  hasEmergencyEscalation: boolean;
  emergencyWarningEn?: string;
  emergencyWarningBn?: string;
  prioritizedQuestions: AdaptiveQuestion[];
  missingDimensions: ClinicalDimension[];
  suggestedFollowUpForChat: MissingInformation | null;
}

// Helpers
function textMatchesAny(text: string, patterns: (string | RegExp)[]): boolean {
  const norm = text.toLowerCase();
  return patterns.some((p) => {
    if (typeof p === 'string') return norm.includes(p.toLowerCase());
    return p.test(norm);
  });
}

function wasQuestionAskedOrAnswered(
  questionId: string,
  questionText: string,
  answeredQuestionIds: Set<string>,
  pastConversationText: string
): boolean {
  if (answeredQuestionIds.has(questionId)) return true;
  const normQ = normalizeQuestion(questionText);
  if (pastConversationText.includes(normQ)) return true;
  return false;
}

/**
 * Adaptive Clinical Follow-Up Question Engine
 * Synthesizes patient presentation, vitals, labs, and disease reasoning to determine
 * high-yield clinical questions without delaying urgent emergency triage.
 */
export function generateAdaptiveFollowUpQuestions(params: {
  patient: StructuredPatientInput;
  labReport?: ComprehensiveLabReport;
  diseaseReasoning?: MasterDiseaseReasoningOutput;
  answeredQuestionIds?: Set<string>;
  pastConversationText?: string;
  locale?: 'bn' | 'en';
}): AdaptiveQuestioningOutput {
  const {
    patient,
    labReport,
    diseaseReasoning,
    answeredQuestionIds = new Set<string>(),
    pastConversationText = '',
    locale = 'bn',
  } = params;

  const isBn = locale === 'bn';
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
    patient.examination_findings,
    ...(patient.past_medical_history || []),
  ]
    .filter(Boolean)
    .join(' ');

  const vitals = patient.vitals || {};
  const candidates: AdaptiveQuestion[] = [];

  // =========================================================================
  // 1. EMERGENCY ESCALATION GATE
  // If acute life-threats exist, never delay resuscitation for follow-up questions!
  // =========================================================================
  const isHypotensive = vitals.blood_pressure_systolic !== undefined && vitals.blood_pressure_systolic < 90;
  const isHypertensiveCrisis = vitals.blood_pressure_systolic !== undefined && vitals.blood_pressure_systolic >= 180;
  const isCriticalHypoxemia = vitals.spo2_percent !== undefined && vitals.spo2_percent < 90;
  const isSevereTachypnea = vitals.respiratory_rate !== undefined && vitals.respiratory_rate >= 32;
  const isSevereDengueShock = diseaseReasoning?.dengueAssessment.dengueClassification === 'severe';
  const hasAcsSigns = textMatchesAny(fullText, ['crushing chest pain', 'substernal', 'radiating to arm', 'radiation to jaw']);
  const hasPeritonealSigns = textMatchesAny(fullText, ['board-like', 'guarding', 'rebound tenderness', 'peritonitis']);

  const hasEmergency =
    Boolean(diseaseReasoning?.hasEmergency) ||
    Boolean(diseaseReasoning?.criticalAlerts && diseaseReasoning.criticalAlerts.length > 0) ||
    Boolean(labReport?.hasCriticalAlerts) ||
    isHypotensive ||
    isHypertensiveCrisis ||
    isCriticalHypoxemia ||
    isSevereTachypnea ||
    isSevereDengueShock ||
    (hasAcsSigns && (vitals.heart_rate !== undefined && vitals.heart_rate > 100)) ||
    hasPeritonealSigns;

  let emergencyWarningEn: string | undefined;
  let emergencyWarningBn: string | undefined;

  if (hasEmergency) {
    emergencyWarningEn =
      '🚨 IMMEDIATE RESUSCITATION REQUIRED: Severe hemodynamic or critical warning signs detected. Do not delay urgent escalation, oxygenation, or IV access while collecting follow-up answers!';
    emergencyWarningBn =
      '🚨 অবিলম্বে জরুরি পদক্ষেপ ও চিকিৎসা প্রয়োজন: গুরুতর বিপদ সংকেত শনাক্ত হয়েছে। প্রশ্নোত্তরের অপেক্ষায় সময়ক্ষেপণ না করে দ্রুত হাসপাতালে ভর্তি ও প্রাথমিক চিকিৎসা নিশ্চিত করুন!';
  }

  // =========================================================================
  // 2. DIMENSION A: SYMPTOM LOCATION & CHARACTER
  // =========================================================================
  if (textMatchesAny(fullText, ['chest pain', 'বুকে ব্যথা', 'chest tightness'])) {
    candidates.push({
      id: 'q-chest-pain-character',
      dimension: 'location_character',
      urgency: 'urgent',
      urgencyScore: 9,
      questionEn: 'Where exactly is the chest pain located, and does it radiate to the left shoulder, arm, neck, or lower jaw?',
      questionBn: 'বুকের ব্যথাটি ঠিক কোন জায়গায় অনুভূত হচ্ছে এবং এটি কি বাম বাহু, কাঁধ, ঘাড় বা চোয়ালে ছড়ায়?',
      whyItHelpsEn: 'Differentiates ischemic Acute Coronary Syndrome (retrosternal pressure with radiation) from pleuritic or musculoskeletal chest pain.',
      whyItHelpsBn: 'হার্ট অ্যাটাক (ACS) বনাম ফুসফুসের প্লুরাইটিক বা পেশির ব্যথা আলাদা করতে সাহায্য করে।',
      whichDiagnosesItSeparatesEn: ['Acute Coronary Syndrome / STEMI', 'Pleurisy / Pneumonia', 'Gastroesophageal Reflux'],
      whichDiagnosesItSeparatesBn: ['অ্যাকিউট করোনারি সিন্ড্রোম (হার্ট অ্যাটাক)', 'প্লুরিসি / নিউমোনিয়া', 'গ্যাস্ট্রিক আলসার'],
      quickAnswersEn: ['Substernal heavy pressure radiating to left arm', 'Sharp localized pain worsening with deep breathing', 'Burning epigastric pain'],
      quickAnswersBn: ['বুকের মাঝে ভারী চাপ যা বাম হাতে ছড়ায়', 'তীক্ষ্ণ ব্যথা যা গভীর নিঃশ্বাসে বাড়ে', 'বুকের নিচে জ্বালাপোড়া'],
      isEmergencyAlert: false,
    });
  }

  if (textMatchesAny(fullText, ['abdominal pain', 'পেটে ব্যথা', 'stomach pain'])) {
    candidates.push({
      id: 'q-abdominal-pain-location',
      dimension: 'location_character',
      urgency: 'urgent',
      urgencyScore: 8,
      questionEn: 'Which quadrant of the abdomen is the pain concentrated in, and did it migrate (e.g. from periumbilical to right lower quadrant)?',
      questionBn: 'পেটের কোন অংশে ব্যথা বেশি এবং ব্যথাটি কি স্থানান্তর হয়েছে (যেমন: নাভির চারপাশ থেকে ডান তলপেটে)?',
      whyItHelpsEn: 'Migration to the right lower quadrant strongly indicates Acute Appendicitis, while epigastric radiation to the back suggests Acute Pancreatitis.',
      whyItHelpsBn: 'ডান তলপেটে ব্যথার স্থানান্তর অ্যাকিউট অ্যাপেন্ডিসাইটিস এবং পেটের মাঝখান থেকে পিঠে ছড়ানো প্যানক্রিয়াটাইটিস নির্দেশ করে।',
      whichDiagnosesItSeparatesEn: ['Acute Appendicitis', 'Acute Pancreatitis', 'Acute Gastroenteritis'],
      whichDiagnosesItSeparatesBn: ['অ্যাকিউট অ্যাপেন্ডিসাইটিস', 'অ্যাকিউট প্যানক্রিয়াটাইটিস', 'ডায়রিয়া / গ্যাস্ট্রোএন্টেরাইটিস'],
      quickAnswersEn: ['Migrated from navel to Right Lower Quadrant (RLQ)', 'Severe epigastric pain radiating to back', 'Generalized cramping pain with diarrhea'],
      quickAnswersBn: ['নাভি থেকে ডান তলপেটে স্থানান্তরিত ব্যথা', 'পেটের উপরিভাগে তীব্র ব্যথা যা পিঠে ছড়ায়', 'পেট কামড়ানো ও পাতলা পায়খানা'],
      isEmergencyAlert: false,
    });
  }

  // =========================================================================
  // 3. DIMENSION B: DURATION & PROGRESSION (CRITICAL FOR DENGUE & INFECTIONS)
  // =========================================================================
  const hasFever = textMatchesAny(fullText, ['fever', 'জ্বর', 'febrile', 'pyrexia']);
  const hasDocumentedFeverDays = /\b(\d+)\s*(?:day|days|দিন)\b/i.test(fullText);

  if (hasFever && !hasDocumentedFeverDays) {
    candidates.push({
      id: 'q-fever-duration-exact',
      dimension: 'duration_progression',
      urgency: 'urgent',
      urgencyScore: 9,
      questionEn: 'Exactly how many days has the fever been present, and is it currently rising, continuous, or subsiding?',
      questionBn: 'জ্বর কত দিন ধরে চলছে এবং এটি কি ক্রমাগত বাড়ছে, সমান থাকছে নাকি কমতির দিকে?',
      whyItHelpsEn: 'Critical for Dengue triage: Days 1–3 represent the viremic phase (NS1 window); Days 4–6 represent the critical plasma leakage phase where defervescence occurs with shock risk.',
      whyItHelpsBn: 'ডেঙ্গু মূল্যায়নে অত্যন্ত গুরুত্বপূর্ণ: ১ম-৩য় দিন অ্যান্টিজেন (NS1) উইন্ডো এবং ৪র্থ-৬ষ্ঠ দিন প্লাজমা ক্ষরণ ও শকের ক্রিটিক্যাল ফেজ।',
      whichDiagnosesItSeparatesEn: ['Dengue Critical Phase vs Febrile Phase', 'Malaria Paroxysm', 'Viral URI'],
      whichDiagnosesItSeparatesBn: ['ডেঙ্গু ক্রিটিক্যাল ফেজ বনাম প্রাথমিক জ্বর', 'ম্যালেরিয়া', 'সাধারণ ভাইরাল জ্বর'],
      quickAnswersEn: ['Day 1 to 2 (Sudden high fever)', 'Day 3 to 4 (Continuous high fever)', 'Day 5 or more (Fever dropping but feeling weak)'],
      quickAnswersBn: ['১-২ দিন (হঠাৎ তীব্র জ্বর)', '৩-৪ দিন (ক্রমাগত জ্বর)', '৫ দিন বা বেশি (জ্বর কমছে কিন্তু দুর্বলতা বেশি)'],
      isEmergencyAlert: false,
    });
  }

  // =========================================================================
  // 4. DIMENSION C: SEVERITY & WHO WARNING SIGNS
  // =========================================================================
  if (hasFever || textMatchesAny(fullText, ['dengue', 'ডেঙ্গু', 'thrombocytopenia'])) {
    candidates.push({
      id: 'q-dengue-who-warning-signs',
      dimension: 'severity_warning_signs',
      urgency: 'urgent',
      urgencyScore: 9,
      questionEn: 'Are there any WHO dengue warning signs present: persistent vomiting, intense abdominal pain, bleeding from gums/nose, extreme lethargy, or black stools?',
      questionBn: 'ডেঙ্গুর কোনো সতর্ক সংকেত আছে কি: ঘনঘন বমি, তীব্র পেট ব্যথা, মাড়ি বা নাক দিয়ে রক্তপাত, অতিরিক্ত অস্থিরতা/তন্দ্রাচ্ছন্নতা, বা কালো পায়খানা?',
      whyItHelpsEn: 'The presence of any single WHO warning sign reclassifies Dengue into "Dengue with Warning Signs" or "Severe Dengue" mandating immediate hospital admission.',
      whyItHelpsBn: 'যেকোনো একটি সতর্ক সংকেত থাকলে রোগীকে অবিলম্বে হাসপাতালে ভর্তি করে আইভি স্যালাইন চালু করতে হবে।',
      whichDiagnosesItSeparatesEn: ['Dengue with Warning Signs / Severe Dengue', 'Uncomplicated Viral Syndrome'],
      whichDiagnosesItSeparatesBn: ['সতর্ক সংকেতযুক্ত তীব্র ডেঙ্গু', 'সাধারণ ভাইরাল জ্বর'],
      quickAnswersEn: ['Yes: Persistent vomiting and intense abdominal pain', 'Yes: Bleeding from gums or nose', 'No warning signs present; tolerating oral fluids'],
      quickAnswersBn: ['হ্যাঁ: ঘন ঘন বমি ও তীব্র পেট ব্যথা', 'হ্যাঁ: মাড়ি বা নাক দিয়ে রক্তক্ষরণ', 'না: কোনো বিপদ সংকেত নেই, মুখে তরল খেতে পারছে'],
      isEmergencyAlert: false,
    });
  }

  // =========================================================================
  // 5. DIMENSION D: ASSOCIATED SYMPTOMS (DYSPNEA, AUTONOMIC, SENSORIUM)
  // =========================================================================
  if (textMatchesAny(fullText, ['cough', 'কাশি', 'shortness of breath', 'শ্বাসকষ্ট'])) {
    candidates.push({
      id: 'q-respiratory-sputum-dyspnea',
      dimension: 'associated_symptoms',
      urgency: 'urgent',
      urgencyScore: 8,
      questionEn: 'Is the cough productive of colored (purulent or rust-colored) sputum, and is the patient breathless while resting or talking?',
      questionBn: 'কাশি কি কফযুক্ত (হলুদ, সবুজ বা লালচে কফ) এবং রোগী কি বিশ্রামে থাকা অবস্থায় বা কথা বলতে গিয়ে হাঁপাচ্ছে?',
      whyItHelpsEn: 'Purulent/rusty sputum with dyspnea distinguishes Community-Acquired Pneumonia with consolidation from uncomplicated viral bronchitis.',
      whyItHelpsBn: 'কফযুক্ত কাশি ও শ্বাসকষ্ট নিউমোনিয়া এবং সাধারণ ব্রঙ্কাইটিস আলাদা করতে সাহায্য করে।',
      whichDiagnosesItSeparatesEn: ['Community-Acquired Pneumonia (CAP)', 'Acute Bronchitis', 'Upper Respiratory Tract Infection'],
      whichDiagnosesItSeparatesBn: ['নিউমোনিয়া (CAP)', 'অ্যাকিউট ব্রঙ্কাইটিস', 'ভাইরাল ফ্লু'],
      quickAnswersEn: ['Productive rust/green sputum with resting breathlessness', 'Dry persistent cough without resting dyspnea', 'Whitish mucoid phlegm with wheezing'],
      quickAnswersBn: ['হলুদ/লালচে কফ ও বিশ্রামে শ্বাসকষ্ট', 'শুকনো কাশি, শ্বাসকষ্ট নেই', 'সাদা কফ ও বুকে শাঁ শাঁ শব্দ'],
      isEmergencyAlert: false,
    });
  }

  // =========================================================================
  // 6. DIMENSION E: RISK FACTORS & EXPOSURES (TRAVEL, COMORBIDITIES)
  // =========================================================================
  if (hasFever && !textMatchesAny(fullText, ['travel', 'endemic', 'chittagong', 'bandarban', 'cox', 'sylhet', 'পাহাড়', 'ভ্রমণ'])) {
    candidates.push({
      id: 'q-travel-endemic-exposure',
      dimension: 'risk_factors_exposure',
      urgency: 'diagnostic_separator',
      urgencyScore: 7,
      questionEn: 'Has the patient traveled to or resided in malaria-endemic hilly or forested regions (e.g. CHT, Cox’s Bazar, Sylhet) within the past 4 weeks?',
      questionBn: 'রোগী কি গত ৪ সপ্তাহের মধ্যে ম্যালেরিয়া প্রবণ পাহাড়ি বা বনাঞ্চলে (যেমন: পার্বত্য চট্টগ্রাম, কক্সবাজার, সিলেট) ভ্রমণ করেছেন?',
      whyItHelpsEn: 'Crucial exposure risk factor to include or exclude Plasmodium falciparum / vivax malaria in acute febrile syndromes with chills.',
      whyItHelpsBn: 'কাঁপুনী দিয়ে জ্বরের ক্ষেত্রে ম্যালেরিয়া নিশ্চিত বা বাতিল করতে ভ্রমণ ইতিহাস অত্যন্ত জরুরি।',
      whichDiagnosesItSeparatesEn: ['Malaria (P. falciparum / vivax)', 'Dengue Fever', 'Enteric Fever (Typhoid)'],
      whichDiagnosesItSeparatesBn: ['ম্যালেরিয়া', 'ডেঙ্গু জ্বর', 'টাইফয়েড জ্বর'],
      quickAnswersEn: ['Yes: Traveled to Chittagong Hill Tracts / Bandarban recently', 'No: Resident in urban area without travel history'],
      quickAnswersBn: ['হ্যাঁ: সম্প্রতি পাহাড়ি এলাকায় ভ্রমণ করেছেন', 'না: শহরে অবস্থান, ভ্রমণের ইতিহাস নেই'],
      isEmergencyAlert: false,
    });
  }

  // =========================================================================
  // 7. DIMENSION F: PAST MEDICAL & MEDICATION HISTORY (CKD vs AKI, DM)
  // =========================================================================
  const scrItem = labReport?.items.find((i) => i.key === 'creatinine');
  const hasElevatedScr = scrItem && (scrItem.classification === 'high' || scrItem.classification === 'critical');

  if (hasElevatedScr && !textMatchesAny(fullText, ['baseline creatinine', 'pre-illness', 'বেসলাইন ক্রিয়েটিনিন', 'আগের ক্রিয়েটিনিন'])) {
    candidates.push({
      id: 'q-creatinine-baseline-history',
      dimension: 'medical_surgical_history',
      urgency: 'urgent',
      urgencyScore: 8,
      questionEn: 'What was the patient’s pre-illness baseline serum creatinine, and is there a known prior history of Chronic Kidney Disease (CKD) or regular NSAID use?',
      questionBn: 'অসুস্থতার আগে রোগীর স্বাভাবিক সিরাম ক্রিয়েটিনিন কত ছিল এবং পূর্বে কিডনি রোগ (CKD) বা ব্যথানাশক (NSAIDs) খাওয়ার ইতিহাস আছে কি?',
      whyItHelpsEn: 'Distinguishes reversible Acute Kidney Injury (KDIGO criteria: $\ge 0.3$ mg/dL rise) from established Chronic Kidney Disease, guiding nephrotoxic drug cessation.',
      whyItHelpsBn: 'অ্যাকিউট কিডনি ইনজুরি (AKI) বনাম ক্রনিক কিডনি ডিজিজ (CKD) আলাদা করতে এবং কিডনির ক্ষতিকর ওষুধ বন্ধ করতে জরুরি।',
      whichDiagnosesItSeparatesEn: ['Acute Kidney Injury (AKI)', 'Chronic Kidney Disease (CKD) Stage 3-5'],
      whichDiagnosesItSeparatesBn: ['অ্যাকিউট কিডনি ইনজুরি (AKI)', 'ক্রনিক কিডনি ডিজিজ (CKD)'],
      quickAnswersEn: ['Baseline creatinine was normal (< 1.0 mg/dL)', 'Known baseline CKD with prior creatinine ~1.8 mg/dL', 'No prior tests available; history of frequent painkiller use'],
      quickAnswersBn: ['আগে স্বাভাবিক ছিল (< ১.০ mg/dL)', 'পূর্বে কিডনি রোগ ছিল (আগের ক্রিয়েটিনিন ~১.৮)', 'আগের টেস্ট নেই, নিয়মিত ব্যথানাশক খাওয়ার ইতিহাস আছে'],
      isEmergencyAlert: false,
    });
  }

  // =========================================================================
  // 8. DIMENSION G: PHYSICAL EXAMINATION FINDINGS (AUSCULTATION, ABDOMEN)
  // =========================================================================
  if (textMatchesAny(fullText, ['cough', 'কাশি', 'breath', 'শ্বাসকষ্ট']) && !patient.examination_findings) {
    candidates.push({
      id: 'q-chest-auscultation-exam',
      dimension: 'physical_examination',
      urgency: 'urgent',
      urgencyScore: 8,
      questionEn: 'What are the chest auscultation findings: are there unilateral crackles/bronchial breathing, bilateral polyphonic wheezing, or clear breath sounds?',
      questionBn: 'স্টেথোস্কোপে ফুসফুসের শব্দ কেমন: একপাশে ক্রেপিটেশন (Crackles), দুইপাশে বাঁশির মত হুইজ (Wheeze), নাকি স্বাভাবিক শব্দ?',
      whyItHelpsEn: 'Direct physical discriminator: Focal crepitations point to alveolar consolidation (Pneumonia); diffuse wheeze points to bronchospasm (Asthma/COPD).',
      whyItHelpsBn: 'একপাশের ক্রেপিটেশন নিউমোনিয়া নির্দেশ করে এবং হুইজ অ্যাজমা বা সিওপিডি নির্দেশ করে।',
      whichDiagnosesItSeparatesEn: ['Community-Acquired Pneumonia', 'Asthma / COPD Exacerbation', 'Acute Bronchitis'],
      whichDiagnosesItSeparatesBn: ['নিউমোনিয়া (Pneumonia)', 'হাঁপানি / সিওপিডি (Asthma/COPD)', 'ব্রঙ্কাইটিস'],
      quickAnswersEn: ['Focal crackles / bronchial breathing present', 'Bilateral expiratory wheezing', 'Clear bilateral breath sounds'],
      quickAnswersBn: ['বুকে ক্রেপিটেশন (Crackles) বিদ্যমান', 'দুইপাশে হুইজ (Wheeze) বিদ্যমান', 'ফুসফুসের শ্বাসের শব্দ স্বাভাবিক'],
      isEmergencyAlert: false,
    });
  }

  // =========================================================================
  // 9. DIMENSION H: MISSING LABORATORY EVIDENCE
  // =========================================================================
  const hasPlt = labReport?.items.some((i) => i.key === 'platelets');
  const hasHct = labReport?.items.some((i) => i.key === 'hematocrit');

  if (hasFever && (!hasPlt || !hasHct)) {
    candidates.push({
      id: 'q-cbc-platelet-hematocrit-order',
      dimension: 'laboratory_investigation',
      urgency: 'urgent',
      urgencyScore: 9,
      questionEn: 'Has a Complete Blood Count (CBC) with Platelet count and Hematocrit been performed today to check for thrombocytopenia and hemoconcentration?',
      questionBn: 'প্লাটিলেট ঘাটতি ও রক্ত ঘন হওয়া (হেমাটোক্রিট) যাচাই করতে আজ কি সিবিসি পরীক্ষা করানো হয়েছে?',
      whyItHelpsEn: 'Baseline and serial CBC is mandatory to detect thrombocytopenia ($< 100,000$) and plasma leakage ($\ge 20\%$ rise in HCT) during febrile illness.',
      whyItHelpsBn: 'ডেঙ্গুতে প্লাটিলেট কমে যাওয়া এবং প্লাজমা লিকেজ শনাক্ত করতে সিবিসি ও হেমাটোক্রিট পরীক্ষা অপরিহার্য।',
      whichDiagnosesItSeparatesEn: ['Dengue Fever / Plasma Leakage', 'Mild Viral Syndrome', 'Sepsis'],
      whichDiagnosesItSeparatesBn: ['ডেঙ্গু জ্বর / প্লাজমা ক্ষরণ', 'সাধারণ ভাইরাল ইনফেকশন', 'সেপসিস'],
      quickAnswersEn: ['CBC ordered and pending result', 'Platelets 85,000 and HCT 43% reported today', 'Not done yet'],
      quickAnswersBn: ['সিবিসি রিপোর্ট প্রক্রিয়াধীন', 'আজকের প্লাটিলেট ৮৫,০০০ ও হেমাটোক্রিট ৪৩%', 'এখনও করানো হয়নি'],
      isEmergencyAlert: false,
    });
  }

  // Filter out any questions already asked or answered
  const unasked = candidates.filter(
    (q) => !wasQuestionAskedOrAnswered(q.id, isBn ? q.questionBn : q.questionEn, answeredQuestionIds, pastConversationText)
  );

  // Sort by urgency score descending (10 -> 1)
  unasked.sort((a, b) => b.urgencyScore - a.urgencyScore);

  // Find remaining missing clinical dimensions
  const coveredDimensions = new Set(unasked.map((q) => q.dimension));
  const missingDimensions: ClinicalDimension[] = Array.from(coveredDimensions);

  // Suggested top question formatted as MissingInformation for the chat UI
  let suggestedFollowUpForChat: MissingInformation | null = null;
  const topQ = unasked[0];
  if (topQ) {
    suggestedFollowUpForChat = {
      id: topQ.id,
      type: topQ.dimension === 'physical_examination' ? 'exam' : topQ.dimension === 'laboratory_investigation' ? 'test' : 'question',
      text: isBn ? topQ.questionBn : topQ.questionEn,
      why_it_helps: isBn ? topQ.whyItHelpsBn : topQ.whyItHelpsEn,
      which_diagnoses_it_separates: isBn ? topQ.whichDiagnosesItSeparatesBn : topQ.whichDiagnosesItSeparatesEn,
      quick_answers: isBn ? topQ.quickAnswersBn : topQ.quickAnswersEn,
    };
  }

  return {
    hasEmergencyEscalation: hasEmergency,
    emergencyWarningEn,
    emergencyWarningBn,
    prioritizedQuestions: unasked,
    missingDimensions,
    suggestedFollowUpForChat,
  };
}
