// src/lib/clinical/lab-engine.ts
// DocMate AI — Intelligent Unit-Aware Laboratory Interpretation Engine
// Clinical Decision Support with Demographic-Specific Reference Intervals & Longitudinal Trend Detection

import type { LabValue } from '@/types';

export type LabClassification = 'low' | 'normal' | 'high' | 'critical' | 'borderline' | 'indeterminate';

export interface DemographicContext {
  age?: number;
  gender?: 'male' | 'female' | 'other';
  isPregnant?: boolean;
  pregnancyTrimester?: 1 | 2 | 3;
  clinicalContext?: string;
}

export interface InterpretedLabItem {
  key: string;
  testName: string;
  testNameBn: string;
  inputValue: string | number;
  normalizedNumericValue: number | null;
  inputUnit: string;
  normalizedUnit: string;
  referenceInterval: {
    min: number | null;
    max: number | null;
    unit: string;
    description: string;
    descriptionBn: string;
  };
  classification: LabClassification;
  isCritical: boolean;
  isEstimated: boolean;
  clinicalSignificanceEn: string;
  clinicalSignificanceBn: string;
  connectedConditions: string[];
  recommendedActionEn: string;
  recommendedActionBn: string;
  trend?: {
    direction: 'rising' | 'falling' | 'stable';
    deltaPercent: number;
    deltaAbsolute: number;
    isAdverse: boolean;
    trendClinicalSignificanceEn: string;
    trendClinicalSignificanceBn: string;
  };
}

export interface ComprehensiveLabReport {
  items: InterpretedLabItem[];
  hasAbnormalities: boolean;
  hasCriticalAlerts: boolean;
  criticalAlerts: string[];
  summaryEn: string;
  summaryBn: string;
  dengueRiskSignatures: {
    thrombocytopenia: boolean;
    hemoconcentration: boolean;
    leukopenia: boolean;
    ns1Positive: boolean;
    ns1Negative: boolean;
    hasWarningSigns: boolean;
  };
}

// Unit conversion helpers
export function normalizeLabUnit(unit: string): string {
  const clean = unit.trim().toLowerCase().replace(/\s+/g, '');
  if (['/ul', '/μl', '/mm3', '/mm^3', 'cells/ul', 'cells/μl', 'cells/mm3'].includes(clean)) return '/μL';
  if (['x10^9/l', '10^9/l', 'x10*9/l', '10*9/l', 'x10e9/l'].includes(clean)) return '×10^9/L';
  if (['x10^3/ul', 'x10^3/μl', '10^3/ul', 'k/ul', 'k/μl'].includes(clean)) return '×10^3/μL';
  if (['g/dl', 'gm/dl', 'g/100ml'].includes(clean)) return 'g/dL';
  if (['g/l', 'gm/l'].includes(clean)) return 'g/L';
  if (['%', 'percent', 'percentage'].includes(clean)) return '%';
  if (['mg/dl', 'mg%'].includes(clean)) return 'mg/dL';
  if (['umol/l', 'μmol/l', 'micromol/l'].includes(clean)) return 'μmol/L';
  if (['mmol/l', 'meq/l'].includes(clean)) return 'mmol/L';
  if (['mg/l'].includes(clean)) return 'mg/L';
  if (['mm/hr', 'mm/1sthr', 'mm/h'].includes(clean)) return 'mm/hr';
  if (['ng/ml', 'ug/l', 'μg/l'].includes(clean)) return 'ng/mL';
  if (['pg/ml', 'ng/l'].includes(clean)) return 'pg/mL';
  if (['u/l', 'iu/l'].includes(clean)) return 'U/L';
  if (['ml/min/1.73m2', 'ml/min/1.73m^2', 'ml/min'].includes(clean)) return 'mL/min/1.73m²';
  return unit.trim();
}

/**
 * Checks if the unit provided is clinically compatible with the test
 */
function isUnitCompatible(testKey: string, unit: string): boolean {
  const norm = normalizeLabUnit(unit);
  const allowedMap: Record<string, string[]> = {
    wbc: ['/μL', '×10^9/L', '×10^3/μL', ''],
    platelets: ['/μL', '×10^9/L', '×10^3/μL', ''],
    hemoglobin: ['g/dL', 'g/L', 'mmol/L', ''],
    hematocrit: ['%', 'L/L', ''],
    creatinine: ['mg/dL', 'μmol/L', ''],
    potassium: ['mmol/L', 'mEq/L', ''],
    sodium: ['mmol/L', 'mEq/L', ''],
    crp: ['mg/L', 'mg/dL', ''],
    esr: ['mm/hr', ''],
    troponin: ['ng/mL', 'pg/mL', 'μg/L', ''],
    egfr: ['mL/min/1.73m²', 'mL/min', ''],
    alt: ['U/L', 'IU/L', ''],
    ast: ['U/L', 'IU/L', ''],
    dengue_ns1: ['qualitative', 'serology', 'ag', ''],
  };

  const allowed = allowedMap[testKey];
  if (!allowed) return true; // generic test
  return allowed.some((a) => a.toLowerCase() === norm.toLowerCase());
}

/**
 * Normalizes input numeric value to standard canonical clinical unit
 */
function convertToStandardUnit(testKey: string, rawValue: number, unit: string): { val: number; unit: string } {
  const norm = normalizeLabUnit(unit);
  switch (testKey) {
    case 'wbc':
    case 'platelets':
      if (norm === '×10^9/L' || norm === '×10^3/μL') return { val: rawValue * 1000, unit: '/μL' };
      if (rawValue < 500 && norm !== '/μL') return { val: rawValue * 1000, unit: '/μL' };
      return { val: rawValue, unit: '/μL' };

    case 'hemoglobin':
      if (norm === 'g/L') return { val: rawValue / 10, unit: 'g/dL' };
      return { val: rawValue, unit: 'g/dL' };

    case 'creatinine':
      if (norm === 'μmol/L') return { val: Math.round((rawValue / 88.4) * 100) / 100, unit: 'mg/dL' };
      return { val: rawValue, unit: 'mg/dL' };

    case 'crp':
      if (norm === 'mg/dL') return { val: rawValue * 10, unit: 'mg/L' };
      return { val: rawValue, unit: 'mg/L' };

    default:
      return { val: rawValue, unit };
  }
}

/**
 * Intelligent Laboratory Interpretation Function
 */
export function interpretLabItem(
  lab: LabValue,
  context: DemographicContext = {},
  historicalLab?: LabValue
): InterpretedLabItem {
  const rawName = (lab.name || '').trim();
  const rawValStr = String(lab.value ?? '').trim().replace(/,/g, '');
  const rawUnit = (lab.unit || '').trim();
  const parsedNum = parseFloat(rawValStr);
  const isNumeric = !isNaN(parsedNum);

  const age = context.age ?? 35;
  const gender = context.gender ?? 'male';
  const isPregnant = context.isPregnant ?? false;

  const nameLower = rawName.toLowerCase();

  // Test identification
  let testKey = 'unknown';
  let testName = rawName;
  let testNameBn = rawName;

  if (/\b(?:wbc|tlc|total\s*(?:leukocyte|count)|শ্বেত\s*রক্তকণিকা)\b/i.test(nameLower)) {
    testKey = 'wbc';
    testName = 'Total Leukocyte Count (WBC / TLC)';
    testNameBn = 'মোট শ্বেত রক্তকণিকা (WBC/TLC)';
  } else if (/\b(?:platelet|platelets|plt|প্লাটিলেট)\b/i.test(nameLower)) {
    testKey = 'platelets';
    testName = 'Platelet Count (PLT)';
    testNameBn = 'প্লাটিলেট সংখ্যা (PLT)';
  } else if (/\b(?:hemoglobin|haemoglobin|hb|হিমোগ্লোবিন)\b/i.test(nameLower)) {
    testKey = 'hemoglobin';
    testName = 'Hemoglobin (Hb)';
    testNameBn = 'হিমোগ্লোবিন (Hb)';
  } else if (/\b(?:hematocrit|haematocrit|hct|pcv|হেমাটোক্রিট)\b/i.test(nameLower)) {
    testKey = 'hematocrit';
    testName = 'Hematocrit (HCT / PCV)';
    testNameBn = 'হেমাটোক্রিট (HCT / PCV)';
  } else if (/\b(?:creatinine|s\.?\s*creat|serum\s*creat|ক্রিয়েটিনিন)\b/i.test(nameLower)) {
    testKey = 'creatinine';
    testName = 'Serum Creatinine';
    testNameBn = 'সেরাম ক্রিয়েটিনিন';
  } else if (/\b(?:potassium|k\+|পটাশিয়াম)\b/i.test(nameLower)) {
    testKey = 'potassium';
    testName = 'Serum Potassium (K+)';
    testNameBn = 'সেরাম পটাশিয়াম (K+)';
  } else if (/\b(?:sodium|na\+|সোডিয়াম)\b/i.test(nameLower)) {
    testKey = 'sodium';
    testName = 'Serum Sodium (Na+)';
    testNameBn = 'সেরাম সোডিয়াম (Na+)';
  } else if (/\b(?:crp|c-reactive\s*protein)\b/i.test(nameLower)) {
    testKey = 'crp';
    testName = 'C-Reactive Protein (CRP)';
    testNameBn = 'সি-রিঅ্যাক্টিভ প্রোটিন (CRP)';
  } else if (/\b(?:esr|sedimentation\s*rate)\b/i.test(nameLower)) {
    testKey = 'esr';
    testName = 'Erythrocyte Sedimentation Rate (ESR)';
    testNameBn = 'ইএসআর (ESR)';
  } else if (/\b(?:ns1|dengue\s*ns1|ডেঙ্গু\s*এনএস১)\b/i.test(nameLower)) {
    testKey = 'dengue_ns1';
    testName = 'Dengue NS1 Antigen';
    testNameBn = 'ডেঙ্গু এনএস১ অ্যান্টিজেন';
  } else if (/\b(?:troponin|trop\s*i|trop\s*t|ট্রপোনিন)\b/i.test(nameLower)) {
    testKey = 'troponin';
    testName = 'Cardiac Troponin I / T';
    testNameBn = 'কার্ডিয়াক ট্রপোনিন (Troponin I/T)';
  } else if (/\b(?:egfr|gfr|estimated\s*gfr)\b/i.test(nameLower)) {
    testKey = 'egfr';
    testName = 'Estimated GFR (eGFR)';
    testNameBn = 'আনুমানিক জিএফআর (eGFR)';
  }

  // Check unit compatibility
  if (testKey !== 'unknown' && rawUnit && !isUnitCompatible(testKey, rawUnit)) {
    return {
      key: testKey,
      testName,
      testNameBn,
      inputValue: lab.value,
      normalizedNumericValue: null,
      inputUnit: rawUnit,
      normalizedUnit: rawUnit,
      referenceInterval: {
        min: null,
        max: null,
        unit: rawUnit,
        description: 'Incompatible unit provided (Uninterpretable)',
        descriptionBn: 'অসঙ্গতিপূর্ণ একক প্রদান করা হয়েছে (অবিশ্লেষণযোগ্য)',
      },
      classification: 'indeterminate',
      isCritical: false,
      isEstimated: false,
      clinicalSignificanceEn: `Invalid or incompatible unit "${rawUnit}" for ${testName}. Clinical interpretation withheld to prevent medical miscalculation.`,
      clinicalSignificanceBn: `${testName}-এর জন্য "${rawUnit}" এককটি অসঙ্গতিপূর্ণ। ভুল চিকিৎসার ঝুঁকি এড়াতে এর ক্লিনিকাল বিশ্লেষণ স্থগিত রাখা হয়েছে।`,
      connectedConditions: [],
      recommendedActionEn: 'Verify laboratory unit and re-enter with standard units.',
      recommendedActionBn: 'ল্যাবরেটরি রিপোর্ট থেকে সঠিক একক দেখে পুনরায় ইনপুট দিন।',
    };
  }

  // 1. DENGUE NS1 QUALITATIVE
  if (testKey === 'dengue_ns1') {
    const isPositive = /\b(?:pos|positive|reactive|detect|পজিটিভ|শনাক্ত)\b/i.test(rawValStr);
    const isNegative = /\b(?:neg|negative|non-reactive|not\s*detect|নেগেটিভ)\b/i.test(rawValStr);

    if (isPositive) {
      return {
        key: 'dengue_ns1',
        testName,
        testNameBn,
        inputValue: 'Positive',
        normalizedNumericValue: null,
        inputUnit: 'Qualitative',
        normalizedUnit: 'Qualitative',
        referenceInterval: {
          min: null,
          max: null,
          unit: 'Qualitative',
          description: 'Negative',
          descriptionBn: 'নেগেটিভ (স্বাভাবিক)',
        },
        classification: 'critical',
        isCritical: true,
        isEstimated: false,
        clinicalSignificanceEn:
          'Positive Dengue NS1 confirms active acute Dengue virus viremia (highly sensitive in Days 1-5 of illness). Patient is at risk of entering the critical plasma leakage phase around defervescence (Days 4-6). Close monitoring of serial platelet count and hematocrit is vital.',
        clinicalSignificanceBn:
          'ডেঙ্গু NS1 পজিটিভ সক্রিয় অ্যাকিউট ডেঙ্গু ভাইরাস সংক্রমণ নিশ্চিত করে (জ্বরের ১ম-৫ম দিনে অত্যন্ত সংবেদনশীল)। রোগী ৪র্থ-৬ষ্ঠ দিনে ক্রিটিক্যাল প্লাজমা লিকেজ পর্যায়ে প্রবেশ করতে পারে। নিয়মিত প্লাটিলেট ও হেমাটোক্রিট পর্যবেক্ষণ অত্যন্ত জরুরি।',
        connectedConditions: ['Acute Dengue Fever', 'Dengue with Warning Signs', 'Viral Hemorrhagic Fever'],
        recommendedActionEn:
          'Perform baseline CBC with hematocrit, assess for WHO dengue warning signs (persistent vomiting, abdominal pain), and enforce oral/IV isotonic hydration.',
        recommendedActionBn:
          'অবিলম্বে বেসলাইন সিবিসি ও হেমাটোক্রিট পরীক্ষা করুন, ডেঙ্গু বিপদ সংকেত পর্যবেক্ষণ করুন এবং তরল খাবার বা স্যালাইন নিশ্চিত করুন।',
      };
    }

    if (isNegative) {
      return {
        key: 'dengue_ns1',
        testName,
        testNameBn,
        inputValue: 'Negative',
        normalizedNumericValue: null,
        inputUnit: 'Qualitative',
        normalizedUnit: 'Qualitative',
        referenceInterval: {
          min: null,
          max: null,
          unit: 'Qualitative',
          description: 'Negative',
          descriptionBn: 'নেগেটিভ (স্বাভাবিক)',
        },
        classification: 'normal',
        isCritical: false,
        isEstimated: false,
        clinicalSignificanceEn:
          'Negative Dengue NS1 does NOT exclude dengue infection, particularly if tested after Day 4-5 of fever when NS1 antigenemia clears and antibodies emerge, or in secondary infections. Clinical correlation with CBC and symptom duration is required.',
        clinicalSignificanceBn:
          'ডেঙ্গু NS1 নেগেটিভ হলেও ডেঙ্গুর সম্ভাবনা সম্পূর্ণ বাতিল হয় না (বিশেষ করে জ্বরের ৪র্থ-৫ম দিনের পর বা দ্বিতীয়বার ডেঙ্গু হলে NS1 নেগেটিভ আসতে পারে)। সিবিসি এবং লক্ষণ পর্যালোচনা আবশ্যক।',
        connectedConditions: ['Non-Dengue Acute Febrile Illness', 'Late-presenting Dengue', 'Viral Syndrome'],
        recommendedActionEn:
          'Evaluate illness duration. If fever has persisted > 4 days, consider Dengue IgM serology and evaluate platelet count.',
        recommendedActionBn:
          'জ্বরের স্থায়িত্ব পর্যালোচনা করুন। জ্বর ৪ দিনের বেশি হলে ডেঙ্গু IgM পরীক্ষা এবং প্লাটিলেট কাউন্ট পর্যবেক্ষণ করুন।',
      };
    }
  }

  // 2. HEMATOLOGY & BIOCHEMISTRY NUMERIC INTERPRETATIONS
  if (!isNumeric) {
    return {
      key: testKey,
      testName,
      testNameBn,
      inputValue: lab.value,
      normalizedNumericValue: null,
      inputUnit: rawUnit,
      normalizedUnit: rawUnit,
      referenceInterval: {
        min: null,
        max: null,
        unit: rawUnit,
        description: 'Qualitative / Text finding',
        descriptionBn: 'বর্ণনামূলক ফলাফল',
      },
      classification: 'indeterminate',
      isCritical: false,
      isEstimated: false,
      clinicalSignificanceEn: `Result: ${lab.value}. Descriptive or non-numeric observation.`,
      clinicalSignificanceBn: `ফলাফল: ${lab.value}। বর্ণনামূলক ক্লিনিকাল পর্যবেক্ষণ।`,
      connectedConditions: [],
      recommendedActionEn: 'Review finding in clinical context.',
      recommendedActionBn: 'ক্লিনিকাল প্রেক্ষাপটে বিবেচনা করুন।',
    };
  }

  const { val: stdVal, unit: stdUnit } = convertToStandardUnit(testKey, parsedNum, rawUnit);

  // Dynamic Reference Intervals based on demographics
  switch (testKey) {
    case 'platelets': {
      // Platelets: Normal 150,000 - 450,000 /μL
      // Pregnancy: gestational thrombocytopenia can lower threshold to 120,000
      const minRef = isPregnant ? 120000 : 150000;
      const maxRef = 450000;
      let classification: LabClassification = 'normal';
      let isCritical = false;

      if (stdVal < 20000) {
        classification = 'critical';
        isCritical = true;
      } else if (stdVal < 50000) {
        classification = 'critical';
        isCritical = true;
      } else if (stdVal < 100000) {
        classification = 'high'; // high severity thrombocytopenia
      } else if (stdVal < minRef) {
        classification = 'low';
      } else if (stdVal > maxRef) {
        classification = 'high';
      }

      // Check longitudinal trend if historical available
      let trendData: InterpretedLabItem['trend'] = undefined;
      if (historicalLab && !isNaN(parseFloat(String(historicalLab.value)))) {
        const histNum = parseFloat(String(historicalLab.value).replace(/,/g, ''));
        const histConv = convertToStandardUnit('platelets', histNum, historicalLab.unit || stdUnit).val;
        const delta = stdVal - histConv;
        const deltaPct = Math.round((delta / histConv) * 100);
        const isSteepDrop = deltaPct <= -20 || (histConv > 100000 && stdVal < 100000);

        trendData = {
          direction: delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'stable',
          deltaPercent: deltaPct,
          deltaAbsolute: delta,
          isAdverse: isSteepDrop,
          trendClinicalSignificanceEn: isSteepDrop
            ? `Critical rapid platelet decline (${deltaPct}% drop from ${histConv.toLocaleString()} to ${stdVal.toLocaleString()}/μL). In febrile illness, this indicates acute viral destruction / plasma leakage phase in Dengue or severe sepsis.`
            : `Platelet trend is ${delta >= 0 ? 'improving/stable' : 'gradually declining'} (${deltaPct}%).`,
          trendClinicalSignificanceBn: isSteepDrop
            ? `তীব্র দ্রুত প্লাটিলেট হ্রাস (${histConv.toLocaleString()} থেকে ${stdVal.toLocaleString()}/μL, ${Math.abs(deltaPct)}% পতন)। তীব্র জ্বরে এটি ডেঙ্গুর ক্রিটিক্যাল ফেজ বা সেপসিসের জরুরি বিপদ সংকেত।`
            : `প্লাটিলেটের পরিবর্তন ${delta >= 0 ? 'উন্নতি/স্থির' : 'হ্রাসমান'} (${deltaPct}%)।`,
        };
      }

      const sigEn =
        stdVal < 50000
          ? `Severe Thrombocytopenia (${stdVal.toLocaleString()} /μL): Critical bleeding risk. High risk of spontaneous mucosal bleeding. Immediate hospitalization and strict rest required.`
          : stdVal < 100000
          ? `Significant Thrombocytopenia (${stdVal.toLocaleString()} /μL): Consistent with WHO Dengue warning marker or severe systemic infection. Monitor hematocrit closely for plasma leakage.`
          : stdVal < minRef
          ? `Mild Thrombocytopenia (${stdVal.toLocaleString()} /μL): May indicate early viral suppression or consumptive coagulopathy.`
          : `Platelet count (${stdVal.toLocaleString()} /μL) is within physiological hemostatic range.`;

      const sigBn =
        stdVal < 50000
          ? `মারাত্মক থ্রম্বোসাইটোপেনিয়া (${stdVal.toLocaleString()} /μL): স্বতঃস্ফূর্ত রক্তক্ষরণের তীব্র ঝুঁকি! অবিলম্বে হাসপাতালে ভর্তি ও সম্পূর্ণ বিশ্রাম নিশ্চিত করুন।`
          : stdVal < 100000
          ? `গুরুত্বপূর্ণ থ্রম্বোসাইটোপেনিয়া (${stdVal.toLocaleString()} /μL): ডেঙ্গুর অন্যতম প্রধান সতর্কতা সংকেত। হেমাটোক্রিট পর্যবেক্ষণ করে প্লাজমা লিকেজ যাচাই করুন।`
          : stdVal < minRef
          ? `হালকা থ্রম্বোসাইটোপেনিয়া (${stdVal.toLocaleString()} /μL): প্রাথমিক ভাইরাল সংক্রমণ নির্দেশ করে।`
          : `প্লাটিলেট সংখ্যা (${stdVal.toLocaleString()} /μL) স্বাভাবিক মাত্রায় রয়েছে।`;

      return {
        key: 'platelets',
        testName,
        testNameBn,
        inputValue: lab.value,
        normalizedNumericValue: stdVal,
        inputUnit: rawUnit || stdUnit,
        normalizedUnit: stdUnit,
        referenceInterval: {
          min: minRef,
          max: maxRef,
          unit: stdUnit,
          description: `${minRef.toLocaleString()} - ${maxRef.toLocaleString()} /μL`,
          descriptionBn: `${minRef.toLocaleString()} - ${maxRef.toLocaleString()} /μL`,
        },
        classification,
        isCritical,
        isEstimated: false,
        clinicalSignificanceEn: sigEn,
        clinicalSignificanceBn: sigBn,
        connectedConditions: ['Dengue Fever', 'Viral Hemorrhagic Fever', 'Immune Thrombocytopenia', 'Sepsis'],
        recommendedActionEn:
          stdVal < 100000
            ? 'Repeat CBC in 12-24 hours. Avoid NSAIDs, Aspirin, and intramuscular injections.'
            : 'Maintain standard observation.',
        recommendedActionBn:
          stdVal < 100000
            ? '১২-২৪ ঘণ্টার মধ্যে সিবিসি পুনরাবৃত্তি করুন। এসপিরিন, আইবুপ্রোফেন ও আইএম ইনজেকশন সম্পূর্ণ নিষেধ।'
            : 'স্বাভাবিক পর্যবেক্ষণ বজায় রাখুন।',
        trend: trendData,
      };
    }

    case 'hematocrit': {
      // Normal HCT: Male 40-52%, Female 36-48%, Pregnant 33-44%
      const minRef = isPregnant ? 33 : gender === 'female' ? 36 : 40;
      const maxRef = isPregnant ? 44 : gender === 'female' ? 48 : 52;
      let classification: LabClassification = 'normal';
      let isCritical = false;

      // Check longitudinal trend if historical available
      let trendData: InterpretedLabItem['trend'] = undefined;
      if (historicalLab && !isNaN(parseFloat(String(historicalLab.value)))) {
        const histNum = parseFloat(String(historicalLab.value).replace(/,/g, ''));
        const delta = stdVal - histNum;
        const deltaPct = Math.round((delta / histNum) * 100);
        const isSignificantRise = deltaPct >= 20 || stdVal > maxRef;

        trendData = {
          direction: delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'stable',
          deltaPercent: deltaPct,
          deltaAbsolute: delta,
          isAdverse: isSignificantRise,
          trendClinicalSignificanceEn: isSignificantRise
            ? `Critical rising hematocrit (+${deltaPct}% from baseline ${histNum}% to ${stdVal}%). In febrile illness, a ≥ 20% rise defines significant hemoconcentration and active plasma leakage (WHO Dengue Warning Sign).`
            : `Hematocrit trend is ${delta >= 0 ? 'rising' : 'falling'} by ${Math.abs(deltaPct)}%.`,
          trendClinicalSignificanceBn: isSignificantRise
            ? `হেমাটোক্রিটের তীব্র বৃদ্ধি (${histNum}% থেকে ${stdVal}%, +${deltaPct}%)। ডেঙ্গু জ্বরে ২০% বা তদূর্ধ্ব বৃদ্ধি ক্রিটিক্যাল প্লাজমা লিকেজের স্পষ্ট প্রমাণ।`
            : `হেমাটোক্রিট ট্রেন্ড ${delta >= 0 ? 'বৃদ্ধি' : 'হ্রাস'} (${Math.abs(deltaPct)}%)।`,
        };

        if (deltaPct >= 20) {
          classification = 'critical';
          isCritical = true;
        }
      }

      if (!isCritical) {
        if (stdVal > maxRef * 1.2) {
          classification = 'critical';
          isCritical = true; // > 20% hemoconcentration
        } else if (stdVal > maxRef) {
          classification = 'high';
        } else if (stdVal < 25) {
          classification = 'critical';
          isCritical = true;
        } else if (stdVal < minRef) {
          classification = 'low';
        }
      }

      return {
        key: 'hematocrit',
        testName,
        testNameBn,
        inputValue: lab.value,
        normalizedNumericValue: stdVal,
        inputUnit: rawUnit || '%',
        normalizedUnit: '%',
        referenceInterval: {
          min: minRef,
          max: maxRef,
          unit: '%',
          description: `${minRef}% - ${maxRef}% (${gender}${isPregnant ? ', pregnant' : ''})`,
          descriptionBn: `${minRef}% - ${maxRef}% (${gender === 'female' ? 'নারী' : 'পুরুষ'})`,
        },
        classification,
        isCritical,
        isEstimated: false,
        clinicalSignificanceEn:
          stdVal > maxRef || (trendData && trendData.deltaPercent >= 20)
            ? `Elevated Hematocrit (${stdVal}%): Indicates hemoconcentration and intravascular volume depletion. In febrile patients with thrombocytopenia, a ≥ 20% rise is a hallmark of Dengue plasma leakage.`
            : stdVal < minRef
            ? `Decreased Hematocrit (${stdVal}%): Consistent with anemia, fluid hemodilution, or occult hemorrhage.`
            : `Hematocrit (${stdVal}%) is within expected physiological range.`,
        clinicalSignificanceBn:
          stdVal > maxRef || (trendData && trendData.deltaPercent >= 20)
            ? `উচ্চ হেমাটোক্রিট (${stdVal}%): রক্ত ঘন হওয়া এবং রক্তের তরল অংশ ক্ষরণ (প্লাজমা লিকেজ) নির্দেশ করে। ডেঙ্গু জ্বরে ২০% বা তদূর্ধ্ব বৃদ্ধি ক্রিটিক্যাল প্লাজমা লিকেজের প্রমাণ।`
            : stdVal < minRef
            ? `কম হেমাটোক্রিট (${stdVal}%): রক্তস্বল্পতা বা অতিরিক্ত তরল গ্রহণের ইঙ্গিত।`
            : `হেমাটোক্রিট (${stdVal}%) স্বাভাবিক সীমার মধ্যে আছে।`,
        connectedConditions: ['Dengue Plasma Leakage', 'Hemoconcentration', 'Dehydration', 'Polycythemia'],
        recommendedActionEn:
          stdVal > maxRef || (trendData && trendData.deltaPercent >= 20)
            ? 'Initiate prompt isotonic fluid replacement (Normal Saline or Ringer’s Lactate). Titrate to urine output.'
            : 'Routine follow-up.',
        recommendedActionBn:
          stdVal > maxRef || (trendData && trendData.deltaPercent >= 20)
            ? 'তাৎক্ষণিক আইসোটনিক স্যালাইন (নরমাল স্যালাইন বা ডিএনএস) শুরু করুন এবং প্রস্রাবের পরিমাণ পর্যবেক্ষণ করুন।'
            : 'নিয়মিত পর্যবেক্ষণ।',
        trend: trendData,
      };
    }

    case 'wbc': {
      // Normal WBC: 4,000 - 11,000 /μL. Pediatric: up to 15,000 in young children
      const minRef = 4000;
      const maxRef = age < 5 ? 15000 : 11000;
      let classification: LabClassification = 'normal';
      let isCritical = false;

      if (stdVal > 25000 || stdVal < 1500) {
        classification = 'critical';
        isCritical = true;
      } else if (stdVal > maxRef) {
        classification = 'high';
      } else if (stdVal < minRef) {
        classification = 'low';
      }

      return {
        key: 'wbc',
        testName,
        testNameBn,
        inputValue: lab.value,
        normalizedNumericValue: stdVal,
        inputUnit: rawUnit || '/μL',
        normalizedUnit: '/μL',
        referenceInterval: {
          min: minRef,
          max: maxRef,
          unit: '/μL',
          description: `${minRef.toLocaleString()} - ${maxRef.toLocaleString()} /μL`,
          descriptionBn: `${minRef.toLocaleString()} - ${maxRef.toLocaleString()} /μL`,
        },
        classification,
        isCritical,
        isEstimated: false,
        clinicalSignificanceEn:
          stdVal > maxRef
            ? `Leukocytosis (${stdVal.toLocaleString()} /μL): Acute bacterial pyogenic infection (e.g. Community-Acquired Pneumonia) or systemic inflammatory response.`
            : stdVal < minRef
            ? `Leukopenia (${stdVal.toLocaleString()} /μL): Characteristic of acute viral infections (Dengue, Influenza, Typhoid) or bone marrow suppression.`
            : `Total leukocyte count (${stdVal.toLocaleString()} /μL) is within baseline physiological limits.`,
        clinicalSignificanceBn:
          stdVal > maxRef
            ? `লিউকোসাইটোসিস (${stdVal.toLocaleString()} /μL): ব্যাকটেরিয়াল সংক্রমণ (যেমন: নিউমোনিয়া) বা শরীরের প্রদাহজনক প্রতিক্রিয়া নির্দেশ করে।`
            : stdVal < minRef
            ? `লিউকোপেনিয়া (${stdVal.toLocaleString()} /μL): তীব্র ভাইরাল সংক্রমণ (যেমন: ডেঙ্গু, ইনফ্লুয়েঞ্জা) অথবা টাইফয়েড জ্বরের পরিচিত লক্ষণ।`
            : `মোট শ্বেত রক্তকণিকা (${stdVal.toLocaleString()} /μL) স্বাভাবিক সীমার মধ্যে রয়েছে।`,
        connectedConditions: ['Bacterial Pneumonia', 'Dengue Fever', 'Enteric Fever (Typhoid)', 'Sepsis'],
        recommendedActionEn:
          stdVal > maxRef
            ? 'Evaluate differential count (neutrophils vs lymphocytes) and assess for bacterial focus.'
            : 'Monitor for concurrent thrombocytopenia and viral progression.',
        recommendedActionBn:
          stdVal > maxRef
            ? 'নিউট্রোফিল শতকরা হার দেখুন এবং ব্যাকটেরিয়াল সংক্রমণের উৎস নির্ণয় করুন।'
            : 'প্লাটিলেট এবং ভাইরাল লক্ষণের অগ্রগতি পর্যবেক্ষণ করুন।',
      };
    }

    case 'hemoglobin': {
      // Male 13.5 - 17.5 g/dL, Female 12.0 - 15.5 g/dL, Pregnant 11.0 (Trimester 2: 10.5) - 14.0 g/dL, Neonate: 14.0 - 20.0 g/dL
      let minRef = 13.5;
      let maxRef = 17.5;
      if (age < 0.08) {
        minRef = 14.0;
        maxRef = 20.0;
      } else if (age < 5) {
        minRef = 11.0;
        maxRef = 14.0;
      } else if (isPregnant) {
        minRef = context.pregnancyTrimester === 2 ? 10.5 : 11.0;
        maxRef = 14.0;
      } else if (gender === 'female') {
        minRef = 12.0;
        maxRef = 15.5;
      }

      let classification: LabClassification = 'normal';
      let isCritical = false;

      if (stdVal < 7.0 || (age < 0.08 && stdVal < 11.0)) {
        classification = 'critical';
        isCritical = true;
      } else if (stdVal < minRef) {
        classification = 'low';
      } else if (stdVal > maxRef) {
        classification = 'high';
      }

      return {
        key: 'hemoglobin',
        testName,
        testNameBn,
        inputValue: lab.value,
        normalizedNumericValue: stdVal,
        inputUnit: rawUnit || 'g/dL',
        normalizedUnit: 'g/dL',
        referenceInterval: {
          min: minRef,
          max: maxRef,
          unit: 'g/dL',
          description: `${minRef} - ${maxRef} g/dL (${gender}${isPregnant ? ', pregnancy threshold' : ''})`,
          descriptionBn: `${minRef} - ${maxRef} g/dL`,
        },
        classification,
        isCritical,
        isEstimated: false,
        clinicalSignificanceEn:
          stdVal < 7.0
            ? `Severe Anemia (Hb ${stdVal} g/dL): Critical oxygen-carrying compromise. Immediate blood transfusion assessment and cardiovascular stability evaluation indicated.`
            : stdVal < minRef
            ? `Anemia (Hb ${stdVal} g/dL): Mild to moderate reduction in oxygen-carrying capacity.`
            : `Hemoglobin (${stdVal} g/dL) is within physiological target range.`,
        clinicalSignificanceBn:
          stdVal < 7.0
            ? `মারাত্মক অ্যানিমিয়া (Hb ${stdVal} g/dL): জরুরি রক্ত সঞ্চালন (Blood Transfusion) মূল্যায়ন প্রয়োজন।`
            : stdVal < minRef
            ? `রক্তস্বল্পতা (Hb ${stdVal} g/dL): হালকা থেকে মাঝারি মাত্রার অ্যানিমিয়া। আয়রন বা পুষ্টির উৎস মূল্যায়ন করুন।`
            : `হিমোগ্লোবিন (${stdVal} g/dL) স্বাভাবিক রয়েছে।`,
        connectedConditions: ['Anemia', 'Occult Hemorrhage', 'Nutritional Deficiency', 'Chronic Disease Anemia'],
        recommendedActionEn: stdVal < 7.0 ? 'Stat cross-match and urgent inpatient referral.' : 'Dietary and iron evaluation.',
        recommendedActionBn: stdVal < 7.0 ? 'জরুরি রক্ত ক্রস-ম্যাচিং ও হাসপাতালে ভর্তি।' : 'পুষ্টিকর খাদ্য ও আয়রন প্রোফাইল পরীক্ষা।',
      };
    }

    case 'creatinine': {
      // Male 0.7 - 1.3 mg/dL, Female 0.5 - 1.1 mg/dL, Elderly lower muscle mass
      const minRef = 0.5;
      const maxRef = gender === 'female' ? 1.1 : 1.3;
      let classification: LabClassification = 'normal';
      let isCritical = false;

      if (stdVal > 3.0) {
        classification = 'critical';
        isCritical = true;
      } else if (stdVal > maxRef) {
        classification = 'high';
      } else if (stdVal < minRef) {
        classification = 'low';
      }

      // AKI KDIGO Delta check if baseline available
      let trendData: InterpretedLabItem['trend'] = undefined;
      if (historicalLab && !isNaN(parseFloat(String(historicalLab.value)))) {
        const histNum = parseFloat(String(historicalLab.value).replace(/,/g, ''));
        const histConv = convertToStandardUnit('creatinine', histNum, historicalLab.unit || stdUnit).val;
        const delta = stdVal - histConv;
        const deltaPct = Math.round((delta / histConv) * 100);
        const isAki = delta >= 0.3 || deltaPct >= 50;

        trendData = {
          direction: delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'stable',
          deltaPercent: deltaPct,
          deltaAbsolute: Math.round(delta * 100) / 100,
          isAdverse: isAki,
          trendClinicalSignificanceEn: isAki
            ? `Acute Kidney Injury (KDIGO Stage 1+): Absolute creatinine rise of ${delta.toFixed(2)} mg/dL (+${deltaPct}%). Immediately avoid nephrotoxic agents (NSAIDs, aminoglycosides) and adjust drug doses.`
            : `Creatinine is ${delta <= 0 ? 'stable/improving' : 'slightly elevated'}.`,
          trendClinicalSignificanceBn: isAki
            ? `অ্যাকিউট কিডনি ইনজুরি (AKI KDIGO মানদণ্ড): ক্রিয়েটিনিন বৃদ্ধি ${delta.toFixed(2)} mg/dL (+${deltaPct}%)। ব্যথানাশক (NSAIDs) অবিলম্বে বন্ধ করুন এবং রেনাল ড্রাগ ডোজ সমন্বয় করুন।`
            : `ক্রিয়েটিনিন পরিবর্তন ${delta <= 0 ? 'স্থির/উন্নতি' : 'সামান্য বৃদ্ধি'}।`,
        };
      }

      return {
        key: 'creatinine',
        testName,
        testNameBn,
        inputValue: lab.value,
        normalizedNumericValue: stdVal,
        inputUnit: rawUnit || 'mg/dL',
        normalizedUnit: 'mg/dL',
        referenceInterval: {
          min: minRef,
          max: maxRef,
          unit: 'mg/dL',
          description: `${minRef} - ${maxRef} mg/dL (${gender})`,
          descriptionBn: `${minRef} - ${maxRef} mg/dL`,
        },
        classification,
        isCritical,
        isEstimated: false,
        clinicalSignificanceEn:
          stdVal > maxRef
            ? `Elevated Serum Creatinine (${stdVal} mg/dL): Renal impairment / Acute Kidney Injury. Renally cleared drugs require dosage adjustment based on estimated GFR.`
            : `Serum Creatinine (${stdVal} mg/dL) indicates intact renal filtration baseline.`,
        clinicalSignificanceBn:
          stdVal > maxRef
            ? `উচ্চ সেরাম ক্রিয়েটিনিন (${stdVal} mg/dL): কিডনির ফিল্ট্রেশন ক্ষমতা হ্রাস বা অ্যাকিউট কিডনি ইনজুরি। কিডনি দ্বারা নিষ্কাশিত ওষুধের ডোজ কমাতে হবে।`
            : `সেরাম ক্রিয়েটিনিন (${stdVal} mg/dL) স্বাভাবিক রেনাল কার্যকারিতা নির্দেশ করে।`,
        connectedConditions: ['Acute Kidney Injury', 'Chronic Kidney Disease', 'Dehydration Prerenal Azotemia'],
        recommendedActionEn:
          stdVal > maxRef
            ? 'Calculate eGFR, ensure adequate hydration, and eliminate nephrotoxic medications.'
            : 'No immediate renal intervention needed.',
        recommendedActionBn:
          stdVal > maxRef
            ? 'জিএফআর হিসাব করুন, পর্যাপ্ত পানি/স্যালাইন নিশ্চিত করুন এবং নেফ্রোটক্সিক ওষুধ এড়িয়ে চলুন।'
            : 'স্বাভাবিক পর্যবেক্ষণ।',
        trend: trendData,
      };
    }

    case 'potassium': {
      // Normal: 3.5 - 5.0 mmol/L
      const minRef = 3.5;
      const maxRef = 5.0;
      let classification: LabClassification = 'normal';
      let isCritical = false;

      if (stdVal > 6.0 || stdVal < 2.8) {
        classification = 'critical';
        isCritical = true;
      } else if (stdVal > maxRef) {
        classification = 'high';
      } else if (stdVal < minRef) {
        classification = 'low';
      }

      return {
        key: 'potassium',
        testName,
        testNameBn,
        inputValue: lab.value,
        normalizedNumericValue: stdVal,
        inputUnit: rawUnit || 'mmol/L',
        normalizedUnit: 'mmol/L',
        referenceInterval: {
          min: minRef,
          max: maxRef,
          unit: 'mmol/L',
          description: '3.5 - 5.0 mmol/L',
          descriptionBn: '৩.৫ - ৫.০ mmol/L',
        },
        classification,
        isCritical,
        isEstimated: false,
        clinicalSignificanceEn:
          stdVal > 6.0
            ? `Severe Hyperkalemia (${stdVal} mmol/L): Extreme risk of fatal cardiac arrhythmias and asystole. Urgent STAT 12-lead ECG and membrane-stabilizing calcium gluconate protocol required.`
            : stdVal < 2.8
            ? `Severe Hypokalemia (${stdVal} mmol/L): High risk of ventricular tachyarrhythmias and paralytic ileus. Urgent intravenous potassium replacement needed.`
            : stdVal > maxRef
            ? `Mild Hyperkalemia (${stdVal} mmol/L): Discontinue potassium-sparing diuretics (e.g. Spironolactone) or ACEi/ARBs.`
            : stdVal < minRef
            ? `Hypokalemia (${stdVal} mmol/L): Oral potassium repletion recommended.`
            : `Serum Potassium (${stdVal} mmol/L) within normal electrophysiological range.`,
        clinicalSignificanceBn:
          stdVal > 6.0
            ? `মারাত্মক হাইপারক্যালেমিয়া (${stdVal} mmol/L): প্রাণঘাতী কার্ডিয়াক অ্যারিদমিয়া ও হার্ট ব্লকের মারাত্মক ঝুঁকি! জরুরি ইসিজি ও ক্যালসিয়াম গ্লুকোনেট প্রোটোকল প্রয়োগ করুন।`
            : stdVal < 2.8
            ? `তীব্র হাইপোক্যালেমিয়া (${stdVal} mmol/L): ভেন্ট্রিকুলার অ্যারিদমিয়ার ঝুঁকি। অবিলম্বে পটাশিয়াম রিপ্লেসমেন্ট প্রয়োজন।`
            : `সেরাম পটাশিয়াম (${stdVal} mmol/L) স্বাভাবিক সীমার মধ্যে আছে।`,
        connectedConditions: ['Cardiac Arrhythmia', 'Acute Renal Failure', 'Electrolyte Imbalance'],
        recommendedActionEn:
          stdVal > 6.0 || stdVal < 2.8 ? 'STAT 12-lead ECG, cardiology consult, and immediate electrolyte protocol.' : 'Routine monitoring.',
        recommendedActionBn:
          stdVal > 6.0 || stdVal < 2.8 ? 'তাৎক্ষণিক ১২-লিড ইসিজি ও জরুরি ইলেক্ট্রোলাইট সমন্বয়।' : 'নিয়মিত পর্যবেক্ষণ।',
      };
    }

    case 'sodium': {
      // Normal: 135 - 145 mmol/L
      const minRef = 135;
      const maxRef = 145;
      let classification: LabClassification = 'normal';
      let isCritical = false;

      if (stdVal < 120 || stdVal > 160) {
        classification = 'critical';
        isCritical = true;
      } else if (stdVal > maxRef) {
        classification = 'high';
      } else if (stdVal < minRef) {
        classification = 'low';
      }

      return {
        key: 'sodium',
        testName,
        testNameBn: testNameBn || 'সিরাম সোডিয়াম (Serum Sodium)',
        inputValue: lab.value,
        normalizedNumericValue: stdVal,
        inputUnit: rawUnit || 'mmol/L',
        normalizedUnit: 'mmol/L',
        referenceInterval: {
          min: minRef,
          max: maxRef,
          unit: 'mmol/L',
          description: '135 - 145 mmol/L',
          descriptionBn: '১৩৫ - ১৪৫ mmol/L',
        },
        classification,
        isCritical,
        isEstimated: false,
        clinicalSignificanceEn:
          stdVal < 120
            ? `Critical Severe Hyponatremia (${stdVal} mmol/L): Imminent risk of cerebral edema, seizures, brainstem herniation, and death. Urgent controlled 3% hypertonic saline infusion in ICU/HDU.`
            : stdVal > 160
            ? `Critical Severe Hypernatremia (${stdVal} mmol/L): Extreme hyperosmolality, cerebral dehydration, and coma risk. Gradual fluid correction required.`
            : stdVal < minRef
            ? `Hyponatremia (${stdVal} mmol/L): Hypoosmolar state requiring fluid restriction or sodium repletion.`
            : stdVal > maxRef
            ? `Hypernatremia (${stdVal} mmol/L): Free water deficit requiring hypotonic hydration.`
            : `Serum Sodium (${stdVal} mmol/L) within normal physiological range.`,
        clinicalSignificanceBn:
          stdVal < 120
            ? `মারাত্মক হাইপোনাট্রেমিয়া (${stdVal} mmol/L): মস্তিষ্কে পানি জমা (Cerebral Edema), খিঁচুনি ও কোমার চরম ঝুঁকি! আইসিইউতে নিয়ন্ত্রিত হাইপারটোনিক স্যালাইন নির্দেশিত।`
            : stdVal > 160
            ? `মারাত্মক হাইপারনাট্রেমিয়া (${stdVal} mmol/L): পানিশূন্যতা ও স্নায়বিক জটিলতার তীব্র ঝুঁকি।`
            : `সিরাম সোডিয়াম (${stdVal} mmol/L) স্বাভাবিক।`,
        connectedConditions: ['Hyponatremic Encephalopathy', 'Electrolyte Disturbance', 'SIADH / Hypovolemia'],
        recommendedActionEn:
          stdVal < 120 || stdVal > 160 ? 'Immediate neurology/critical care consult, seizure precautions, controlled hypertonic saline.' : 'Electrolyte monitoring.',
        recommendedActionBn:
          stdVal < 120 || stdVal > 160 ? 'জরুরি আইসিইউ পর্যবেক্ষণ, খিঁচুনির সতর্কতা ও সতর্ক ইলেক্ট্রোলাইট রিপ্লেসমেন্ট।' : 'নিয়মিত পর্যবেক্ষণ।',
      };
    }

    case 'crp': {
      // Normal: < 5 mg/L (or < 10 mg/L)
      const minRef = 0;
      const maxRef = 10;
      let classification: LabClassification = 'normal';
      let isCritical = false;

      if (stdVal > 100) {
        classification = 'critical';
        isCritical = true;
      } else if (stdVal > maxRef) {
        classification = 'high';
      }

      return {
        key: 'crp',
        testName,
        testNameBn,
        inputValue: lab.value,
        normalizedNumericValue: stdVal,
        inputUnit: rawUnit || 'mg/L',
        normalizedUnit: 'mg/L',
        referenceInterval: {
          min: minRef,
          max: maxRef,
          unit: 'mg/L',
          description: '< 10 mg/L',
          descriptionBn: '< ১০ mg/L',
        },
        classification,
        isCritical,
        isEstimated: false,
        clinicalSignificanceEn:
          stdVal > 100
            ? `Markedly Elevated CRP (${stdVal} mg/L): Indicates severe systemic bacterial infection, sepsis, or acute inflammatory tissue necrosis.`
            : stdVal > maxRef
            ? `Elevated CRP (${stdVal} mg/L): Active systemic inflammation or acute infection.`
            : `CRP (${stdVal} mg/L) is within baseline range.`,
        clinicalSignificanceBn:
          stdVal > maxRef
            ? `উচ্চ সিআরপি (${stdVal} mg/L): শরীরে সক্রিয় ব্যাকটেরিয়াল সংক্রমণ বা তীব্র প্রদাহজনক প্রতিক্রিয়া নির্দেশ করে।`
            : `সিআরপি স্বাভাবিক রয়েছে।`,
        connectedConditions: ['Bacterial Pneumonia', 'Sepsis', 'Severe Inflammatory Response'],
        recommendedActionEn: 'Correlate with clinical focus of infection.',
        recommendedActionBn: 'সংক্রমণের ক্লিনিকাল লক্ষণের সাথে মিলিয়ে দেখুন।',
      };
    }

    case 'egfr': {
      // eGFR > 90 normal, 60-89 mild, 30-59 moderate, 15-29 severe, < 15 kidney failure
      const minRef = 60;
      const maxRef = 120;
      let classification: LabClassification = 'normal';
      let isCritical = false;

      if (stdVal < 15) {
        classification = 'critical';
        isCritical = true;
      } else if (stdVal < 30) {
        classification = 'critical';
        isCritical = true;
      } else if (stdVal < 60) {
        classification = 'low';
      }

      return {
        key: 'egfr',
        testName,
        testNameBn,
        inputValue: lab.value,
        normalizedNumericValue: stdVal,
        inputUnit: 'mL/min/1.73m²',
        normalizedUnit: 'mL/min/1.73m²',
        referenceInterval: {
          min: minRef,
          max: maxRef,
          unit: 'mL/min/1.73m²',
          description: '≥ 60 mL/min/1.73m²',
          descriptionBn: '≥ ৬০ mL/min/1.73m²',
        },
        classification,
        isCritical,
        isEstimated: true, // explicitly identified as estimated
        clinicalSignificanceEn:
          stdVal < 30
            ? `Severe Renal Impairment (eGFR ${stdVal} mL/min/1.73m²): Stage 4/5 CKD or acute decompensation. Strict dose reduction or avoidance required for renally cleared medications.`
            : stdVal < 60
            ? `Moderate Renal Impairment (eGFR ${stdVal} mL/min/1.73m²): Stage 3 CKD. Renal dosage adjustment indicated.`
            : `Renal filtration capacity (eGFR ${stdVal} mL/min/1.73m²) is satisfactory.`,
        clinicalSignificanceBn:
          stdVal < 30
            ? `তীব্র কিডনি বৈকল্য (eGFR ${stdVal} mL/min/1.73m²): কিডনি দিয়ে নিষ্কাশিত ওষুধের মাত্রা ৫০-৭৫% হ্রাস বা পরিহার আবশ্যক।`
            : stdVal < 60
            ? `মাঝারি কিডনি বৈকল্য (eGFR ${stdVal}): ওষুধের মাত্রা সমন্বয় প্রয়োজন।`
            : `কিডনির পরিশ্রাবণ ক্ষমতা সন্তোষজনক।`,
        connectedConditions: ['Chronic Kidney Disease', 'Renal Drug Toxicity', 'Acute on Chronic Renal Failure'],
        recommendedActionEn:
          stdVal < 60
            ? 'Adjust antibiotic and cardiovascular drug dosages. Check potassium and avoid NSAIDs.'
            : 'Standard dosing appropriate.',
        recommendedActionBn:
          stdVal < 60
            ? 'অ্যান্টিবায়োটিক ও অন্যান্য ওষুধের রেনাল ডোজ কমান। ব্যথানাশক ওষুধ পরিহার করুন।'
            : 'স্বাভাবিক ডোজ প্রযোজ্য।',
      };
    }

    default: {
      return {
        key: testKey,
        testName,
        testNameBn,
        inputValue: lab.value,
        normalizedNumericValue: stdVal,
        inputUnit: rawUnit,
        normalizedUnit: stdUnit,
        referenceInterval: {
          min: null,
          max: null,
          unit: stdUnit,
          description: lab.reference_range || 'Standard baseline',
          descriptionBn: lab.reference_range || 'সাধারণ মাত্রা',
        },
        classification: 'normal',
        isCritical: false,
        isEstimated: false,
        clinicalSignificanceEn: `${testName}: ${stdVal} ${stdUnit}. Documented in clinical evidence record.`,
        clinicalSignificanceBn: `${testName}: ${stdVal} ${stdUnit}। ক্লিনিকাল প্রমাণ রেকর্ডে সংরক্ষিত।`,
        connectedConditions: [],
        recommendedActionEn: 'Review in clinical context.',
        recommendedActionBn: 'রোগীর সামগ্রিক শারীরিক অবস্থার সাথে মিলিয়ে পর্যালোচনা করুন।',
      };
    }
  }
}

/**
 * Interprets a complete panel of laboratory values with trend tracking
 */
export function interpretLabPanel(
  labs: LabValue[],
  context: DemographicContext = {},
  historicalLabs?: LabValue[]
): ComprehensiveLabReport {
  const items: InterpretedLabItem[] = [];
  const criticalAlerts: string[] = [];

  const histMap = new Map<string, LabValue>();
  if (historicalLabs && historicalLabs.length > 0) {
    for (const h of historicalLabs) {
      if (h.name) histMap.set(h.name.toLowerCase().trim(), h);
    }
  }

  for (const lab of labs) {
    if (!lab.name || String(lab.value).trim() === '') continue;
    const hist = histMap.get(lab.name.toLowerCase().trim());
    const interpreted = interpretLabItem(lab, context, hist);
    items.push(interpreted);

    if (interpreted.isCritical) {
      criticalAlerts.push(
        `${interpreted.testName}: ${interpreted.inputValue} ${interpreted.inputUnit} (${interpreted.classification.toUpperCase()}) — ${interpreted.clinicalSignificanceEn}`
      );
    }
    if (interpreted.trend?.isAdverse) {
      criticalAlerts.push(
        `🚨 ADVERSE TREND: ${interpreted.testName} (${interpreted.trend.trendClinicalSignificanceEn})`
      );
    }
  }

  const hasAbnormalities = items.some((i) => i.classification !== 'normal');
  const hasCriticalAlerts = criticalAlerts.length > 0;

  // Dengue Risk Profile Signature
  const plt = items.find((i) => i.key === 'platelets');
  const hct = items.find((i) => i.key === 'hematocrit');
  const wbc = items.find((i) => i.key === 'wbc');
  const ns1 = items.find((i) => i.key === 'dengue_ns1');

  const thrombocytopenia = Boolean(plt && plt.normalizedNumericValue !== null && plt.normalizedNumericValue < 150000);
  const hemoconcentration = Boolean(
    hct && (hct.classification === 'high' || hct.classification === 'critical' || (hct.trend && hct.trend.direction === 'rising' && hct.trend.deltaPercent >= 20))
  );
  const leukopenia = Boolean(wbc && wbc.normalizedNumericValue !== null && wbc.normalizedNumericValue < 4000);
  const ns1Positive = Boolean(ns1 && ns1.classification === 'critical');
  const ns1Negative = Boolean(ns1 && ns1.classification === 'normal');
  const hasWarningSigns = thrombocytopenia && hemoconcentration;

  const summaryEn = hasCriticalAlerts
    ? `🚨 CRITICAL LABORATORY ALERT: ${criticalAlerts.length} urgent diagnostic abnormality(ies) identified requiring immediate physician action.`
    : hasAbnormalities
    ? `Laboratory panel shows ${items.filter((i) => i.classification !== 'normal').length} abnormal finding(s) correlating with the clinical presentation.`
    : 'Laboratory parameters evaluated are within expected physiological reference intervals.';

  const summaryBn = hasCriticalAlerts
    ? `🚨 জরুরি ল্যাবরেটরি সতর্কতা: ${criticalAlerts.length} টি গুরুত্বপূর্ণ অস্বাভাবিকতা চিহ্নিত যা অবিলম্বে চিকিৎসকের হস্তক্ষেপ দাবি করে।`
    : hasAbnormalities
    ? `ল্যাবরেটরি প্যানেলে ${items.filter((i) => i.classification !== 'normal').length} টি অস্বাভাবিক ফলাফল রয়েছে যা বর্তমান লক্ষণসমূহের সাথে সঙ্গতিপূর্ণ।`
    : 'বিশ্লেষিত ল্যাবরেটরি প্যারামিটারসমূহ প্রত্যাশিত স্বাভাবিক সীমার মধ্যে রয়েছে।';

  return {
    items,
    hasAbnormalities,
    hasCriticalAlerts,
    criticalAlerts,
    summaryEn,
    summaryBn,
    dengueRiskSignatures: {
      thrombocytopenia,
      hemoconcentration,
      leukopenia,
      ns1Positive,
      ns1Negative,
      hasWarningSigns,
    },
  };
}
