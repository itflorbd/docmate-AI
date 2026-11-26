// src/lib/clinical/disease-reasoning.ts
// DocMate AI — Specialized Evidence-Based Disease Reasoning Engine
// Structured Clinical Modules for High-Risk & High-Frequency Conditions

import type { StructuredPatientInput } from '@/types';
import type { ComprehensiveLabReport } from './lab-engine';
import { calculateCurb65 } from './calculators';

export type DiseaseId =
  | 'dengue'
  | 'cap'
  | 'malaria'
  | 'influenza'
  | 'covid19'
  | 'diabetes'
  | 'hypertension'
  | 'kidney_disease'
  | 'liver_disease'
  | 'cardiovascular_acs'
  | 'gastrointestinal_acute_abdomen'
  | 'respiratory_asthma_copd';

export type DiagnosticClassification =
  | 'confirmed'
  | 'suspected'
  | 'differential'
  | 'unconfirmed_impression';

export type ClinicalAcuity =
  | 'emergency'
  | 'urgent'
  | 'needs_prompt_review'
  | 'routine_followup';

export type ConfidenceLevel = 'high' | 'moderate' | 'low' | 'insufficient';

export interface GuidelineCitation {
  title: string;
  organization: string;
  year: number;
  url?: string;
  summary: string;
}

export interface DiseaseEvaluationResult {
  diseaseId: DiseaseId;
  diseaseName: string;
  diseaseNameBn: string;
  classification: DiagnosticClassification;
  acuity: ClinicalAcuity;
  confidence: ConfidenceLevel;
  confidenceExplanationEn: string;
  confidenceExplanationBn: string;
  supportingSymptoms: string[];
  supportingLabs: string[];
  contradictoryFindings: string[];
  missingInformation: string[];
  recommendedInvestigationsEn: string[];
  recommendedInvestigationsBn: string[];
  redFlags: string[];
  clinicalProtocolEn: string;
  clinicalProtocolBn: string;
  hospitalizationReferralCriteria: string[];
  guidelineSources: GuidelineCitation[];
  customMeta?: Record<string, unknown>;
}

export interface DengueSpecializedAssessment {
  isDengueCandidate: boolean;
  dengueClassification: 'suspected' | 'with_warning_signs' | 'severe' | null;
  dayOfIllness: number | null;
  dayOfTesting: number | null;
  ns1Status: 'positive' | 'negative' | 'indeterminate' | 'not_tested';
  ns1WindowValid: boolean;
  ns1FalseNegativeWarning: boolean;
  plasmaLeakageDetected: boolean;
  thrombocytopeniaSeverity: 'none' | 'mild' | 'moderate' | 'severe';
  warningSignsIdentified: string[];
  warningSignsIdentifiedBn: string[];
  urgentActionRequired: boolean;
  fluidGuidanceEn: string;
  fluidGuidanceBn: string;
}

export interface MasterDiseaseReasoningOutput {
  dengueAssessment: DengueSpecializedAssessment;
  evaluatedDiseases: DiseaseEvaluationResult[];
  rankedDifferentials: DiseaseEvaluationResult[];
  criticalAlerts: string[];
  criticalAlertsBn: string[];
  hasEmergency: boolean;
  missingInformationOverall: string[];
}

// Helpers for text and symptom extraction
function textContainsAny(text: string, patterns: (string | RegExp)[]): boolean {
  return patterns.some((p) => {
    if (typeof p === 'string') {
      return text.toLowerCase().includes(p.toLowerCase());
    }
    return p.test(text);
  });
}

function extractIllnessDays(text: string): number | null {
  const match = text.match(/(\d+)\s*(?:day|days|দিন|d\b)/i);
  if (match) {
    const val = parseInt(match[1], 10);
    if (!isNaN(val) && val > 0 && val < 60) return val;
  }
  return null;
}

/**
 * 1. Dengue Specialized Reasoning Module
 * Evaluates WHO dengue classification, diagnostic testing windows (NS1 days 1-3 vs IgM day 4+),
 * plasma leakage (falling PLT + rising HCT >= 20%), and WHO warning signs.
 */
export function evaluateDengueModule(
  patient: StructuredPatientInput,
  labReport?: ComprehensiveLabReport
): { assessment: DengueSpecializedAssessment; evaluation: DiseaseEvaluationResult | null } {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
  ]
    .filter(Boolean)
    .join(' ');

  const illnessDays = extractIllnessDays(fullText);

  // NS1 Lab Check
  let ns1Status: 'positive' | 'negative' | 'indeterminate' | 'not_tested' = 'not_tested';
  if (labReport) {
    if (labReport.dengueRiskSignatures.ns1Positive) ns1Status = 'positive';
    else if (labReport.dengueRiskSignatures.ns1Negative) ns1Status = 'negative';
  } else if (patient.lab_values) {
    for (const lv of patient.lab_values) {
      const tName = (lv as { test_name?: string }).test_name || lv.name || '';
      if (/ns1|dengue/i.test(tName)) {
        const valStr = String(lv.value).toLowerCase();
        if (valStr.includes('pos') || valStr.includes('reactive') || valStr.includes('পজিটিভ')) {
          ns1Status = 'positive';
        } else if (valStr.includes('neg') || valStr.includes('non-reactive') || valStr.includes('নেগেটিভ')) {
          ns1Status = 'negative';
        }
      }
    }
  }

  // Symptom matching
  const hasFever = textContainsAny(fullText, ['fever', 'জ্বর', 'febrile', 'pyrexia', 'temp']);
  const hasHeadacheRetroOrbital = textContainsAny(fullText, [
    'retro-orbital',
    'headache',
    'চোখের পেছনে ব্যথা',
    'মাথাব্যথা',
    'eye pain',
  ]);
  const hasMyalgia = textContainsAny(fullText, ['myalgia', 'body ache', 'গা ব্যথা', 'bone pain', 'break-bone', 'arthralgia']);
  const hasRash = textContainsAny(fullText, ['rash', 'petichiae', 'র‍্যাশ', 'লাল দাগ']);

  // Warning signs per WHO
  const warningSigns: string[] = [];
  const warningSignsBn: string[] = [];

  if (textContainsAny(fullText, ['severe abdominal pain', 'abdominal tenderness', 'পেটে তীব্র ব্যথা', 'পেটে ব্যথা'])) {
    warningSigns.push('Severe abdominal pain or tenderness');
    warningSignsBn.push('তীব্র পেট ব্যথা বা পেটে স্পর্শকাতরতা');
  }
  if (textContainsAny(fullText, ['persistent vomiting', 'ক্রমাগত বমি', 'vomiting 3', 'বার বার বমি'])) {
    warningSigns.push('Persistent vomiting');
    warningSignsBn.push('ক্রমাগত বা ঘনঘন বমি');
  }
  if (textContainsAny(fullText, ['mucosal bleed', 'epistaxis', 'gum bleed', 'রক্তক্ষরণ', 'মাড়ি থেকে রক্ত', 'নাক দিয়ে রক্ত', 'melena'])) {
    warningSigns.push('Mucosal bleeding');
    warningSignsBn.push('মিউকোসাল রক্তক্ষরণ (মাড়ি বা নাক দিয়ে রক্তপাত)');
  }
  if (textContainsAny(fullText, ['lethargy', 'restlessness', 'অস্থিরতা', 'তন্দ্রাচ্ছন্নতা', 'extreme weakness', 'prostration'])) {
    warningSigns.push('Lethargy or severe restlessness');
    warningSignsBn.push('অতিরিক্ত অবসাদ, তন্দ্রাচ্ছন্নতা বা অস্থিরতা');
  }
  if (textContainsAny(fullText, ['fluid accumulation', 'ascites', 'pleural effusion', 'ফুসফুসে পানি', 'পেটে পানি'])) {
    warningSigns.push('Clinical fluid accumulation (pleural effusion / ascites)');
    warningSignsBn.push('শরীরে তরল সঞ্চয়ন (প্লুরাল ইফিউশন বা অ্যাসাইটিস)');
  }
  if (textContainsAny(fullText, ['hepatomegaly', 'liver enlargement', 'যকৃত বৃদ্ধি', 'লিভার বড়'])) {
    warningSigns.push('Liver enlargement > 2 cm');
    warningSignsBn.push('যকৃত ২ সেমি বা ততোধিক বৃদ্ধি');
  }

  // Lab analysis for Dengue
  let thrombocytopeniaSeverity: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
  let plasmaLeakage = false;
  const supportingLabs: string[] = [];
  const contradictoryFindings: string[] = [];

  if (labReport) {
    const pltItem = labReport.items.find((i) => i.key === 'platelets');
    if (pltItem && pltItem.normalizedNumericValue !== null) {
      const val = pltItem.normalizedNumericValue;
      if (val < 20000) {
        thrombocytopeniaSeverity = 'severe';
        supportingLabs.push(`Critical thrombocytopenia (Platelets: ${val.toLocaleString()}/μL < 20,000)`);
      } else if (val < 50000) {
        thrombocytopeniaSeverity = 'moderate';
        supportingLabs.push(`Moderate thrombocytopenia (Platelets: ${val.toLocaleString()}/μL < 50,000)`);
      } else if (val < 100000) {
        thrombocytopeniaSeverity = 'mild';
        supportingLabs.push(`Mild thrombocytopenia (Platelets: ${val.toLocaleString()}/μL < 100,000)`);
      } else if (val < 150000) {
        supportingLabs.push(`Borderline platelet count (${val.toLocaleString()}/μL)`);
      } else {
        contradictoryFindings.push(`Normal platelet count (${val.toLocaleString()}/μL) makes severe dengue less likely`);
      }

      if (pltItem.trend?.direction === 'falling') {
        supportingLabs.push(`Rapidly falling platelet count (${pltItem.trend.deltaPercent}% decrease)`);
      }
    }

    const hctItem = labReport.items.find((i) => i.key === 'hematocrit');
    if (hctItem && hctItem.normalizedNumericValue !== null) {
      if (hctItem.classification === 'high' || hctItem.classification === 'critical') {
        supportingLabs.push(`Elevated hematocrit (${hctItem.normalizedNumericValue}%) indicating hemoconcentration`);
      }
      if (hctItem.trend?.direction === 'rising') {
        supportingLabs.push(`Rising hematocrit trend (${hctItem.trend.deltaPercent}% rise) indicates progressive plasma leakage`);
      }
    }

    // Check concurrent falling platelets + rising HCT => Plasma leakage confirmation
    if (labReport.dengueRiskSignatures.hemoconcentration && labReport.dengueRiskSignatures.thrombocytopenia) {
      plasmaLeakage = true;
    }
  }

  // Testing window & false negative evaluation
  // NS1 is reliable Days 1-3. Day 4-5+, viremia drops and NS1 may become falsely negative!
  const isDay4OrLater = illnessDays !== null && illnessDays >= 4;
  const ns1WindowValid = illnessDays !== null ? illnessDays <= 3 : true;
  const ns1FalseNegativeWarning = ns1Status === 'negative' && isDay4OrLater;

  if (ns1Status === 'positive') {
    supportingLabs.push('Dengue NS1 Antigen: Positive (Confirmatory in acute phase)');
  } else if (ns1Status === 'negative') {
    if (ns1FalseNegativeWarning) {
      supportingLabs.push(
        `Dengue NS1 Antigen: Negative on Day ${illnessDays} of illness. CRITICAL: Negative NS1 does NOT exclude dengue after Day 3 due to declining viremia; Dengue IgM antibody or repeat testing required.`
      );
    } else {
      contradictoryFindings.push('Dengue NS1 Antigen: Negative in early acute window (Days 1-3)');
    }
  }

  // Acuity and Classification
  const vitals = patient.vitals || {};
  const isHypotensive =
    (vitals.blood_pressure_systolic !== undefined && vitals.blood_pressure_systolic < 90) ||
    (vitals.blood_pressure_diastolic !== undefined && vitals.blood_pressure_diastolic <= 60);
  const narrowPulsePressure =
    vitals.blood_pressure_systolic !== undefined &&
    vitals.blood_pressure_diastolic !== undefined &&
    vitals.blood_pressure_systolic - vitals.blood_pressure_diastolic <= 20;

  const isShock = isHypotensive || narrowPulsePressure;

  let dengueClassification: 'suspected' | 'with_warning_signs' | 'severe' | null = null;
  let acuity: ClinicalAcuity = 'routine_followup';
  let diagnosticClassification: DiagnosticClassification = 'suspected';

  const isCandidate =
    (hasFever && (hasHeadacheRetroOrbital || hasMyalgia || hasRash || ns1Status === 'positive')) ||
    thrombocytopeniaSeverity !== 'none' ||
    ns1Status === 'positive';

  if (!isCandidate && !hasFever) {
    return {
      assessment: {
        isDengueCandidate: false,
        dengueClassification: null,
        dayOfIllness: illnessDays,
        dayOfTesting: null,
        ns1Status,
        ns1WindowValid,
        ns1FalseNegativeWarning,
        plasmaLeakageDetected: false,
        thrombocytopeniaSeverity: 'none',
        warningSignsIdentified: [],
        warningSignsIdentifiedBn: [],
        urgentActionRequired: false,
        fluidGuidanceEn: '',
        fluidGuidanceBn: '',
      },
      evaluation: null,
    };
  }

  if (isShock || plasmaLeakage || thrombocytopeniaSeverity === 'severe') {
    dengueClassification = 'severe';
    acuity = 'emergency';
    diagnosticClassification = ns1Status === 'positive' ? 'confirmed' : 'suspected';
  } else if (warningSigns.length > 0 || thrombocytopeniaSeverity === 'moderate') {
    dengueClassification = 'with_warning_signs';
    acuity = 'urgent';
    diagnosticClassification = ns1Status === 'positive' ? 'confirmed' : 'suspected';
  } else {
    dengueClassification = 'suspected';
    acuity = 'needs_prompt_review';
    diagnosticClassification = ns1Status === 'positive' ? 'confirmed' : 'suspected';
  }

  const missingInfo: string[] = [];
  if (illnessDays === null) missingInfo.push('Exact day of fever onset (crucial to determine diagnostic test window & critical phase)');
  if (ns1Status === 'not_tested') missingInfo.push('Dengue diagnostic panel: Dengue NS1 Antigen (if Day 1-3) or Dengue IgM / IgG (if Day 4+)');
  if (!patient.vitals?.blood_pressure_systolic) missingInfo.push('Blood pressure & pulse pressure monitoring (to detect impending dengue shock)');
  if (labReport && !labReport.items.some((i) => i.key === 'hematocrit')) missingInfo.push('Serial Hematocrit (HCT) to monitor plasma leakage');

  const assessment: DengueSpecializedAssessment = {
    isDengueCandidate: true,
    dengueClassification,
    dayOfIllness: illnessDays,
    dayOfTesting: illnessDays,
    ns1Status,
    ns1WindowValid,
    ns1FalseNegativeWarning,
    plasmaLeakageDetected: plasmaLeakage,
    thrombocytopeniaSeverity,
    warningSignsIdentified: warningSigns,
    warningSignsIdentifiedBn: warningSignsBn,
    urgentActionRequired: acuity === 'emergency' || acuity === 'urgent',
    fluidGuidanceEn:
      'Oral rehydration therapy with ORS/fluids for non-severe dengue. If warning signs or rising HCT present, initiate titrated IV isotonic crystalloid (0.9% Normal Saline or Ringer Lactate) at 5–7 mL/kg/h for 1–2 hours, then titrate down. Strict avoidance of NSAIDs, Aspirin, Steroids, and IM injections. Paracetamol restricted to max 60 mg/kg/day (not exceeding 3-4 g/day in adults).',
    fluidGuidanceBn:
      'সতর্ক সংকেত বা হেমাটোক্রিট বৃদ্ধি পেলে জরুরি আইভি আইসোটনিক ক্রিস্টালয়েড (০.৯% নরমাল স্যালাইন বা রিঙ্গার ল্যাকটেট) নির্দেশিত। কোনো অবস্থাতেই NSAIDs, অ্যাসপিরিন, স্টেরয়েড বা আইএম ইনজেকশন ব্যবহার করবেন না। শুধুমাত্র প্যারাসিটামল ব্যবহার করুন (দৈনিক সর্বোচ্চ ৩–৪ গ্রাম)।',
  };

  const evaluation: DiseaseEvaluationResult = {
    diseaseId: 'dengue',
    diseaseName: `Dengue Fever (${dengueClassification === 'severe' ? 'Severe Dengue' : dengueClassification === 'with_warning_signs' ? 'Dengue with Warning Signs' : 'Dengue without Warning Signs'})`,
    diseaseNameBn: `ডেঙ্গু জ্বর (${dengueClassification === 'severe' ? 'তীব্র ডেঙ্গু / শক সিন্ড্রোম' : dengueClassification === 'with_warning_signs' ? 'সতর্ক সংকেতযুক্ত ডেঙ্গু' : 'সাধারণ ডেঙ্গু'})`,
    classification: diagnosticClassification,
    acuity,
    confidence: ns1Status === 'positive' ? 'high' : warningSigns.length > 0 || thrombocytopeniaSeverity !== 'none' ? 'moderate' : 'low',
    confidenceExplanationEn:
      ns1Status === 'positive'
        ? 'Confirmed by positive Dengue NS1 antigen and clinical symptomatology matching WHO criteria.'
        : ns1FalseNegativeWarning
          ? `Negative NS1 on Day ${illnessDays} cannot rule out dengue due to the post-viremic window; clinical suspicion remains high given hematological profile and symptoms.`
          : 'Suspected based on acute febrile syndrome, retro-orbital/body pain, and hematological findings.',
    confidenceExplanationBn:
      ns1Status === 'positive'
        ? 'পজিটিভ ডেঙ্গু এনএস১ অ্যান্টিজেন ও ক্লিনিক্যাল লক্ষণের মাধ্যমে নিশ্চিত।'
        : ns1FalseNegativeWarning
          ? `জ্বরের ${illnessDays}তম দিনে এনএস১ নেগেটিভ হলেও ডেঙ্গুর সম্ভাবনা নাকচ করা যায় না। রোগীর লক্ষণ ও প্লাটিলেট পরিবর্তনের কারণে ডেঙ্গু সন্দেহ বিদ্যমান।`
          : 'তীব্র জ্বর, গা ব্যথা এবং রক্ত পরীক্ষার পরিবর্তনের ওপর ভিত্তি করে ডেঙ্গু সন্দেহ করা হয়েছে।',
    supportingSymptoms: [
      hasFever ? 'Acute high continuous fever' : '',
      hasHeadacheRetroOrbital ? 'Severe retro-orbital headache / eye pain' : '',
      hasMyalgia ? 'Severe generalized myalgia / break-bone body aches' : '',
      ...warningSigns,
    ].filter(Boolean),
    supportingLabs,
    contradictoryFindings,
    missingInformation: missingInfo,
    recommendedInvestigationsEn: [
      illnessDays && illnessDays >= 4 ? 'Dengue IgM & IgG antibody test (ELISA preferred)' : 'Dengue NS1 Antigen test',
      'Repeat Complete Blood Count (CBC) with Platelets & Hematocrit in 12–24 hours',
      'Serum ALT / AST to evaluate hepatic involvement',
      'Ultrasonography of abdomen (gallbladder wall thickening, ascites) and chest (pleural effusion) if warning signs develop',
    ],
    recommendedInvestigationsBn: [
      illnessDays && illnessDays >= 4 ? 'ডেঙ্গু IgM ও IgG অ্যান্টিবডি পরীক্ষা' : 'ডেঙ্গু NS1 অ্যান্টিজেন পরীক্ষা',
      '১২–২৪ ঘণ্টার মধ্যে পুনরাবৃত্তি CBC (প্লাটিলেট ও হেমাটোক্রিট পর্যবেক্ষণ)',
      'লিভারের অবস্থা যাচাইয়ে Serum ALT / AST',
      'সতর্ক সংকেত থাকলে পেটের ও বুকের আল্ট্রাসনোগ্রাফি (অ্যাসাইটিস বা প্লুরাল ইফিউশন দেখতে)',
    ],
    redFlags: [
      ...warningSigns,
      isShock ? '🚨 Impending Dengue Shock Syndrome (Hypotension / Narrow pulse pressure <= 20 mmHg)' : '',
      thrombocytopeniaSeverity === 'severe' ? '🚨 Critical Thrombocytopenia (< 20,000/μL) with spontaneous hemorrhage risk' : '',
    ].filter(Boolean),
    clinicalProtocolEn:
      'Strict avoidance of all NSAIDs (ibuprofen, ketorolac, diclofenac) and Aspirin due to profound bleeding risk. Maintenance hydration with oral fluids / ORS. Monitor urine output (>= 0.5 mL/kg/h). Immediate hospital admission if warning signs or platelet count < 100,000 with hemoconcentration.',
    clinicalProtocolBn:
      'রক্তক্ষরণ ঝুঁকির কারণে অ্যাসপিরিন ও যেকোনো ব্যথানাশক (NSAIDs) সম্পূর্ণ নিষিদ্ধ। পর্যাপ্ত ওআরএস ও তরল খাবার দিন। প্রস্রাবের পরিমাণ খেয়াল রাখুন (প্রতি ঘণ্টায় অন্তত ০.৫ মিলি/কেজি)। সতর্ক সংকেত দেখা দিলে দ্রুত হাসপাতালে ভর্তি করুন।',
    hospitalizationReferralCriteria: [
      'Presence of any WHO warning sign (persistent vomiting, severe abdominal pain, mucosal bleed)',
      'Rapidly falling platelet count < 100,000/μL concurrent with rising hematocrit >= 20%',
      'Hemodynamic instability, cold extremities, or systolic BP < 90 mmHg / pulse pressure <= 20 mmHg',
      'High-risk comorbidities (pregnancy, infancy, elderly, diabetes, chronic kidney disease)',
    ],
    guidelineSources: [
      {
        title: 'Comprehensive Guidelines for Prevention and Control of Dengue and Dengue Haemorrhagic Fever',
        organization: 'World Health Organization (WHO)',
        year: 2021,
        url: 'https://www.who.int/publications/i/item/9789290228387',
        summary: 'Defines 3-tier classification (dengue without warning signs, with warning signs, severe dengue), fluid resuscitation rates, and diagnostic testing windows.',
      },
      {
        title: 'National Clinical Management Guidelines for Dengue',
        organization: 'Directorate General of Health Services (DGHS), Bangladesh',
        year: 2023,
        summary: 'Emphasizes isotonic crystalloid hydration, strict NSAID contraindication, Day 1-3 NS1 vs Day 4+ IgM testing, and local hospital referral triggers.',
      },
    ],
  };

  return { assessment, evaluation };
}

/**
 * 2. Community-Acquired Pneumonia (CAP) Module
 */
export function evaluateCapModule(
  patient: StructuredPatientInput,
  labReport?: ComprehensiveLabReport
): DiseaseEvaluationResult | null {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
  ]
    .filter(Boolean)
    .join(' ');

  const hasCough = textContainsAny(fullText, ['cough', 'কাশি', 'কফ', 'sputum', 'purulent']);
  const hasFever = textContainsAny(fullText, ['fever', 'জ্বর', 'febrile', 'pyrexia', 'shivering', 'rigors']);
  const hasChestFindings = textContainsAny(fullText, [
    'crackles',
    'crepitations',
    'creps',
    'bronchial breath',
    'consolidation',
    'pleuritic',
    'chest pain',
    'বুকে শব্দ',
    'ফুসফুস',
  ]);
  const hasDyspnea = textContainsAny(fullText, ['dyspnea', 'shortness of breath', 'breathlessness', 'শ্বাসকষ্ট', 'tachypnea']);

  if (!hasCough && !hasChestFindings && !hasDyspnea) return null;

  const vitals = patient.vitals || {};
  const curbResult = calculateCurb65({
    age: patient.age,
    confusion: textContainsAny(fullText, ['confusion', 'disoriented', 'বিভ্রান্ত', 'altered sensorium']),
    respiratory_rate: vitals.respiratory_rate,
    systolic_bp: vitals.blood_pressure_systolic,
    diastolic_bp: vitals.blood_pressure_diastolic,
  });

  const supportingSymptoms: string[] = [];
  if (hasCough) supportingSymptoms.push('Productive/persistent cough');
  if (hasFever) supportingSymptoms.push('High-grade fever with chills/sweating');
  if (hasChestFindings) supportingSymptoms.push('Auscultatory crackles / bronchial breathing indicative of pulmonary consolidation');
  if (hasDyspnea) supportingSymptoms.push('Tachypnea / shortness of breath');

  const supportingLabs: string[] = [];
  if (labReport) {
    const wbc = labReport.items.find((i) => i.key === 'wbc');
    if (wbc && (wbc.classification === 'high' || wbc.classification === 'critical')) {
      supportingLabs.push(`Leukocytosis (WBC: ${wbc.normalizedNumericValue?.toLocaleString()}/μL) supporting acute bacterial infection`);
    }
    const crp = labReport.items.find((i) => i.key === 'crp');
    if (crp && (crp.classification === 'high' || crp.classification === 'critical')) {
      supportingLabs.push(`Elevated inflammatory marker CRP (${crp.normalizedNumericValue} mg/L)`);
    }
  }

  let acuity: ClinicalAcuity = 'routine_followup';
  if (curbResult.riskTier === 'critical' || (vitals.spo2_percent && vitals.spo2_percent < 90)) {
    acuity = 'emergency';
  } else if (curbResult.riskTier === 'high' || curbResult.riskTier === 'moderate' || (vitals.spo2_percent && vitals.spo2_percent < 94)) {
    acuity = 'urgent';
  } else {
    acuity = 'needs_prompt_review';
  }

  return {
    diseaseId: 'cap',
    diseaseName: `Community-Acquired Pneumonia (CAP) [CURB-65 Score: ${curbResult.score}/${curbResult.maxScore}]`,
    diseaseNameBn: `কমিউনিটি-অ্যাকওয়ার্ড নিউমোনিয়া (CAP) [CURB-65 স্কোর: ${curbResult.score}/${curbResult.maxScore}]`,
    classification: hasChestFindings && hasCough ? 'suspected' : 'differential',
    acuity,
    confidence: hasChestFindings && supportingLabs.length > 0 ? 'high' : 'moderate',
    confidenceExplanationEn: `Presents with respiratory symptoms, fever, and auscultatory signs. CURB-65 calculated at ${curbResult.score} (${curbResult.riskDescriptionEn}).`,
    confidenceExplanationBn: `শ্বাসযন্ত্রের লক্ষণ, জ্বর এবং স্টেথোস্কোপে ক্রেপিটেশন বিদ্যমান। CURB-65 স্কোর ${curbResult.score} (${curbResult.riskDescriptionBn})।`,
    supportingSymptoms,
    supportingLabs,
    contradictoryFindings: [],
    missingInformation: [
      'Chest X-Ray (Posteroanterior view) to confirm consolidation and rule out pleural effusion/pneumothorax',
      'Pulse Oximetry (SpO2) reading if not documented',
      'Sputum Gram stain and culture prior to starting antimicrobial therapy if inpatient',
    ],
    recommendedInvestigationsEn: [
      'Chest Radiograph (CXR PA view)',
      'Complete Blood Count (CBC) with differential count',
      'Serum Urea & Electrolytes (for complete CURB-65 calculation)',
      'Continuous SpO2 pulse oximetry monitoring',
    ],
    recommendedInvestigationsBn: [
      'বুকের এক্স-রে (CXR PA View) কনসলিডেশন নিশ্চিত করতে',
      'রক্তের সম্পূর্ণ গণনা (CBC with differential count)',
      'ব্লাড ইউরিয়া ও ইলেক্ট্রোলাইট (CURB-65 স্কোর পূর্ণ করতে)',
      'পালস অক্সিমেট্রি (SpO2) নিয়মিত পর্যবেক্ষণ',
    ],
    redFlags: [
      vitals.respiratory_rate && vitals.respiratory_rate >= 30 ? 'Tachypnea >= 30 breaths/min' : '',
      vitals.spo2_percent && vitals.spo2_percent < 92 ? 'Severe hypoxemia SpO2 < 92%' : '',
      curbResult.score >= 3 ? 'High-mortality CURB-65 score >= 3' : '',
    ].filter(Boolean),
    clinicalProtocolEn: curbResult.recommendationEn,
    clinicalProtocolBn: curbResult.recommendationBn,
    hospitalizationReferralCriteria: [
      'CURB-65 score >= 2 (hospital admission consideration) or >= 3 (urgent admission, ICU review)',
      'Hypoxemia SpO2 < 92% on room air',
      'Inability to tolerate oral fluids or medications',
      'Significant comorbidities (COPD, heart failure, chronic kidney or liver disease)',
    ],
    guidelineSources: [
      {
        title: 'Guidelines for the Management of Community-Acquired Pneumonia in Adults',
        organization: 'British Thoracic Society (BTS) / NICE Guidelines',
        year: 2022,
        url: 'https://www.nice.org.uk/guidance/ng138',
        summary: 'Recommends CURB-65 stratified antibiotic selection, oxygenation thresholds, and hospital admission criteria.',
      },
    ],
  };
}

/**
 * 3. Malaria Module
 */
export function evaluateMalariaModule(
  patient: StructuredPatientInput,
  labReport?: ComprehensiveLabReport
): DiseaseEvaluationResult | null {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
  ]
    .filter(Boolean)
    .join(' ');

  const hasChillsRigors = textContainsAny(fullText, ['chills', 'rigors', 'কাঁপুনী', 'শীত শীত ভাব', 'shivering']);
  const hasPeriodicFever = textContainsAny(fullText, ['intermittent fever', 'high fever', 'জ্বর', 'paroxysm', 'sweating']);
  const hasTravelEndemic = textContainsAny(fullText, [
    'chittagong',
    'cox',
    'bandarban',
    'khagrachhari',
    'rangamati',
    'sylhet',
    'hilly',
    'travel',
    'endemic',
    'ম্যালেরিয়া',
    'পাহাড়',
  ]);

  if (!hasChillsRigors && !hasPeriodicFever && !hasTravelEndemic) return null;

  const supportingSymptoms: string[] = [];
  if (hasChillsRigors) supportingSymptoms.push('High-grade fever accompanied by severe chills and rigors');
  if (hasPeriodicFever) supportingSymptoms.push('Paroxysmal fever spikes followed by heavy sweating');
  if (hasTravelEndemic) supportingSymptoms.push('History of travel to or residence in malaria-endemic hilly / forested districts');

  const supportingLabs: string[] = [];
  if (labReport) {
    const plt = labReport.items.find((i) => i.key === 'platelets');
    if (plt && plt.classification !== 'normal') {
      supportingLabs.push(`Thrombocytopenia (${plt.normalizedNumericValue?.toLocaleString()}/μL), commonly seen in malaria`);
    }
    const hb = labReport.items.find((i) => i.key === 'hemoglobin');
    if (hb && (hb.classification === 'low' || hb.classification === 'critical')) {
      supportingLabs.push(`Anemia (Hemoglobin: ${hb.normalizedNumericValue} g/dL) secondary to hemolysis`);
    }
  }

  return {
    diseaseId: 'malaria',
    diseaseName: 'Malaria (Plasmodium falciparum / vivax)',
    diseaseNameBn: 'ম্যালেরিয়া (Malaria)',
    classification: 'differential',
    acuity: hasTravelEndemic || hasChillsRigors ? 'urgent' : 'needs_prompt_review',
    confidence: hasTravelEndemic && hasChillsRigors ? 'moderate' : 'low',
    confidenceExplanationEn: 'Considered due to intermittent febrile paroxysms with rigors and travel to high-transmission areas.',
    confidenceExplanationBn: 'কাঁপুনীযুক্ত নির্দিষ্ট সময় পরপর জ্বর এবং পাহাড়ি/ঝুঁকিপূর্ণ এলাকায় ভ্রমণের ইতিহাস বিবেচনা করে ম্যালেরিয়া পর্যালোচনাধীন।',
    supportingSymptoms,
    supportingLabs,
    contradictoryFindings: [],
    missingInformation: [
      'Malaria Rapid Diagnostic Test (RDT) for Pf/Pv antigen',
      'Microscopic examination of Thick and Thin Blood Films (Giemsa stain gold standard)',
      'Travel and residency history in endemic regions',
    ],
    recommendedInvestigationsEn: [
      'Blood film for Malaria Parasite (MP) - Thick & Thin smears (repeated during fever spike)',
      'Malaria Rapid Diagnostic Test (RDT) Pf/Pv antigen',
      'Complete Blood Count (CBC) with reticulocyte count',
      'Serum Bilirubin and LDH (to assess degree of intravascular hemolysis)',
    ],
    recommendedInvestigationsBn: [
      'রক্তের ফিল্ম পরীক্ষা (Thick & Thin Blood Film for MP)',
      'ম্যালেরিয়া RDT পরীক্ষা (Pf/Pv অ্যান্টিজেন)',
      'CBC এবং রেটিকুলোসাইট গণনা',
      'সিরাম বিলিরুবিন ও এলডিএইচ (হিমোলাইসিস নির্ণয়ে)',
    ],
    redFlags: [
      'Cerebral malaria signs (altered consciousness, seizures, coma)',
      'Severe hemolytic anemia (Hb < 5 g/dL)',
      'Acute renal failure (oliguria, rapid creatinine rise)',
      'Spontaneous bleeding / DIC',
    ],
    clinicalProtocolEn:
      'Uncomplicated P. falciparum: Artemisinin-based Combination Therapy (ACT: Artemether-Lumefantrine or Dihydroartemisinin-Piperaquine). Severe malaria: Immediate IV Artesunate followed by full oral ACT course.',
    clinicalProtocolBn:
      'সাধারণ ফ্যালসিপেরাম ম্যালেরিয়া: ACT (Artemether-Lumefantrine)। তীব্র বা মারাত্মক ম্যালেরিয়া: অবিলম্বে IV Artesunate এবং হাসপাতালে নিবিড় চিকিৎসা।',
    hospitalizationReferralCriteria: [
      'Any signs of severe malaria (impaired consciousness, respiratory distress, jaundice, hypoglycemia)',
      'Inability to tolerate oral medication due to severe vomiting',
      'Parasitemia >= 2% in non-immune individuals',
    ],
    guidelineSources: [
      {
        title: 'WHO Guidelines for Malaria',
        organization: 'World Health Organization (WHO)',
        year: 2023,
        url: 'https://www.who.int/publications/i/item/guidelines-for-malaria',
        summary: 'Gold standard diagnostics with thick/thin smears, RDT, and Artemisinin-based combinations.',
      },
    ],
  };
}

/**
 * 4. Influenza Module
 */
export function evaluateInfluenzaModule(
  patient: StructuredPatientInput,
  labReport?: ComprehensiveLabReport
): DiseaseEvaluationResult | null {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
  ]
    .filter(Boolean)
    .join(' ');

  const hasFluSymptoms = textContainsAny(fullText, ['influenza', 'flu', 'sore throat', 'গলা ব্যথা', 'rhinorrhea', 'runny nose', 'হাঁচি', 'সর্দি']);
  const hasMyalgia = textContainsAny(fullText, ['myalgia', 'body ache', 'গা ব্যথা', 'prostration', 'headache']);
  const hasFever = textContainsAny(fullText, ['fever', 'জ্বর']);

  if (!hasFluSymptoms && !(hasFever && hasMyalgia)) return null;

  return {
    diseaseId: 'influenza',
    diseaseName: 'Seasonal Influenza / Acute Viral Upper Respiratory Infection',
    diseaseNameBn: 'মৌসুমি ইনফ্লুয়েঞ্জা / একিউট ভাইরাল রেসপিরেটরি ইনফেকশন (Flu)',
    classification: 'differential',
    acuity: 'routine_followup',
    confidence: hasFever && hasFluSymptoms && hasMyalgia ? 'moderate' : 'low',
    confidenceExplanationEn: 'Sudden onset of fever, upper respiratory tract irritation, prominent myalgia, and constitutional fatigue.',
    confidenceExplanationBn: 'হঠাৎ জ্বর, গলা ব্যথা, সর্দি, শরীর ব্যথা এবং ক্লান্তিবোধ ইনফ্লুয়েঞ্জা বা ভাইরাল ফ্লু নির্দেশ করে।',
    supportingSymptoms: [
      hasFever ? 'Acute high fever' : '',
      hasFluSymptoms ? 'Upper respiratory irritation (sore throat, coryza, cough)' : '',
      hasMyalgia ? 'Generalized body ache and myalgia' : '',
    ].filter(Boolean),
    supportingLabs: labReport?.dengueRiskSignatures.leukopenia ? ['Leukopenia / normal WBC consistent with viral etiology'] : [],
    contradictoryFindings: [],
    missingInformation: ['Rapid Influenza Diagnostic Test (RIDT) or viral PCR if high-risk patient'],
    recommendedInvestigationsEn: [
      'Rapid Influenza Diagnostic Test (RIDT) or RT-PCR nasopharyngeal swab',
      'Pulse Oximetry monitoring for high-risk individuals',
    ],
    recommendedInvestigationsBn: [
      'ইনফ্লুয়েঞ্জা অ্যান্টিজেন বা RT-PCR টেস্ট (প্রয়োজনে)',
      'পালস অক্সিমেট্রি পর্যবেক্ষণ',
    ],
    redFlags: [
      'Secondary bacterial pneumonia symptoms (recurrent fever after initial improvement, rust-colored sputum)',
      'Severe respiratory distress or tachypnea',
    ],
    clinicalProtocolEn:
      'Symptomatic and supportive care: adequate rest, oral hydration, paracetamol for pyrexia/pain. For high-risk individuals or severe illness presenting within 48 hours, neuraminidase inhibitor (Oseltamivir 75 mg PO BD for 5 days) is indicated.',
    clinicalProtocolBn:
      'লক্ষণভিত্তিক চিকিৎসা: বিশ্রাম, পর্যাপ্ত তরল, প্যারাসিটামল। ৪৮ ঘণ্টার মধ্যে ঝুঁকিপূর্ণ রোগীদের ক্ষেত্রে ওসেলটামিভির (Oseltamivir) বিবেচনা করা যেতে পারে।',
    hospitalizationReferralCriteria: [
      'Severe respiratory compromise (SpO2 < 92%)',
      'Inability to maintain hydration',
      'Altered mental status or hemodynamic instability',
    ],
    guidelineSources: [
      {
        title: 'Influenza Clinical Practice Guidelines',
        organization: 'Infectious Diseases Society of America (IDSA) / CDC',
        year: 2021,
        url: 'https://www.cdc.gov/flu/professionals/antivirals/summary-clinicians.htm',
        summary: 'Antiviral guidance within 48 hours for vulnerable groups.',
      },
    ],
  };
}

/**
 * 5. COVID-19 Module
 */
export function evaluateCovid19Module(
  patient: StructuredPatientInput,
  labReport?: ComprehensiveLabReport
): DiseaseEvaluationResult | null {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
  ]
    .filter(Boolean)
    .join(' ');

  const hasLossTasteSmell = textContainsAny(fullText, ['anosmia', 'ageusia', 'smell', 'taste', 'গন্ধ', 'স্বাদ']);
  const hasRespiratory = textContainsAny(fullText, ['dry cough', 'dyspnea', 'breathlessness', 'শুকনা কাশি', 'শ্বাসকষ্ট', 'covid', 'করোনা']);

  if (!hasLossTasteSmell && !hasRespiratory) return null;

  return {
    diseaseId: 'covid19',
    diseaseName: 'COVID-19 (SARS-CoV-2 Infection)',
    diseaseNameBn: 'কোভিড-১৯ (COVID-19 / SARS-CoV-2)',
    classification: 'differential',
    acuity: patient.vitals?.spo2_percent && patient.vitals.spo2_percent < 93 ? 'urgent' : 'routine_followup',
    confidence: hasLossTasteSmell ? 'high' : 'moderate',
    confidenceExplanationEn: hasLossTasteSmell
      ? 'Anosmia/ageusia in combination with respiratory symptoms carries high diagnostic specificity for SARS-CoV-2.'
      : 'Acute febrile respiratory syndrome with prominent dry cough.',
    confidenceExplanationBn: hasLossTasteSmell
      ? 'স্বাদ ও গন্ধের অনুভূতি লোপ পাওয়া এবং কাশির উপস্থিতি কোভিড-১৯ এর ক্ষেত্রে অত্যন্ত প্রাসঙ্গিক।'
      : 'জ্বর এবং শুকনো কাশি কোভিড-১৯ নির্দেশ করতে পারে।',
    supportingSymptoms: [
      hasLossTasteSmell ? 'Sudden loss of taste (ageusia) or smell (anosmia)' : '',
      hasRespiratory ? 'Dry cough and breathlessness' : '',
    ].filter(Boolean),
    supportingLabs: labReport?.dengueRiskSignatures.leukopenia ? ['Lymphopenia / leukopenia typical of viral infection'] : [],
    contradictoryFindings: [],
    missingInformation: ['SARS-CoV-2 Rapid Antigen Test or RT-PCR nasopharyngeal swab', 'Baseline SpO2 on room air'],
    recommendedInvestigationsEn: ['SARS-CoV-2 RT-PCR or rapid antigen test', 'Baseline SpO2 pulse oximetry'],
    recommendedInvestigationsBn: ['কোভিড-১৯ র্যাপিড অ্যান্টিজেন বা আরটি-পিসিআর টেস্ট', 'পালস অক্সিমেট্রি (SpO2)'],
    redFlags: [
      patient.vitals?.spo2_percent && patient.vitals.spo2_percent < 92 ? 'Silent hypoxemia (SpO2 < 92%)' : '',
      'Severe respiratory distress or cyanosis',
    ].filter(Boolean),
    clinicalProtocolEn:
      'Home isolation, rest, hydration, antipyretics. Monitor SpO2 3-4 times daily. For moderate-to-severe disease (SpO2 < 94%), hospital admission, oxygen therapy, and corticosteroids/antivirals as per national protocols.',
    clinicalProtocolBn:
      'হোম আইসোলেশন, বিশ্রাম ও পর্যাপ্ত তরল গ্রহণ। দিনে কয়েকবার SpO2 মাপুন। অক্সিজেন মাত্রা ৯৩% এর নিচে নামলে দ্রুত হাসপাতালে ভর্তি প্রয়োজন।',
    hospitalizationReferralCriteria: [
      'SpO2 < 94% on ambient room air',
      'Severe dyspnea or respiratory rate >= 30/min',
      'Chest pain or hemodynamic instability',
    ],
    guidelineSources: [
      {
        title: 'Therapeutics and COVID-19: Living Guideline',
        organization: 'World Health Organization (WHO)',
        year: 2023,
        url: 'https://www.who.int/publications/i/item/WHO-2019-nCoV-therapeutics-2023.1',
        summary: 'Oxygenation thresholds, risk stratification, and antiviral/corticosteroid stewardship.',
      },
    ],
  };
}

/**
 * 6. Diabetes Mellitus & Complications Module
 */
export function evaluateDiabetesModule(
  patient: StructuredPatientInput,
  // Same signature as the other disease modules; this one does not read labs.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _labReport?: ComprehensiveLabReport
): DiseaseEvaluationResult | null {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
    ...(patient.past_medical_history || []),
  ]
    .filter(Boolean)
    .join(' ');

  const hasHistory = textContainsAny(fullText, ['diabetes', 'diabetic', 'dm', 'ডায়াবেটিস', 't2dm', 't1dm', 'fasting glucose', 'high blood sugar', 'hyperglycemia']);
  const hasOsmoticSymptoms = textContainsAny(fullText, ['polyuria', 'polydipsia', 'polyphagia', 'ঘন ঘন প্রস্রাব', 'বেশি তৃষ্ণা', 'weight loss']);
  const hasDkaSymptoms = textContainsAny(fullText, ['kussmaul', 'fruity breath', 'acetone', 'ketones', 'ketoacidosis', 'dka']);

  // Check lab blood sugar
  let hasHyperglycemia = false;
  let hasHypoglycemia = false;
  let glucoseVal: number | null = null;

  if (patient.lab_values) {
    for (const lv of patient.lab_values) {
      const tName = (lv as { test_name?: string }).test_name || lv.name || '';
      if (/glucose|sugar|rbs|fbs|fasting|hba1c/i.test(tName)) {
        const num = parseFloat(String(lv.value));
        if (!isNaN(num)) {
          glucoseVal = num;
          const isFasting = /fbs|fasting/i.test(tName);
          if (num > 200 || (isFasting && num >= 126) || num >= 140) hasHyperglycemia = true;
          if (num < 70) hasHypoglycemia = true;
        }
      }
    }
  }

  if (!hasHistory && !hasOsmoticSymptoms && !hasDkaSymptoms && !hasHyperglycemia && !hasHypoglycemia) {
    return null;
  }

  const isDkaEmergency = hasDkaSymptoms || (hasHyperglycemia && textContainsAny(fullText, ['vomiting', 'abdominal pain', 'altered consciousness']));
  const isAsymptomaticRoutine = textContainsAny(fullText, ['asymptomatic', 'screening', 'routine']);
  const acuity: ClinicalAcuity = isDkaEmergency || hasHypoglycemia
    ? 'emergency'
    : hasHyperglycemia && !isAsymptomaticRoutine && glucoseVal !== null && glucoseVal > 250
    ? 'needs_prompt_review'
    : 'routine_followup';

  return {
    diseaseId: 'diabetes',
    diseaseName: isDkaEmergency
      ? 'Suspected Diabetic Ketoacidosis (DKA) / Severe Hyperglycemic State'
      : hasHypoglycemia
        ? 'Acute Hypoglycemia'
        : 'Diabetes Mellitus (T2DM / T1DM) Glycemic Evaluation',
    diseaseNameBn: isDkaEmergency
      ? 'ডায়াবেটিক কিটোঅ্যাসিডোসিস (DKA) / মারাত্মক হাইপারগ্লাইসেমিয়া'
      : hasHypoglycemia
        ? 'তীব্র হাইপোগ্লাইসেমিয়া (রক্তে শর্করার মারাত্মক হ্রাস)'
        : 'ডায়াবেটিস মেলাইটাস (রক্তে শর্করা নিয়ন্ত্রণ পর্যালোচনা)',
    classification: hasHistory || hasHyperglycemia ? 'confirmed' : 'suspected',
    acuity,
    confidence: glucoseVal !== null || hasHistory ? 'high' : 'moderate',
    confidenceExplanationEn: hasHypoglycemia
      ? 'Blood glucose < 70 mg/dL presents an immediate neuroglycopenic emergency requiring rapid correction.'
      : isDkaEmergency
        ? 'Severe hyperglycemia associated with abdominal symptoms, metabolic stress, or ketosis indicators.'
        : 'Documented diabetes history and osmotic clinical features.',
    confidenceExplanationBn: hasHypoglycemia
      ? 'রক্তে গ্লুকোজ ৭০ mg/dL এর নিচে যা দ্রুত সংশোধনযোগ্য জরুরি অবস্থা।'
      : isDkaEmergency
        ? 'অতিরিক্ত উচ্চ শর্করা এবং কিটোঅ্যাসিডোসিসের লক্ষণ নির্দেশিত।'
        : 'ডায়াবেটিসের ইতিহাস ও রক্তে শর্করার পরিবর্তন চিহ্নিত।',
    supportingSymptoms: [
      hasOsmoticSymptoms ? 'Classic osmotic symptoms: polyuria, polydipsia, unexplainable weight loss' : '',
      hasDkaSymptoms ? 'Features of ketoacidosis: deep rapid breathing, nausea/vomiting' : '',
    ].filter(Boolean),
    supportingLabs: glucoseVal !== null ? [`Documented blood glucose value: ${glucoseVal}`] : [],
    contradictoryFindings: [],
    missingInformation: [
      'HbA1c (Glycated Hemoglobin) for 3-month glycemic control assessment',
      'Urine for ketones and microalbuminuria',
      'Lipid profile and baseline renal profile (Serum Creatinine, eGFR)',
    ],
    recommendedInvestigationsEn: [
      'HbA1c (Glycated Hemoglobin)',
      'Fasting Blood Sugar (FBS) and 2-hour Postprandial Blood Sugar (2h-PPBS)',
      'Urine routine examination for ketones, protein, and microalbumin',
      'Comprehensive Metabolic Panel (electrolytes, creatinine)',
    ],
    recommendedInvestigationsBn: [
      'HbA1c (তিন মাসের গড় শর্করা পরীক্ষা)',
      'খালি পেটে এবং খাওয়ার ২ ঘণ্টা পর রক্তের গ্লুকোজ',
      'প্রস্রাবের রুটিন টেস্ট (কিটোন ও অ্যালবুমিন দেখতে)',
      'রক্তের সিরাম ক্রিয়েটিনিন ও ইলেক্ট্রোলাইট',
    ],
    redFlags: [
      hasHypoglycemia ? '🚨 Critical Hypoglycemia (< 70 mg/dL): risk of seizure and encephalopathy' : '',
      isDkaEmergency ? '🚨 Suspected Diabetic Ketoacidosis (DKA): high mortality if untreated' : '',
    ].filter(Boolean),
    clinicalProtocolEn: hasHypoglycemia
      ? 'Immediate 15-20g fast-acting oral carbohydrates (if conscious) or 25-50 mL of 25% or 50% IV Dextrose (if unconscious).'
      : isDkaEmergency
        ? 'Immediate IV isotonic saline fluid resuscitation, IV regular insulin infusion, and electrolyte monitoring in ICU/HDU.'
        : 'Lifestyle modification, dietary counseling, structured glucose monitoring, and oral antidiabetic / insulin titration.',
    clinicalProtocolBn: hasHypoglycemia
      ? 'সচেতন থাকলে অবিলম্বে চিনিযুক্ত পানীয় বা গ্লুকোজ; অচেতন হলে দ্রুত শিরায় ডেক্সট্রোজ (IV Dextrose) পুশ করুন।'
      : isDkaEmergency
        ? 'অবিলম্বে হাসপাতালে ভর্তি করে স্যালাইন, ইনসুলিন ও পটাশিয়াম পর্যবেক্ষণ নিশ্চিত করুন।'
        : 'খাদ্যাভ্যাস নিয়ন্ত্রণ, নিয়মিত রক্ত পরীক্ষা ও চিকিৎসকের পরামর্শে ওষুধ সমন্বয়।',
    hospitalizationReferralCriteria: [
      'Severe hypoglycemia refractory to oral intake or associated with altered sensorium',
      'Diabetic Ketoacidosis (DKA) or Hyperosmolar Hyperglycemic State (HHS)',
      'Severe recurrent hyperglycemia with acute intercurrent illness or infection',
    ],
    guidelineSources: [
      {
        title: 'Standards of Care in Diabetes',
        organization: 'American Diabetes Association (ADA)',
        year: 2024,
        url: 'https://diabetesjournals.org/care/issue/47/Supplement_1',
        summary: 'Glycemic targets, acute complication algorithms, and cardiovascular/renal protective therapies.',
      },
    ],
  };
}

/**
 * 7. Hypertension & Hypertensive Urgencies / Emergencies Module
 */
export function evaluateHypertensionModule(
  patient: StructuredPatientInput,
  labReport?: ComprehensiveLabReport
): DiseaseEvaluationResult | null {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
    ...(patient.past_medical_history || []),
  ]
    .filter(Boolean)
    .join(' ');

  const vitals = patient.vitals || {};
  const sbp = vitals.blood_pressure_systolic;
  const dbp = vitals.blood_pressure_diastolic;

  const hasHistory = textContainsAny(fullText, ['hypertension', 'htn', 'high bp', 'উচ্চ রক্তচাপ']);
  const hasElevatedBp = (sbp !== undefined && sbp >= 140) || (dbp !== undefined && dbp >= 90);
  const isCrisis = (sbp !== undefined && sbp >= 180) || (dbp !== undefined && dbp >= 120);

  if (!hasHistory && !hasElevatedBp) return null;

  // Check for target organ damage
  const hasTargetOrganDamage = textContainsAny(fullText, [
    'chest pain',
    'headache',
    'blurred vision',
    'papilledema',
    'confusion',
    'dyspnea',
    'hematuria',
    'মাথা ঘোরা',
    'বুকে ব্যথা',
    'ঝাপসা দেখা',
  ]);

  let acuity: ClinicalAcuity = 'routine_followup';
  let categoryName = 'Essential Hypertension (Stage 1 or 2)';
  let categoryNameBn = 'উচ্চ রক্তচাপ (Hypertension)';

  if (isCrisis) {
    if (hasTargetOrganDamage) {
      acuity = 'emergency';
      categoryName = 'Hypertensive Emergency (Acute Target Organ Damage Risk)';
      categoryNameBn = 'হাইপারটেনসিভ ইমার্জেন্সি (জরুরি অঙ্গহানির মারাত্মক ঝুঁকি)';
    } else {
      acuity = 'urgent';
      categoryName = 'Hypertensive Urgency (Severe Asymptomatic BP Elevation)';
      categoryNameBn = 'হাইপারটেনসিভ আর্জেন্টসি (তীব্র উচ্চ রক্তচাপ)';
    }
  } else if (sbp !== undefined && sbp >= 160) {
    acuity = 'needs_prompt_review';
  }

  return {
    diseaseId: 'hypertension',
    diseaseName: categoryName,
    diseaseNameBn: categoryNameBn,
    classification: hasElevatedBp ? 'confirmed' : 'suspected',
    acuity,
    confidence: sbp !== undefined ? 'high' : 'moderate',
    confidenceExplanationEn: `Documented BP: ${sbp || '—'}/${dbp || '—'} mmHg. ${isCrisis ? 'Meets criteria for hypertensive crisis.' : 'Elevated above normal thresholds.'}`,
    confidenceExplanationBn: `রেকর্ডকৃত রক্তচাপ: ${sbp || '—'}/${dbp || '—'} mmHg। ${isCrisis ? 'হাইপারটেনসিভ ক্রাইসিস মানদণ্ডে উত্তীর্ণ।' : 'স্বাভাবিকের চেয়ে বেশি।'}`,
    supportingSymptoms: [
      sbp !== undefined ? `Recorded BP: ${sbp}/${dbp} mmHg` : '',
      hasTargetOrganDamage ? 'Symptoms suspicious of acute end-organ stress (headache, vision changes, chest tightness)' : '',
    ].filter(Boolean),
    supportingLabs: labReport?.items.some((i) => i.key === 'creatinine' && i.classification !== 'normal')
      ? ['Renal impairment markers present on lab panel']
      : [],
    contradictoryFindings: [],
    missingInformation: [
      'Electrocardiogram (ECG) to assess left ventricular hypertrophy or acute ischemia',
      'Urinalysis for proteinuria / hematuria',
      'Serum Creatinine, eGFR, and electrolytes',
    ],
    recommendedInvestigationsEn: [
      'Standard 12-lead ECG',
      'Serum Creatinine, eGFR, and Serum Electrolytes',
      'Urine Routine Examination (protein, albumin-creatinine ratio)',
      'Fundoscopic examination (to evaluate hypertensive retinopathy)',
    ],
    recommendedInvestigationsBn: [
      '১২-লিড ইসিজি (ECG)',
      'সিরাম ক্রিয়েটিনিন ও ইলেক্ট্রোলাইট পরীক্ষা',
      'প্রস্রাবের রুটিন টেস্ট (প্রোটিন নির্গমন দেখতে)',
      'চোখের ফান্ডাস পরীক্ষা (রেটিনোপ্যাথি যাচাই)',
    ],
    redFlags: [
      isCrisis && hasTargetOrganDamage ? '🚨 Hypertensive Emergency: BP >= 180/120 with target organ involvement' : '',
    ].filter(Boolean),
    clinicalProtocolEn:
      isCrisis && hasTargetOrganDamage
        ? 'Immediate admission to ICU/HDU. Administer parenteral antihypertensives (IV Labetalol or Nicardipine) with a target of reducing MAP by no more than 20-25% in the first hour.'
        : 'Outpatient adjustment of oral antihypertensive therapy (ACEi/ARB, CCB, thiazide diuretic). Dietary sodium restriction (< 2 g/day). Re-evaluate in 1–2 weeks.',
    clinicalProtocolBn:
      isCrisis && hasTargetOrganDamage
        ? 'অবিলম্বে হাসপাতালে ভর্তি ও আইভি রক্তচাপ নিয়ন্ত্রক ওষুধ (IV Labetalol) প্রয়োগ। প্রথম ঘণ্টায় ২৫% এর বেশি প্রেসার কমানো যাবে না।'
        : 'মুখে খাওয়ার রক্তচাপের ওষুধ শুরু বা সমন্বয়, খাবারে বাড়তি লবণ বর্জন এবং ১-২ সপ্তাহের মধ্যে পুনরায় পর্যবেক্ষণ।',
    hospitalizationReferralCriteria: [
      'Hypertensive emergency (BP >= 180/120 with encephalopathy, chest pain, pulmonary edema, or acute renal decline)',
      'Suspected secondary hypertension or refractory hypertension on >= 3 agents',
    ],
    guidelineSources: [
      {
        title: 'ACC/AHA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure',
        organization: 'American College of Cardiology / AHA',
        year: 2023,
        url: 'https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065',
        summary: 'Blood pressure classification, emergency vs urgency differentiation, and stepped pharmacological algorithms.',
      },
    ],
  };
}

/**
 * 8. Chronic & Acute Kidney Disease Module
 */
export function evaluateKidneyDiseaseModule(
  patient: StructuredPatientInput,
  labReport?: ComprehensiveLabReport
): DiseaseEvaluationResult | null {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
    ...(patient.past_medical_history || []),
  ]
    .filter(Boolean)
    .join(' ');

  const hasHistory = textContainsAny(fullText, ['ckd', 'kidney disease', 'renal failure', 'dialysis', 'কিডনি রোগ', 'নেফ্রোপ্যাথি']);
  const hasOliguriaEdema = textContainsAny(fullText, ['oliguria', 'anuria', 'edema', 'swelling legs', 'face puffiness', 'পা ফোলা', 'প্রস্রাব কমে যাওয়া']);

  const scrItem = labReport?.items.find((i) => i.key === 'creatinine');
  const egfrItem = labReport?.items.find((i) => i.key === 'egfr');
  const kItem = labReport?.items.find((i) => i.key === 'potassium');
  const naItem = labReport?.items.find((i) => i.key === 'sodium');

  const isCriticalHypokalemia = Boolean(kItem && kItem.normalizedNumericValue !== null && kItem.normalizedNumericValue <= 2.8);
  const isCriticalHyperkalemia = Boolean(kItem && kItem.normalizedNumericValue !== null && kItem.normalizedNumericValue >= 6.0);
  const isCriticalElectrolyte =
    isCriticalHyperkalemia ||
    isCriticalHypokalemia ||
    Boolean(kItem && kItem.classification === 'critical') ||
    Boolean(naItem && (naItem.classification === 'critical' || (naItem.normalizedNumericValue !== null && (naItem.normalizedNumericValue < 120 || naItem.normalizedNumericValue > 160))));

  const hasLabRenalAbnormality =
    (scrItem && (scrItem.classification === 'high' || scrItem.classification === 'critical')) ||
    (egfrItem && (egfrItem.classification === 'low' || egfrItem.classification === 'critical')) ||
    (kItem && (kItem.classification === 'high' || kItem.classification === 'low' || kItem.classification === 'critical')) ||
    (naItem && (naItem.classification === 'high' || naItem.classification === 'low' || naItem.classification === 'critical'));

  if (!hasHistory && !hasOliguriaEdema && !hasLabRenalAbnormality && !isCriticalElectrolyte) return null;

  const isAkiSuspected =
    scrItem?.trend?.direction === 'rising' ||
    (scrItem && scrItem.normalizedNumericValue && scrItem.normalizedNumericValue >= 2.0 && !hasHistory);

  let acuity: ClinicalAcuity = 'needs_prompt_review';
  if (isCriticalElectrolyte || isAkiSuspected || textContainsAny(fullText, ['pulmonary edema', 'anuria', 'uremic encephalopathy', 'muscle weakness'])) {
    acuity = 'emergency';
  } else if (hasLabRenalAbnormality) {
    acuity = 'urgent';
  }

  const supportingLabs: string[] = [];
  if (scrItem && scrItem.normalizedNumericValue !== null) {
    supportingLabs.push(`Elevated Serum Creatinine: ${scrItem.normalizedNumericValue} ${scrItem.normalizedUnit}`);
  }
  if (egfrItem && egfrItem.normalizedNumericValue !== null) {
    supportingLabs.push(`Estimated GFR (eGFR): ${egfrItem.normalizedNumericValue} mL/min/1.73m² [ESTIMATED VALUE]`);
  }
  if (kItem && kItem.normalizedNumericValue !== null) {
    supportingLabs.push(`Serum Potassium: ${kItem.normalizedNumericValue} mmol/L (${kItem.classification})`);
  }

  return {
    diseaseId: 'kidney_disease',
    diseaseName: isAkiSuspected
      ? 'Acute Kidney Injury (AKI) / Acute Renal Impairment'
      : hasHistory
        ? 'Chronic Kidney Disease (CKD) with Current Renal Evaluation'
        : 'Renal Function Impairment',
    diseaseNameBn: isAkiSuspected
      ? 'অ্যাকিউট কিডনি ইনজুরি (AKI) / তীব্র বৃক্কীয় বৈকল্য'
      : hasHistory
        ? 'ক্রনিক কিডনি ডিজিজ (CKD) / দীর্ঘমেয়াদী কিডনি রোগ'
        : 'কিডনির কার্যকারিতা হ্রাস',
    classification: hasLabRenalAbnormality ? 'confirmed' : 'suspected',
    acuity,
    confidence: hasLabRenalAbnormality ? 'high' : 'moderate',
    confidenceExplanationEn: hasLabRenalAbnormality
      ? 'Objectively confirmed by elevated creatinine, reduced eGFR, and electrolyte perturbations.'
      : 'Clinical history of renal disease or fluid retention symptoms.',
    confidenceExplanationBn: hasLabRenalAbnormality
      ? 'রক্তে ক্রিয়েটিনিনের আধিক্য এবং eGFR হ্রাসের মাধ্যমে প্রমাণিত।'
      : 'কিডনি রোগের ইতিহাস বা প্রস্রাব কমে যাওয়ার লক্ষণের ভিত্তিতে চিহ্নিত।',
    supportingSymptoms: [
      hasOliguriaEdema ? 'Oliguria / reduced urine volume and generalized peripheral edema' : '',
    ].filter(Boolean),
    supportingLabs,
    contradictoryFindings: [],
    missingInformation: [
      'Baseline pre-illness serum creatinine value to distinguish acute AKI from chronic CKD',
      'Urinalysis for protein, red cell casts, and specific gravity',
      'Renal ultrasonography (kidney size, cortico-medullary differentiation, obstruction)',
    ],
    recommendedInvestigationsEn: [
      'Serum Creatinine & eGFR monitoring every 24–48 hours',
      'Serum Electrolytes (Potassium, Sodium, Bicarbonate)',
      'Ultrasound of Kidneys, Ureters, and Bladder (USG of KUB)',
      'Spot urine protein-to-creatinine ratio (UPCR)',
    ],
    recommendedInvestigationsBn: [
      '২৪-৪৮ ঘণ্টা পর পর সিরাম ক্রিয়েটিনিন ও eGFR পর্যবেক্ষণ',
      'সিরাম ইলেক্ট্রোলাইট (পটাশিয়াম, সোডিয়াম)',
      'কিডনি ও মূত্রথলির আল্ট্রাসনোগ্রাফি (USG of KUB)',
      'প্রস্রাবে প্রোটিন নির্গমন পরীক্ষা (UPCR)',
    ],
    redFlags: [
      isCriticalHyperkalemia ? '🚨 Critical Hyperkalemia (K+ >= 6.0 mmol/L): immediate cardiac arrest / arrhythmia risk' : '',
      'Refractory volume overload / pulmonary edema',
      'Uremic pericarditis or encephalopathy (confusion, asterixis)',
    ].filter(Boolean),
    clinicalProtocolEn:
      'Immediately review and hold nephrotoxic drugs: discontinue NSAIDs, Aminoglycosides, and iodinated contrast. Hold ACE inhibitors / ARBs during acute hemodynamic instability. Adjust medication doses according to estimated GFR. Treat hyperkalemia emergently with IV Calcium Gluconate (cardioprotection), Insulin + Dextrose, and nebulized Salbutamol if K+ >= 6.0.',
    clinicalProtocolBn:
      'কিডনির ক্ষতিকর ওষুধ (NSAIDs ব্যথানাশক, অ্যামিনোগ্লাইকোসাইড) অবিলম্বে বন্ধ করুন। eGFR অনুযায়ী ওষুধের মাত্রা সমন্বয় করুন। পটাশিয়াম বিপজ্জনক হলে জরুরি ইনসুলিন-গ্লুকোজ ও ক্যালসিয়াম গ্লুকোনেট নির্দেশিত।',
    hospitalizationReferralCriteria: [
      'KDIGO Stage 2 or 3 AKI (doubling of serum creatinine or severe oliguria < 0.5 mL/kg/h for > 12h)',
      'Severe hyperkalemia refractory to medical therapy',
      'Emergent dialysis indications (AEIOU: Acidosis, Electrolytes, Ingestion, Overload, Uremia)',
    ],
    guidelineSources: [
      {
        title: 'KDIGO Clinical Practice Guideline for Acute Kidney Injury',
        organization: 'Kidney Disease: Improving Global Outcomes (KDIGO)',
        year: 2022,
        url: 'https://kdigo.org/guidelines/acute-kidney-injury/',
        summary: 'Staging of AKI, avoidance of nephrotoxins, and indications for renal replacement therapy.',
      },
    ],
  };
}

/**
 * 9. Liver Disease & Hepatic Dysfunction Module
 */
export function evaluateLiverDiseaseModule(
  patient: StructuredPatientInput,
  // Same signature as the other disease modules; this one does not read labs.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _labReport?: ComprehensiveLabReport
): DiseaseEvaluationResult | null {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
    ...(patient.past_medical_history || []),
  ]
    .filter(Boolean)
    .join(' ');

  const hasJaundice = textContainsAny(fullText, ['jaundice', 'yellow', 'icterus', 'কামলা', 'হলুদ প্রস্রাব', 'চোখ হলুদ']);
  const hasCirrhosisHistory = textContainsAny(fullText, ['cirrhosis', 'hepatitis', 'fatty liver', 'liver failure', 'যকৃত রোগ', 'হেপাটাইটিস']);
  const hasEncephalopathy = textContainsAny(fullText, ['asterixis', 'flapping tremor', 'confusion', 'disoriented', 'hepatic encephalopathy']);

  let hasElevatedEnzymes = false;
  if (patient.lab_values) {
    for (const lv of patient.lab_values) {
      const tName = (lv as { test_name?: string }).test_name || lv.name || '';
      if (/alt|sgpt|ast|sgot|bilirubin/i.test(tName)) {
        const num = parseFloat(String(lv.value));
        if (!isNaN(num) && num > 80) hasElevatedEnzymes = true;
      }
    }
  }

  if (!hasJaundice && !hasCirrhosisHistory && !hasEncephalopathy && !hasElevatedEnzymes) {
    return null;
  }

  const isAcuteLiverFailure = (hasElevatedEnzymes || hasJaundice) && hasEncephalopathy;
  const acuity: ClinicalAcuity = isAcuteLiverFailure ? 'emergency' : hasJaundice || hasElevatedEnzymes ? 'urgent' : 'needs_prompt_review';

  return {
    diseaseId: 'liver_disease',
    diseaseName: isAcuteLiverFailure
      ? 'Suspected Acute Liver Failure / Hepatic Encephalopathy'
      : hasJaundice
        ? 'Acute Hepatic Dysfunction / Jaundice Syndrome'
        : 'Hepatic Dysfunction / Chronic Liver Disease',
    diseaseNameBn: isAcuteLiverFailure
      ? 'অ্যাকিউট লিভার ফেইলিউর / হেপাটিক এনসেফালোপ্যাথি'
      : hasJaundice
        ? 'জন্ডিস ও তীব্র যকৃতের প্রদাহ (Acute Jaundice)'
        : 'লিভারের কার্যকারিতা বৈকল্য / দীর্ঘমেয়াদী লিভার রোগ',
    classification: hasElevatedEnzymes || hasJaundice ? 'suspected' : 'differential',
    acuity,
    confidence: hasElevatedEnzymes || hasJaundice ? 'high' : 'moderate',
    confidenceExplanationEn: 'Presentation with scleral icterus, hepatic enzyme elevation, or features of impaired hepatic synthesis.',
    confidenceExplanationBn: 'চোখে জন্ডিস, রক্তে লিভার এনজাইম বৃদ্ধি বা লিভার বৈকল্যের লক্ষণের ওপর ভিত্তি করে চিহ্নিত।',
    supportingSymptoms: [
      hasJaundice ? 'Scleral icterus / dark tea-colored urine' : '',
      hasEncephalopathy ? 'Altered mental status / flapping tremor (asterixis)' : '',
    ].filter(Boolean),
    supportingLabs: hasElevatedEnzymes ? ['Elevated transaminases (ALT/AST) or serum bilirubin'] : [],
    contradictoryFindings: [],
    missingInformation: [
      'Liver Function Tests (Total & Direct Bilirubin, ALT, AST, ALP, Albumin)',
      'Coagulation Profile (Prothrombin Time / INR) to evaluate synthetic function',
      'Viral Hepatitis Serology (HBsAg, Anti-HCV, Anti-HAV IgM, Anti-HEV IgM)',
    ],
    recommendedInvestigationsEn: [
      'Comprehensive Liver Function Test (LFT: Bilirubin, ALT, AST, ALP, Total Protein, Albumin)',
      'Coagulation profile (PT, INR)',
      'Viral Hepatitis Serological Markers (HBsAg, Anti-HCV, Anti-HAV IgM, Anti-HEV IgM)',
      'Abdominal Ultrasound (liver parenchyma, portal vein diameter, splenomegaly, ascites)',
    ],
    recommendedInvestigationsBn: [
      'লিভার ফাংশন টেস্ট (LFT: বিলিরুবিন, ALT, AST, ALP, অ্যালবুমিন)',
      'রক্ত জমাট বাঁধার পরীক্ষা (PT / INR)',
      'হেপাটাইটিস ভাইরাস মার্কার (HBsAg, Anti-HCV, Anti-HAV, Anti-HEV)',
      'পেটের আল্ট্রাসনোগ্রাফি (যকৃত ও প্লীহার অবস্থা যাচাই)',
    ],
    redFlags: [
      isAcuteLiverFailure ? '🚨 Acute Liver Failure: Jaundice accompanied by coagulopathy or encephalopathy' : '',
      'Upper gastrointestinal bleeding (hematemesis/melena) from suspected esophageal varices',
    ].filter(Boolean),
    clinicalProtocolEn:
      'Avoid hepatotoxic drugs: restrict paracetamol to max 2 g/day (or avoid in acute failure), discontinue sedatives, NSAIDs, and alcohol. Monitor INR and blood glucose (risk of severe hypoglycemia). Immediate gastroenterology/hepatology consultation.',
    clinicalProtocolBn:
      'লিভারের ক্ষতিকর ওষুধ পরিহার করুন (প্যারাসিটামল দৈনিক সর্বোচ্চ ২ গ্রামের নিচে সীমাবদ্ধ রাখুন)। রক্তে গ্লুকোজ ও জমাট বাঁধার সময় (INR) পর্যবেক্ষণ করুন।',
    hospitalizationReferralCriteria: [
      'INR >= 1.5 or signs of hepatic encephalopathy (urgent liver center transfer)',
      'Acute jaundice with persistent vomiting and inability to maintain hydration',
      'Suspected variceal hemorrhage or spontaneous bacterial peritonitis',
    ],
    guidelineSources: [
      {
        title: 'Guidelines on the Management of Acute Liver Failure',
        organization: 'American Association for the Study of Liver Diseases (AASLD)',
        year: 2023,
        url: 'https://www.aasld.org/practice-guidelines',
        summary: 'Emergency identification of coagulopathy, encephalopathy, and intensive care management.',
      },
    ],
  };
}

/**
 * 10. Cardiovascular Disease & Acute Coronary Syndrome (ACS) Module
 */
export function evaluateCardiovascularAcsModule(
  patient: StructuredPatientInput,
  // Same signature as the other disease modules; this one does not read labs.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _labReport?: ComprehensiveLabReport
): DiseaseEvaluationResult | null {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
    ...(patient.past_medical_history || []),
  ]
    .filter(Boolean)
    .join(' ');

  const hasChestPain = textContainsAny(fullText, ['chest pain', 'substernal', 'retrosternal', 'angina', 'heaviness', 'tightness', 'বুকে ব্যথা', 'বুকে চাপ']);
  const hasRadiation = textContainsAny(fullText, ['radiation to left arm', 'jaw pain', 'left shoulder', 'বাম বাহু', 'চোয়ালে ব্যথা']);
  const hasDiaphoresis = textContainsAny(fullText, ['diaphoresis', 'sweating', 'profuse perspiration', 'ঘাম', 'অতিরিক্ত ঘাম']);
  const hasDyspnea = textContainsAny(fullText, ['dyspnea', 'breathlessness', 'orthopnea', 'শ্বাসকষ্ট']);
  const hasHeartFailure = textContainsAny(fullText, [
    'orthopnea',
    'heart failure',
    'paroxysmal nocturnal dyspnea',
    'pnd',
    'হার্ট ফেইলিউর',
    'cardiac failure',
  ]) || (hasDyspnea && textContainsAny(fullText, ['leg edema', 'edema', 'rales', 'crackles', 'crepitations']) && textContainsAny(fullText, ['ischemic heart disease', 'ihd', 'cad', 'heart disease']));

  const vitals = patient.vitals || {};
  const isSevereBrady = vitals.heart_rate !== undefined && vitals.heart_rate < 40;
  const hasSyncope = textContainsAny(fullText, ['syncope', 'blackout', 'অজ্ঞান', 'fainting']);

  if (!hasChestPain && !(hasRadiation && hasDiaphoresis) && !(isSevereBrady && hasSyncope) && !hasHeartFailure) return null;

  let hasElevatedTroponin = false;
  if (patient.lab_values) {
    for (const lv of patient.lab_values) {
      const tName = (lv as { test_name?: string }).test_name || lv.name || '';
      if (/troponin/i.test(tName)) {
        const valStr = String(lv.value).toLowerCase();
        const num = parseFloat(valStr);
        if (valStr.includes('pos') || (!isNaN(num) && num > 0.04)) {
          hasElevatedTroponin = true;
        }
      }
    }
  }

  const isConfirmedAcs = hasElevatedTroponin || (hasChestPain && hasRadiation && hasDiaphoresis);
  const isBrady = isSevereBrady && hasSyncope;
  const isHf = hasHeartFailure && !isConfirmedAcs && !isBrady;
  const acuity: ClinicalAcuity = 'emergency';

  const diseaseName = isHf
    ? 'Acute Decompensated Heart Failure (ADHF) / Pulmonary Congestion'
    : isBrady
    ? 'Severe Symptomatic Sinus Bradycardia'
    : 'Acute Coronary Syndrome (ACS) / Myocardial Infarction';

  const diseaseNameBn = isHf
    ? 'অ্যাকিউট ডিকম্পেনসেটেড হার্ট ফেইলিউর (ADHF) / ফুসফুসে পানি জমা'
    : isBrady
    ? 'তীব্র সাইনাস ব্র্যাডিকার্ডিয়া (ধীর হৃদস্পন্দন)'
    : 'অ্যাকিউট করোনারি সিন্ড্রোম (ACS) / মায়োকার্ডিয়াল ইনফার্কশন (হার্ট অ্যাটাক)';

  return {
    diseaseId: 'cardiovascular_acs',
    diseaseName,
    diseaseNameBn,
    classification: hasElevatedTroponin ? 'confirmed' : 'suspected',
    acuity,
    confidence: isConfirmedAcs || isHf ? 'high' : 'moderate',
    confidenceExplanationEn: isHf
      ? 'Acute decompensated heart failure supported by severe orthopnea, bilateral basal crackles, tachypnea, and underlying cardiovascular disease.'
      : isBrady
      ? 'Severe profound bradycardia (HR < 40) presenting with syncope requires emergency cardiac pacing evaluation.'
      : 'Substernal chest pressure radiating to left arm/jaw with diaphoresis matches high-probability ischemic ACS criteria.',
    confidenceExplanationBn: isHf
      ? 'শোয়া অবস্থায় তীব্র শ্বাসকষ্ট (Orthopnea), ফুসফুসে ক্র্যাকলস এবং পায়ের ফোলা সরাসরি হার্ট ফেইলিউর নির্দেশ করে।'
      : isBrady
      ? 'হৃদস্পন্দন মাত্রাতিরিক্ত কমে যাওয়া (HR < 40) এবং অজ্ঞান হয়ে যাওয়া জরুরি পেসমেকার মূল্যায়নের দাবি রাখে।'
      : 'বুকের মাঝখানে চাপ বা ব্যথা বাম হাত/চোয়ালে ছড়ানো এবং অতিরিক্ত ঘাম সরাসরি হার্ট অ্যাটাকের লক্ষণ নির্দেশ করে।',
    supportingSymptoms: [
      hasChestPain ? 'Substernal chest compression / retrosternal heavy pressure' : '',
      hasRadiation ? 'Pain radiating to left arm, neck, or lower jaw' : '',
      hasDiaphoresis ? 'Associated profuse diaphoresis and autonomic symptoms' : '',
      hasDyspnea ? 'Concomitant shortness of breath / orthopnea' : '',
      hasHeartFailure ? 'Orthopnea, bilateral crackles/rales, peripheral edema' : '',
    ].filter(Boolean),
    supportingLabs: hasElevatedTroponin ? ['Cardiac Troponin: Positive / Elevated above 99th percentile cutoff'] : [],
    contradictoryFindings: [],
    missingInformation: [
      'Immediate 12-lead Electrocardiogram (ECG) performed within 10 minutes of presentation',
      'High-Sensitivity Cardiac Troponin (hs-cTn) level at 0h and 1h/3h',
    ],
    recommendedInvestigationsEn: [
      'Stat 12-lead Electrocardiogram (ECG) within 10 minutes',
      'High-sensitivity Cardiac Troponin (hs-cTnI or hs-cTnT) serial measurements',
      'Serum Electrolytes, Renal Profile, and Coagulation profile',
      'Bedside Echocardiography to assess regional wall motion abnormalities',
    ],
    recommendedInvestigationsBn: [
      '১০ মিনিটের মধ্যে জরুরি ১২-লিড ইসিজি (ECG)',
      'হাই-সেনসিটিভিটি কার্ডিয়াক ট্রপোনিন পরীক্ষা',
      'সিরাম ইলেক্ট্রোলাইট ও ক্রিয়েটিনিন',
      'জরুরি ইকোকার্ডিওগ্রাফি (Echocardiography)',
    ],
    redFlags: [
      '🚨 Active suspected Acute Myocardial Infarction: High immediate risk of ventricular fibrillation and sudden cardiac death',
      'Hemodynamic shock: SBP < 90 mmHg with pulmonary rales (Killip Class III/IV)',
    ],
    clinicalProtocolEn:
      'Immediate emergency stabilization: Chewable Aspirin 300 mg immediately, administer sublingual Nitroglycerin (unless SBP < 90 or RV infarction suspected), high-flow oxygen only if SpO2 < 90%. Stat 12-lead ECG. Immediate emergency cardiology transfer for primary PCI or thrombolytic therapy.',
    clinicalProtocolBn:
      'অবিলম্বে জরুরি ব্যবস্থা: ৩০০ মিলিগ্রাম অ্যাসপিরিন চিবিয়ে খেতে দিন, জিহ্বার নিচে নাইট্রোগ্লিসারিন স্প্রে/ট্যাবলেট দিন (প্রেসার ৯০ এর নিচে থাকলে নয়)। জরুরি ভিত্তিতে ইসিজি করে কার্ডিওলজি সেন্টারে স্থানান্তর করুন।',
    hospitalizationReferralCriteria: [
      'All patients with suspected Acute Coronary Syndrome require immediate emergency coronary care transfer (CCU / Cath Lab).',
    ],
    guidelineSources: [
      {
        title: 'ESC Guidelines for the Management of Acute Coronary Syndromes',
        organization: 'European Society of Cardiology (ESC)',
        year: 2023,
        url: 'https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines/Acute-Coronary-Syndromes-ACS',
        summary: 'Emergency diagnostic triage within 10 minutes, loading antiplatelet therapies, and reperfusion strategy.',
      },
    ],
  };
}

/**
 * 11. Gastrointestinal Disorders & Acute Abdomen Module
 */
export function evaluateGastrointestinalAcuteAbdomenModule(
  patient: StructuredPatientInput,
  labReport?: ComprehensiveLabReport
): DiseaseEvaluationResult | null {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
  ]
    .filter(Boolean)
    .join(' ');

  const hasAppendicitisSigns = textContainsAny(fullText, [
    'appendicitis',
    'mcburney',
    'migrated to rlq',
    'periumbilical',
    'right lower quadrant',
    'rlq',
    'navel',
  ]);
  const hasAbdominalPain = textContainsAny(fullText, [
    'abdominal pain',
    'abdomen',
    'stomach pain',
    'পেটে ব্যথা',
    'colic',
    'epigastric',
    'right lower quadrant',
    'rlq',
    'periumbilical',
    'navel',
    'mcburney',
  ]);
  const hasPeritonealSigns = textContainsAny(fullText, [
    'guarding',
    'rigidity',
    'rebound',
    'board-like',
    'পেট শক্ত',
    'স্পর্শ সহ্য হয় না',
    'peritonitis',
    'mcburney',
  ]);
  const hasBleeding = textContainsAny(fullText, ['hematemesis', 'melena', 'rectal bleeding', 'রক্ত বমি', 'কালো পায়খানা']);
  const hasVomiting = textContainsAny(fullText, ['vomiting', 'বমি', 'nausea']);
  const hasObstruction = textContainsAny(fullText, ['distension', 'obstipation', 'bilious vomiting', 'bowel obstruction']);
  const hasSevereDehydration = textContainsAny(fullText, ['severe dehydration', 'sunken eyes', 'skin pinch', 'shock', 'turgor']);
  const hasDiarrhea = textContainsAny(fullText, ['diarrhea', 'watery stools', 'loose stools', 'stools', 'gastroenteritis', 'ডায়রিয়া', 'পাতলা পায়খানা']);

  if (!hasAbdominalPain && !hasBleeding && !hasObstruction && !hasDiarrhea) return null;

  const isEmergency =
    hasPeritonealSigns ||
    hasBleeding ||
    hasObstruction ||
    (hasDiarrhea && hasSevereDehydration) ||
    hasAppendicitisSigns ||
    (hasAbdominalPain && hasVomiting && textContainsAny(fullText, ['severe', 'acute', 'তীব্র', 'migrated', 'rlq']));
  const isMildDiarrhea = hasDiarrhea && !hasSevereDehydration && !hasBleeding && !hasObstruction && !hasPeritonealSigns && !hasAppendicitisSigns;
  const acuity: ClinicalAcuity = isEmergency ? 'emergency' : isMildDiarrhea ? 'routine_followup' : 'needs_prompt_review';

  return {
    diseaseId: 'gastrointestinal_acute_abdomen',
    diseaseName: hasAppendicitisSigns
      ? 'Acute Appendicitis (Rule out Perforation / Peritonitis)'
      : hasPeritonealSigns
      ? 'Acute Surgical Abdomen / Peritoneal Signs (Rule out Perforation / Appendicitis / Obstruction)'
      : hasObstruction
      ? 'Acute Intestinal Bowel Obstruction'
      : hasBleeding
      ? 'Acute Upper / Lower Gastrointestinal Bleeding'
      : hasDiarrhea
      ? (isMildDiarrhea ? 'Mild Viral Gastroenteritis / Acute Diarrheal Illness' : 'Acute Diarrheal Illness / Gastroenteritis with Dehydration')
      : 'Acute Abdominal Pain Syndrome / Peptic Ulcer Disease',
    diseaseNameBn: hasAppendicitisSigns
      ? 'অ্যাকিউট অ্যাপেন্ডিসাইটিস (জরুরি সার্জারি মূল্যায়ন)'
      : hasPeritonealSigns
      ? 'অ্যাকিউট সার্জিক্যাল অ্যাবডোমেন / পেরিটোনাইটিস'
      : hasObstruction
      ? 'তীব্র অন্ত্রের বাধা (Bowel Obstruction)'
      : hasBleeding
      ? 'তীব্র গ্যাস্ট্রোইনটেস্টাইনাল রক্তক্ষরণ'
      : hasDiarrhea
      ? 'তীব্র ডায়রিয়া ও পানিশূন্যতা'
      : 'তীব্র পেটে ব্যথা / পেপটিক আলসার',
    classification: hasPeritonealSigns || hasBleeding ? 'suspected' : 'differential',
    acuity,
    confidence: hasPeritonealSigns || hasBleeding ? 'high' : 'moderate',
    confidenceExplanationEn: hasPeritonealSigns
      ? 'Physical signs of muscular guarding, rebound tenderness, or rigidity indicate acute peritoneal irritation requiring emergency surgical evaluation.'
      : 'Abdominal clinical presentation requiring prompt diagnostic exclusion of life-threatening intra-abdominal pathology.',
    confidenceExplanationBn: hasPeritonealSigns
      ? 'পেট শক্ত হয়ে যাওয়া এবং তীব্র স্পর্শকাতরতা পেরিটোনাইটিস ও জরুরি অপারেশনের প্রয়োজনীয়তা নির্দেশ করে।'
      : 'তীব্র পেট ব্যথার কারণ নিশ্চিত করতে জরুরি পর্যবেক্ষণ ও পরীক্ষা প্রয়োজন।',
    supportingSymptoms: [
      hasAbdominalPain ? 'Prominent acute abdominal pain' : '',
      hasPeritonealSigns ? 'Signs of peritoneal irritation: guarding, rebound tenderness, or board-like rigidity' : '',
      hasBleeding ? 'Evidence of acute GI hemorrhage (hematemesis or melena)' : '',
      hasVomiting ? 'Persistent vomiting and inability to retain fluids' : '',
    ].filter(Boolean),
    supportingLabs: labReport?.items.some((i) => i.key === 'wbc' && i.classification === 'high')
      ? ['Marked leukocytosis supporting acute intra-abdominal inflammation']
      : [],
    contradictoryFindings: [],
    missingInformation: [
      'Urgent abdominal ultrasonography (USG of whole abdomen) to assess appendix, gallbladder, pancreas, or free peritoneal fluid',
      'Erect abdominal and chest radiograph to rule out pneumoperitoneum (free gas under diaphragm)',
      'Serum Amylase / Lipase to evaluate acute pancreatitis',
    ],
    recommendedInvestigationsEn: [
      'Emergency Ultrasonography of Whole Abdomen',
      'Plain X-ray Abdomen (Erect & Supine) including domes of diaphragm',
      'Complete Blood Count (CBC) with differential count',
      'Serum Amylase and Lipase',
    ],
    recommendedInvestigationsBn: [
      'জরুরি সম্পূর্ণ পেটের আল্ট্রাসনোগ্রাফি (USG of Whole Abdomen)',
      'দাঁড়ানো অবস্থায় পেটের ও বুকের এক্স-রে (গ্যাস দেখার জন্য)',
      'রক্তের সম্পূর্ণ গণনা (CBC)',
      'সিরাম অ্যামাইলেজ ও লাইপেজ (অগ্ন্যাশয়ের প্রদাহ যাচাইয়ে)',
    ],
    redFlags: [
      hasPeritonealSigns ? '🚨 Peritoneal Signs (Board-like rigidity / rebound): imminent surgical emergency' : '',
      hasBleeding ? '🚨 Acute Gastrointestinal Hemorrhage: risk of rapid hypovolemic shock' : '',
    ].filter(Boolean),
    clinicalProtocolEn:
      'Nil per os (NPO) immediately. Establish wide-bore IV access and initiate isotonic IV crystalloid resuscitation. Avoid oral analgesics until surgical review. Immediate emergency general surgical or gastroenterological consultation.',
    clinicalProtocolBn:
      'মুখে খাবার ও পানি দেওয়া সম্পূর্ণ বন্ধ রাখুন (NPO)। দ্রুত স্যালাইন (IV fluid) চালু করুন। সার্জনের পরীক্ষা ছাড়া ব্যথানাশক দেওয়া পরিহার করুন। অবিলম্বে সার্জারি বিভাগে রেফার করুন।',
    hospitalizationReferralCriteria: [
      'Peritoneal signs (involuntary guarding, rebound tenderness, board-like abdomen)',
      'Acute gastrointestinal bleeding with hemodynamic compromise',
      'Suspected acute appendicitis, bowel obstruction, or viscus perforation',
    ],
    guidelineSources: [
      {
        title: 'WSES Guidelines for Management of Acute Abdomen and Peritonitis',
        organization: 'World Society of Emergency Surgery (WSES)',
        year: 2022,
        url: 'https://wses.biomedcentral.com/',
        summary: 'Surgical evaluation, diagnostic imaging algorithms, and hemodynamic resuscitation protocols.',
      },
    ],
  };
}

/**
 * 12. Chronic Respiratory Conditions (Asthma / COPD Exacerbation) Module
 */
export function evaluateRespiratoryAsthmaCopdModule(
  patient: StructuredPatientInput,
  // Same signature as the other disease modules; this one does not read labs.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _labReport?: ComprehensiveLabReport
): DiseaseEvaluationResult | null {
  const fullText = [
    patient.chief_complaint,
    ...(patient.symptoms || []),
    patient.history_of_present_illness,
    patient.clinical_notes,
    ...(patient.past_medical_history || []),
  ]
    .filter(Boolean)
    .join(' ');

  const hasHistory = textContainsAny(fullText, ['asthma', 'copd', 'ব্রঙ্কাইটিস', 'হাঁপানি', 'inhaler']);
  const hasWheeze = textContainsAny(fullText, ['wheeze', 'wheezing', 'rhonchi', 'শ্বাস টান', 'বাঁশির মত শব্দ', 'বুকে শাঁ শাঁ']);
  const hasDyspnea = textContainsAny(fullText, ['breathlessness', 'dyspnea', 'chest tightness', 'শ্বাসকষ্ট']);

  if (!hasHistory && !hasWheeze) return null;

  const vitals = patient.vitals || {};
  const isSevereAttack =
    (vitals.respiratory_rate !== undefined && vitals.respiratory_rate >= 30) ||
    (vitals.spo2_percent !== undefined && vitals.spo2_percent < 90) ||
    textContainsAny(fullText, ['silent chest', 'accessory muscle', 'cannot complete sentences', 'কথা বলতে পারে না']);

  const acuity: ClinicalAcuity = isSevereAttack ? 'emergency' : hasWheeze ? 'urgent' : 'routine_followup';

  return {
    diseaseId: 'respiratory_asthma_copd',
    diseaseName: isSevereAttack
      ? 'Severe Acute Exacerbation of Asthma / COPD (Life-Threatening Respiratory Compromise)'
      : 'Acute Bronchospasm / Asthma-COPD Exacerbation',
    diseaseNameBn: isSevereAttack
      ? 'তীব্র হাঁপানি বা সিওপিডি অ্যাটাক (Severe Asthma/COPD Exacerbation)'
      : 'ব্রঙ্কোস্পাজম / হাঁপানির তীব্রতা বৃদ্ধি',
    classification: hasHistory || hasWheeze ? 'confirmed' : 'suspected',
    acuity,
    confidence: hasWheeze || hasHistory ? 'high' : 'moderate',
    confidenceExplanationEn: 'Auscultatory expiratory wheezing, dyspnea, and response to bronchodilators.',
    confidenceExplanationBn: 'বুকে বাঁশির মত শব্দ (হুইজ), শ্বাসকষ্ট এবং ইনহেলার ব্যবহারের ইতিহাসের ভিত্তিতে চিহ্নিত।',
    supportingSymptoms: [
      hasWheeze ? 'Expiratory polyphonic wheezing on chest auscultation' : '',
      hasDyspnea ? 'Acute onset shortness of breath and chest tightness' : '',
      isSevereAttack ? 'Accessory muscle use / tachypnea >= 30/min' : '',
    ].filter(Boolean),
    supportingLabs: [],
    contradictoryFindings: [],
    missingInformation: [
      'Peak Expiratory Flow Rate (PEFR) before and after bronchodilator inhalation',
      'Arterial Blood Gas (ABG) analysis if severe hypoxemia or hypercapnia suspected',
    ],
    recommendedInvestigationsEn: [
      'Peak Expiratory Flow (PEF) measurement',
      'Continuous Pulse Oximetry (target 93-95% in asthma, 88-92% in COPD)',
      'Chest X-Ray (to rule out pneumothorax or superimposed consolidation)',
    ],
    recommendedInvestigationsBn: [
      'পিক এক্সপাইরেটরি ফ্লো (PEF) পরিমাপ',
      'পালস অক্সিমেট্রি (হাঁপানিতে ৯৩-৯৫%, সিওপিডিতে ৮৮-৯২% লক্ষ্যমাত্রা)',
      'বুকের এক্স-রে (নিউমোথোরাক্স বা সংক্রমণ বাতিল করতে)',
    ],
    redFlags: [
      isSevereAttack ? '🚨 Life-threatening Asthma/COPD Attack: Silent chest, cyanosis, exhaustion, or SpO2 < 90%' : '',
    ].filter(Boolean),
    clinicalProtocolEn:
      'High-dose inhaled SABA (Salbutamol) 2.5–5 mg combined with SAMA (Ipratropium) 0.5 mg via jet nebulizer. Controlled oxygen therapy. Early systemic corticosteroids (oral Prednisolone 40-50 mg or IV Hydrocortisone 100-200 mg). Re-evaluate within 15–30 minutes.',
    clinicalProtocolBn:
      'উচ্চ মাত্রায় সালবুটামল ও ইপ্রাট্রোপিয়াম নেবুলাইজার প্রয়োগ। নিয়ন্ত্রিত অক্সিজেন থেরাপি। দ্রুত মুখে বা শিরায় স্টেরয়েড (Prednisolone বা Hydrocortisone) নির্দেশিত।',
    hospitalizationReferralCriteria: [
      'PEFR < 50% predicted or lack of bronchodilator response after 1 hour of aggressive therapy',
      'Severe respiratory distress, drowsiness, confusion, or silent chest',
      'Persistent hypoxemia despite supplemental oxygen',
    ],
    guidelineSources: [
      {
        title: 'Global Strategy for Asthma Management and Prevention (GINA)',
        organization: 'Global Initiative for Asthma (GINA)',
        year: 2023,
        url: 'https://ginasthma.org/',
        summary: 'Classification of asthma exacerbation severity, nebulization protocols, and steroid stewardship.',
      },
    ],
  };
}

/**
 * MASTER EVALUATOR
 * Runs all 12 modules, calculates risk stratification, extracts dengue profile,
 * aggregates missing information, and ranks differentials by evidence weight and urgency.
 */
export function evaluateAllDiseaseReasoning(
  patient: StructuredPatientInput,
  labReport?: ComprehensiveLabReport
): MasterDiseaseReasoningOutput {
  // 1. Evaluate Dengue
  const dengueResult = evaluateDengueModule(patient, labReport);

  // 2. Evaluate remaining 11 modules
  const rawEvaluations: (DiseaseEvaluationResult | null)[] = [
    dengueResult.evaluation,
    evaluateCapModule(patient, labReport),
    evaluateMalariaModule(patient, labReport),
    evaluateInfluenzaModule(patient, labReport),
    evaluateCovid19Module(patient, labReport),
    evaluateDiabetesModule(patient, labReport),
    evaluateHypertensionModule(patient, labReport),
    evaluateKidneyDiseaseModule(patient, labReport),
    evaluateLiverDiseaseModule(patient, labReport),
    evaluateCardiovascularAcsModule(patient, labReport),
    evaluateGastrointestinalAcuteAbdomenModule(patient, labReport),
    evaluateRespiratoryAsthmaCopdModule(patient, labReport),
  ];

  const evaluatedDiseases: DiseaseEvaluationResult[] = rawEvaluations.filter(
    (item): item is DiseaseEvaluationResult => item !== null
  );

  // Rank differentials by urgency (emergency > urgent > prompt_review > routine) then confidence (high > mod > low)
  const urgencyWeight: Record<ClinicalAcuity, number> = {
    emergency: 4,
    urgent: 3,
    needs_prompt_review: 2,
    routine_followup: 1,
  };
  const confWeight: Record<ConfidenceLevel, number> = {
    high: 4,
    moderate: 3,
    low: 2,
    insufficient: 1,
  };

  const rankedDifferentials = [...evaluatedDiseases].sort((a, b) => {
    const diffUrg = urgencyWeight[b.acuity] - urgencyWeight[a.acuity];
    if (diffUrg !== 0) return diffUrg;
    return confWeight[b.confidence] - confWeight[a.confidence];
  });

  // Collect all critical alerts
  const criticalAlerts: string[] = [];
  const criticalAlertsBn: string[] = [];

  // Integrate critical laboratory panic alerts
  if (labReport && labReport.hasCriticalAlerts) {
    for (const ca of labReport.criticalAlerts) {
      criticalAlerts.push(`🚨 CRITICAL LAB ALERT: ${ca}`);
      criticalAlertsBn.push(`🚨 জরুরি ল্যাব সতর্কতা: ${ca}`);
    }
  }

  for (const d of evaluatedDiseases) {
    for (const rf of d.redFlags) {
      if (rf.startsWith('🚨') || d.acuity === 'emergency') {
        criticalAlerts.push(`${d.diseaseName}: ${rf}`);
        criticalAlertsBn.push(`${d.diseaseNameBn}: ${rf}`);
      }
    }
  }

  // Dengue specific emergency additions
  if (dengueResult.assessment.dengueClassification === 'severe') {
    criticalAlerts.push('🚨 CRITICAL DENGUE ALERT: Patient meets criteria for Severe Dengue / Plasma Leakage / Severe Thrombocytopenia. Immediate hospitalization indicated.');
    criticalAlertsBn.push('🚨 জরুরি ডেঙ্গু সতর্কতা: রোগীর তীব্র ডেঙ্গু / প্লাজমা লিকেজ / মারাত্মক প্লাটিলেট হ্রাসের লক্ষণ রয়েছে। অবিলম্বে হাসপাতালে ভর্তি প্রয়োজন।');
  } else if (dengueResult.assessment.ns1FalseNegativeWarning) {
    criticalAlerts.push(`⚠️ DENGUE TESTING WINDOW NOTICE: Dengue NS1 was tested on Day ${dengueResult.assessment.dayOfIllness} of illness. A negative NS1 test after Day 3 does NOT rule out dengue; perform Dengue IgM/IgG.`);
    criticalAlertsBn.push(`⚠️ ডেঙ্গু টেস্ট সতর্কবার্তা: জ্বরের ${dengueResult.assessment.dayOfIllness}তম দিনে NS1 পরীক্ষা করা হয়েছে। ৩ দিন পর নেগেটিভ NS1 ডেঙ্গু নাকচ করে না; ডেঙ্গু IgM/IgG টেস্ট প্রয়োজন।`);
  }

  // Vital Signs Emergency Checks
  const vitals = patient.vitals || {};
  let vitalsEmergency = false;

  if (vitals.temperature_celsius !== undefined && (vitals.temperature_celsius >= 40.0 || (vitals.temperature_celsius >= 39.5 && patient.age < 5))) {
    vitalsEmergency = true;
    criticalAlerts.push(`🚨 CRITICAL HYPERPYREXIA (${vitals.temperature_celsius}°C): High risk of febrile convulsions or heat injury. Immediate active antipyretic cooling required.`);
    criticalAlertsBn.push(`🚨 মারাত্মক উচ্চ জ্বর (${vitals.temperature_celsius}°C): খিঁচুনি ও শারীরিক জটিলতার তীব্র ঝুঁকি। অবিলম্বে শরীর মোছানো ও প্যারাসিটামল প্রয়োগ প্রয়োজন।`);
  }

  if (vitals.blood_pressure_systolic !== undefined && vitals.blood_pressure_systolic < 90) {
    vitalsEmergency = true;
    criticalAlerts.push(`🚨 HEMODYNAMIC SHOCK: Systolic BP < 90 mmHg. Immediate IV fluid resuscitation and hemodynamic stabilization indicated.`);
    criticalAlertsBn.push(`🚨 হেমোডায়নামিক শক: সিস্টোলিক রক্তচাপ < ৯০ mmHg। জরুরি স্যালাইন ও আইসিইউ পর্যবেক্ষণ প্রয়োজন।`);
  }

  if (vitals.blood_pressure_systolic !== undefined && vitals.blood_pressure_systolic >= 180) {
    vitalsEmergency = true;
    criticalAlerts.push(`🚨 HYPERTENSIVE CRISIS: Systolic BP >= 180 mmHg. Immediate risk of acute target organ damage.`);
    criticalAlertsBn.push(`🚨 মারাত্মক উচ্চ রক্তচাপ (Crisis): সিস্টোলিক রক্তচাপ ≥ ১৮০ mmHg। জরুরি অঙ্গহানির ঝুঁকি বিদ্যমান।`);
  }

  if (vitals.spo2_percent !== undefined && vitals.spo2_percent < 90) {
    vitalsEmergency = true;
    criticalAlerts.push(`🚨 CRITICAL HYPOXEMIA: SpO2 < 90%. Immediate high-flow supplemental oxygen therapy required.`);
    criticalAlertsBn.push(`🚨 মারাত্মক হাইপোক্সেমিয়া: SpO2 < ৯০%। তৎক্ষণাৎ জরুরি অক্সিজেন থেরাপি প্রয়োজন।`);
  }

  if (vitals.respiratory_rate !== undefined && vitals.respiratory_rate >= 32) {
    vitalsEmergency = true;
    criticalAlerts.push(`🚨 SEVERE TACHYPNEA: Respiratory rate >= 32/min. Indicator of acute respiratory exhaustion or severe metabolic acidosis.`);
    criticalAlertsBn.push(`🚨 তীব্র দ্রুত শ্বাসপ্রশ্বাস: গতি ≥ ৩২/মিনিট। তীব্র শ্বাসকষ্ট বা মেটাবলিক অ্যাসিডোসিসের স্পষ্ট লক্ষণ।`);
  }

  if (vitals.heart_rate !== undefined && vitals.heart_rate < 40) {
    vitalsEmergency = true;
    criticalAlerts.push(`🚨 SEVERE SYMPTOMATIC BRADYCARDIA: Heart rate < 40 bpm. Immediate risk of syncope, asystole, or hypoperfusion.`);
    criticalAlertsBn.push(`🚨 মারাত্মক ধীর হৃদস্পন্দন (Bradycardia): পালস < ৪০ bpm। অজ্ঞান হয়ে যাওয়া বা কার্ডিয়াক অ্যারেস্টের তীব্র ঝুঁকি।`);
  }

  // Aggregate missing info across all active modules
  const missingInfoSet = new Set<string>();
  for (const d of evaluatedDiseases) {
    for (const m of d.missingInformation) {
      missingInfoSet.add(m);
    }
  }

  return {
    dengueAssessment: dengueResult.assessment,
    evaluatedDiseases,
    rankedDifferentials,
    criticalAlerts,
    criticalAlertsBn,
    hasEmergency:
      vitalsEmergency ||
      Boolean(labReport && labReport.hasCriticalAlerts) ||
      rankedDifferentials.some((d) => d.acuity === 'emergency'),
    missingInformationOverall: Array.from(missingInfoSet),
  };
}
