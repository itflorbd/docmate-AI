import type { ClinicalScoreResult, ClinicalScoreVariable } from '@/types';

export interface Curb65Input {
  age?: number;
  confusion?: boolean;
  urea_mmol_per_l?: number;
  bun_mg_per_dl?: number;
  respiratory_rate?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
}

/**
 * Calculates CURB-65 or CRB-65 score for Community-Acquired Pneumonia acuity and disposition.
 * Reference: British Thoracic Society (BTS) & WHO Management Guidelines.
 */
export function calculateCurb65(input: Curb65Input): ClinicalScoreResult {
  const variables: ClinicalScoreVariable[] = [];
  let score = 0;

  // C - Confusion
  const isConfused = Boolean(input.confusion);
  variables.push({
    name: 'C: একিউট বিভ্রান্তি বা মানসিক ভারসাম্যহীনতা (Confusion)',
    value: isConfused ? 'Yes' : 'No',
    points: isConfused ? 1 : 0,
  });
  if (isConfused) score += 1;

  // U - Urea
  const hasUrea = input.urea_mmol_per_l !== undefined || input.bun_mg_per_dl !== undefined;
  const ureaHigh = (input.urea_mmol_per_l !== undefined && input.urea_mmol_per_l > 7.0) ||
    (input.bun_mg_per_dl !== undefined && input.bun_mg_per_dl > 19.0);

  if (hasUrea) {
    variables.push({
      name: 'U: ব্লাড ইউরিয়া > ৭.০ mmol/L (BUN > 19 mg/dL)',
      value: ureaHigh ? 'Elevated' : 'Normal',
      points: ureaHigh ? 1 : 0,
    });
    if (ureaHigh) score += 1;
  }

  // R - Respiratory Rate >= 30
  const isTachypneic = input.respiratory_rate !== undefined && input.respiratory_rate >= 30;
  variables.push({
    name: 'R: শ্বাসপ্রশ্বাসের গতি >= ৩০ /মিনিট (Respiratory Rate)',
    value: input.respiratory_rate !== undefined ? `${input.respiratory_rate}/min` : 'Not recorded',
    points: isTachypneic ? 1 : 0,
  });
  if (isTachypneic) score += 1;

  // B - Blood pressure (Systolic < 90 or Diastolic <= 60)
  const isHypotensive =
    (input.systolic_bp !== undefined && input.systolic_bp < 90) ||
    (input.diastolic_bp !== undefined && input.diastolic_bp <= 60);

  variables.push({
    name: 'B: নিম্ন রক্তচাপ (SBP < 90 বা DBP <= 60 mmHg)',
    value: input.systolic_bp !== undefined && input.diastolic_bp !== undefined
      ? `${input.systolic_bp}/${input.diastolic_bp} mmHg`
      : 'Not recorded',
    points: isHypotensive ? 1 : 0,
  });
  if (isHypotensive) score += 1;

  // 65 - Age >= 65
  const isElderly = input.age !== undefined && input.age >= 65;
  variables.push({
    name: '65: রোগীর বয়স ৬৫ বছর বা তার বেশি (Age >= 65)',
    value: input.age !== undefined ? `${input.age} yrs` : 'Not recorded',
    points: isElderly ? 1 : 0,
  });
  if (isElderly) score += 1;

  const maxScore = hasUrea ? 5 : 4;
  const calculatorId = hasUrea ? 'curb65' : 'crb65';

  let riskTier: ClinicalScoreResult['riskTier'] = 'low';
  let riskDescriptionBn = '';
  let riskDescriptionEn = '';
  let recommendationBn = '';
  let recommendationEn = '';

  if (score <= 1) {
    riskTier = 'low';
    riskDescriptionBn = `কম ঝুঁকি (Low Risk) - সম্ভাব্য মৃত্যুহার < ১.৫%`;
    riskDescriptionEn = `Low risk tier - estimated 30-day mortality < 1.5%`;
    recommendationBn = `রোগীকে বাসায় রেখে চিকিৎসা (Outpatient oral management) দেওয়া নিরাপদ বিবেচিত হয়। মুখে পর্যাপ্ত তরল ও অ্যান্টিবায়োটিক নিশ্চিত করুন।`;
    recommendationEn = `Suitable for outpatient treatment with oral antimicrobial therapy. Follow up within 48-72 hours.`;
  } else if (score === 2) {
    riskTier = 'moderate';
    riskDescriptionBn = `মাঝারি ঝুঁকি (Moderate Risk) - সম্ভাব্য মৃত্যুহার ~৯.২%`;
    riskDescriptionEn = `Intermediate risk tier - estimated 30-day mortality ~9.2%`;
    recommendationBn = `স্বল্পমেয়াদী হাসপাতালে ভর্তি বা নিবিড় বহির্বিভাগীয় পর্যবেক্ষণ (Hospital admission consideration) সুপারিশকৃত।`;
    recommendationEn = `Hospital referral or short inpatient observation recommended.`;
  } else {
    riskTier = score >= 4 ? 'critical' : 'high';
    riskDescriptionBn = `উচ্চ থেকে তীব্র ঝুঁকি (Severe Acuity) - সম্ভাব্য মৃত্যুহার ২২% বা ততোধিক`;
    riskDescriptionEn = `High to severe acuity - estimated 30-day mortality >= 22%`;
    recommendationBn = `অবিলম্বে হাসপাতালে ভর্তি (Inpatient Admission) এবং আইসিইউ (ICU/HDU) মূল্যায়ন আবশ্যক। প্যারেন্টেরাল অ্যান্টিবায়োটিক ও রেসপিরেটরি সাপোর্ট শুরু করুন।`;
    recommendationEn = `Urgent inpatient hospitalization indicated; assess criteria for ICU/HDU transfer. Initiate parenteral therapy immediately.`;
  }

  return {
    calculatorId,
    nameBn: hasUrea ? 'সিউআরবি-৬৫ নিউমোনিয়া তীব্রতা স্কোর (CURB-65)' : 'সিআরবি-৬৫ নিউমোনিয়া স্কোর (CRB-65)',
    nameEn: hasUrea ? 'CURB-65 Pneumonia Severity Score' : 'CRB-65 Pneumonia Severity Score',
    score,
    maxScore,
    riskTier,
    riskDescriptionBn,
    riskDescriptionEn,
    recommendationBn,
    recommendationEn,
    variables,
    sourceGuideline: 'British Thoracic Society (BTS) & WHO Pneumonia Guidelines',
  };
}

export interface DengueAssessmentInput {
  hasWarningSigns: boolean;
  warningSignsList: string[];
  plateletCount?: number;
  hematocritRaised?: boolean;
  systolicBp?: number;
  diastolicBp?: number;
  pulseRate?: number;
}

/**
 * Assesses Dengue Fever clinical phase and severity according to DGHS National Dengue Guideline.
 */
export function assessDengueProtocol(input: DengueAssessmentInput): ClinicalScoreResult {
  const variables: ClinicalScoreVariable[] = [];
  let score = 0;

  // Pulse pressure check (Narrow pulse pressure <= 20 mmHg indicates impending shock)
  const pulsePressure =
    input.systolicBp !== undefined && input.diastolicBp !== undefined
      ? input.systolicBp - input.diastolicBp
      : undefined;

  const isShock =
    (pulsePressure !== undefined && pulsePressure <= 20) ||
    (input.systolicBp !== undefined && input.systolicBp < 90);

  if (isShock) {
    score += 4;
    variables.push({
      name: 'কম্পেন্সেশনহীন শক / নিম্ন পালস প্রেসার (Narrow Pulse Pressure <= 20 mmHg)',
      value: `${pulsePressure} mmHg`,
      points: 4,
    });
  }

  if (input.hasWarningSigns) {
    score += 2;
    variables.push({
      name: 'সতর্কতামূলক লক্ষণ (Warning Signs Present)',
      value: input.warningSignsList.join(', ') || 'Present',
      points: 2,
    });
  }

  if (input.plateletCount !== undefined && input.plateletCount < 100000) {
    score += 1;
    variables.push({
      name: 'দ্রুত প্লাটিলেট হ্রাস (Platelets < 100,000 /mm³)',
      value: `${input.plateletCount} /mm³`,
      points: 1,
    });
  }

  let riskTier: ClinicalScoreResult['riskTier'] = 'low';
  let riskDescriptionBn = '';
  let riskDescriptionEn = '';
  let recommendationBn = '';
  let recommendationEn = '';

  if (isShock) {
    riskTier = 'critical';
    riskDescriptionBn = 'গ্রুপ সি: তীব্র ডেঙ্গু / ডেঙ্গু শক সিন্ড্রোম (Severe Dengue Shock)';
    riskDescriptionEn = 'Group C: Severe Dengue Shock Syndrome (DSS)';
    recommendationBn = 'জরুরি আইসিইউ/এইচডিইউ ভর্তি, তাত্ক্ষণিক নরমাল স্যালাইন বা রিঙ্গার্স ল্যাকটেট ২০ মিলি/কেজি বোলাস ইনফিউশন প্রটোকল শুরু করুন।';
    recommendationEn = 'Immediate emergency resuscitation: 20 mL/kg isotonic crystalloid bolus; urgent ICU admission.';
  } else if (input.hasWarningSigns || (input.plateletCount && input.plateletCount < 100000)) {
    riskTier = 'high';
    riskDescriptionBn = 'গ্রুপ বি: সতর্কচিহ্নযুক্ত ডেঙ্গু (Dengue with Warning Signs)';
    riskDescriptionEn = 'Group B: Dengue with Warning Signs (Hospital Admission Indicated)';
    recommendationBn = 'অবশ্যই হাসপাতালে ভর্তি করে হেমাটোক্রিট ও ইউরিন আউটপুট পর্যবেক্ষণ এবং টাইট্রেটেড আইভি ফ্লুইড থেরাপি দিন।';
    recommendationEn = 'Mandatory hospital admission: serial hematocrit, strict urine output monitoring, and titrated maintenance fluids.';
  } else {
    riskTier = 'low';
    riskDescriptionBn = 'গ্রুপ এ: সতর্কচিহ্নবিহীন ডেঙ্গু (Dengue without Warning Signs)';
    riskDescriptionEn = 'Group A: Dengue without Warning Signs';
    recommendationBn = 'পর্যাপ্ত ওরাল রিহাইড্রেশন সল্যুশন (ORS/তরল), প্যারাসিটামল (NSAIDs সম্পূর্ণ নিষিদ্ধ) এবং প্রতিদিন সিবিসি ফলো-আপ।';
    recommendationEn = 'Home fluid intake with ORS, oral Paracetamol (NSAIDs strictly contraindicated), and daily CBC review.';
  }

  return {
    calculatorId: 'dengue_warning',
    nameBn: 'জাতীয় ডেঙ্গু প্রটোকল ও সতর্কচিহ্ন অ্যাসেসমেন্ট (DGHS Dengue Assessment)',
    nameEn: 'DGHS National Dengue Assessment & Warning Signs Protocol',
    score,
    maxScore: 5,
    riskTier,
    riskDescriptionBn,
    riskDescriptionEn,
    recommendationBn,
    recommendationEn,
    variables,
    sourceGuideline: 'DGHS National Guideline for Clinical Management of Dengue',
  };
}
