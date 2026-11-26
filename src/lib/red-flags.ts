// src/lib/red-flags.ts
// DocMate AI - Deterministic Bilingual Clinical Red-Flag Rule Engine
// All patterns use Unicode matching ('u' flag) and are negation-aware via negation-parser.

import { SafetyAlert } from '@/types';
import { isTermNegated } from '@/lib/language/negation-parser';

export interface RedFlagRule {
  id: string;
  category: 'cardiac' | 'respiratory' | 'neurological' | 'hemorrhagic' | 'shock' | 'general';
  title_bn: string;
  title_en: string;
  description_bn: string;
  description_en: string;
  patterns: RegExp[];
}

export const RED_FLAG_RULES: RedFlagRule[] = [
  {
    id: 'acute-coronary',
    category: 'cardiac',
    title_bn: '🚨 জরুরি কার্ডিয়াক রেড ফ্ল্যাগ: অ্যাকিউট করোনারি সিন্ড্রোম (ACS) সন্দেহ',
    title_en: '🚨 Critical Cardiac Red Flag: Suspected Acute Coronary Syndrome (ACS)',
    description_bn:
      'বুকে তীব্র চাপ বা ব্যথা বাম বাহু বা চোয়ালে ছড়াচ্ছে। অবিলম্বে জরুরি ইসিজি, ট্রপোনিন আই, এবং কার্ডিওলজি রেফারেল প্রয়োজন।',
    description_en:
      'Acute severe/crushing chest pain radiating to arm or jaw indicates possible myocardial infarction. Immediate stat 12-lead ECG, Troponin I, and cardiology escalation required.',
    patterns: [
      /(?:^|[^\p{L}\p{N}])(chest\s+pain\s+(?:radiat|spread)\w*|crushing\s+(?:substernal\s+)?chest\s+pain|substernal\s+chest\s+pain|severe\s+chest\s+pain|acute\s+coronary\s+syndrome)(?=[^\p{L}\p{N}]|$)/giu,
      /(?:^|[^\p{L}\p{N}])(বুকে\s+(?:তীব্র|মারাত্মক|প্রচণ্ড)\s+(?:চাপযুক্ত\s+|চাপ\s+ধরা\s+)?ব্যথা|বুকের\s+ব্যথা\s+(?:বাম\s+হাতে|বাহুতে|চোয়ালে)\s+ছড়াচ্ছে|বাম\s+বাহুতে\s+ছড়িয়ে|বুকের\s+(?:মাঝখানে\s+)?চাপ\s+ধরা\s+ব্যথা)(?=[^\p{L}\p{N}]|$)/giu,
      /(?:^|[^\p{L}\p{N}])(buke\s+(?:tibro|procando|marattok)?\s*betha|crushing\s+chest\s+pain|chest\s+pain\s+radiat\w*)(?=[^\p{L}\p{N}]|$)/giu,
      // "the pain is crushing", "pain radiating to the left arm / jaw"
      /(?:^|[^\p{L}\p{N}])((?:chest\s+)?pain\s+(?:is\s+|feels\s+)?(?:crushing|squeezing)|(?:pain|discomfort)[^.!?\n]{0,40}?radiat\w*\s+(?:to|into|down)\s+(?:the\s+)?(?:left\s+)?(?:arm|jaw|shoulder|neck))(?=[^\p{L}\p{N}]|$)/giu,
    ],
  },
  {
    id: 'severe-respiratory-distress',
    category: 'respiratory',
    title_bn: '🚨 জরুরি রেসপিরেটরি রেড ফ্ল্যাগ: তীব্র শ্বাসকষ্ট বা শ্বাসনালী বন্ধের ঝুঁকি',
    title_en: '🚨 Critical Respiratory Red Flag: Severe Respiratory Distress / Stridor',
    description_bn:
      'তীব্র শ্বাসকষ্ট, স্ট্রাইডোর বা শ্বাসনালী বাধার লক্ষণ রয়েছে। দ্রুত হাই-ফ্লো অক্সিজেন, শ্বাসনালী মূল্যায়ন ও সিনিয়র কনসালট্যান্ট প্রয়োজন।',
    description_en:
      'Severe respiratory distress, stridor, or impending airway compromise detected. Immediate high-flow oxygen, airway evaluation, and urgent specialist consult required.',
    patterns: [
      /(?:^|[^\p{L}\p{N}])(severe\s+dyspnea|acute\s+dyspnea|stridor|respiratory\s+failure|severe\s+shortness\s+of\s+breath|gasping\s+for\s+(?:air|breath))(?=[^\p{L}\p{N}]|$)/giu,
      /(?:^|[^\p{L}\p{N}])(তীব্র\s+শ্বাসকষ্ট|মারাত্মক\s+শ্বাসকষ্ট|প্রচণ্ড\s+শ্বাসকষ্ট|শ্বাস\s+নিতে\s+(?:মারাত্মক\s+)?কষ্ট|স্ট্রাইডোর|দম\s+আটকে\s+যাওয়া)(?=[^\p{L}\p{N}]|$)/giu,
      /(?:^|[^\p{L}\p{N}])(tibro\s+shashkoshto|severe\s+shashkoshto|stridor|gasping)(?=[^\p{L}\p{N}]|$)/giu,
    ],
  },
  {
    id: 'altered-consciousness-shock',
    category: 'neurological',
    title_bn: '🚨 জরুরি নিউরোলজিক্যাল / হেমোডায়নামিক রেড ফ্ল্যাগ: চেতনা হ্রাস বা শক',
    title_en: '🚨 Critical Neurological / Hemodynamic Red Flag: Altered Consciousness / Shock',
    description_bn:
      'রোগী অচেতন, জ্ঞানহীন বা শক অবস্থায় রয়েছেন। অবিলম্বে এবিসি (Airway, Breathing, Circulation) স্থিতিশীল করুন এবং জরুরি ইনটেনসিভ কেয়ার সাপোর্ট ডাকুন।',
    description_en:
      'Patient is unconscious, unresponsive, or in severe hemodynamic collapse. Perform immediate ABC stabilization and initiate intensive emergency response.',
    patterns: [
      /(?:^|[^\p{L}\p{N}])(unconscious|loss\s+of\s+consciousness|unresponsive(?:ness)?|altered\s+mental\s+(?:state|status)|confusion.*systolic\s+bp|cardiogenic\s+shock|hypovolemic\s+shock|septic\s+shock|anaphylaxis|profound\s+hypotension)(?=[^\p{L}\p{N}]|$)/giu,
      /(?:^|[^\p{L}\p{N}])(অচেতন|জ্ঞান\s+হারিয়েছে|অজ্ঞান\s+হয়ে|চেতনা\s+নেই|মারাত্মক\s+শক|অ্যানাফিল্যাক্সিস)(?=[^\p{L}\p{N}]|$)/giu,
      /(?:^|[^\p{L}\p{N}])(ocheton|oggan|unconscious|unresponsive|anaphylaxis)(?=[^\p{L}\p{N}]|$)/giu,
    ],
  },
  {
    id: 'severe-hemorrhage',
    category: 'hemorrhagic',
    title_bn: '🚨 জরুরি রক্তক্ষরণ রেড ফ্ল্যাগ: রক্তবমি বা কাশির সাথে রক্ত',
    title_en: '🚨 Critical Hemorrhage Red Flag: Hematemesis / Hemoptysis / Severe Bleeding',
    description_bn:
      'সক্রিয় রক্তবমি (Hematemesis) বা কাশির সাথে রক্ত (Hemoptysis) মারাত্মক বিপদের লক্ষণ। অবিলম্বে আইভি অ্যাক্সেস, রক্তের গ্রুপ ক্রস-ম্যাচ ও রক্ত পরিসঞ্চালন প্রস্তুত রাখুন।',
    description_en:
      'Active hematemesis, massive hemoptysis, or uncontrolled hemorrhage detected. Secure wide-bore IV access, type and cross-match blood products immediately.',
    patterns: [
      /(?:^|[^\p{L}\p{N}])(hemoptysis|hematemesis|coughing\s+up\s+blood|vomiting\s+blood|massive\s+hemorrhage|severe\s+bleeding)(?=[^\p{L}\p{N}]|$)/giu,
      /(?:^|[^\p{L}\p{N}])(রক্তবমি|কাশির\s+সাথে\s+রক্ত|প্রচণ্ড\s+রক্তপাত|মারাত্মক\s+রক্তক্ষরণ)(?=[^\p{L}\p{N}]|$)/giu,
      /(?:^|[^\p{L}\p{N}])(rokto\s+bomi|kashir\s+sathe\s+rokto|hemoptysis|hematemesis)(?=[^\p{L}\p{N}]|$)/giu,
    ],
  },
  {
    id: 'cyanosis-hypoxemia',
    category: 'respiratory',
    title_bn: '🚨 জরুরি অক্সিজেন রেড ফ্ল্যাগ: সায়ানোসিস / তীব্র হাইপোক্সিয়া',
    title_en: '🚨 Critical Oxygen Red Flag: Cyanosis / Severe Hypoxemia',
    description_bn:
      'রোগীর শরীর বা ঠোঁট নীল হয়ে যাচ্ছে (সায়ানোসিস)। এটি মারাত্মক রক্তে অক্সিজেনের স্বল্পতা নির্দেশ করে। অবিলম্বে অক্সিজেন স্যাচুরেশন পরীক্ষা ও অক্সিজেন প্রয়োগ করুন।',
    description_en:
      'Cyanosis indicates life-threatening tissue hypoxia. Check SpO2 immediately and administer high-concentration supplementary oxygen.',
    patterns: [
      /(?:^|[^\p{L}\p{N}])(cyanosis|central\s+cyanosis|turning\s+blue|severe\s+hypoxemia)(?=[^\p{L}\p{N}]|$)/giu,
      /(?:^|[^\p{L}\p{N}])(সায়ানোসিস|শরীর\s+নীল\s+হয়ে|ঠোঁট\s+নীল|তীব্র\s+হাইপোক্সিয়া)(?=[^\p{L}\p{N}]|$)/giu,
      /(?:^|[^\p{L}\p{N}])(cyanosis|shorir\s+neel|neel\s+hoye)(?=[^\p{L}\p{N}]|$)/giu,
    ],
  },
];

export interface RedFlagDetectionResult {
  hasRedFlags: boolean;
  alerts: SafetyAlert[];
  matchedRules: RedFlagRule[];
}

/** Rules whose (non-negated) pattern matches the text, in rule order. */
export function matchRedFlagRules(text: string): RedFlagRule[] {
  if (!text || !text.trim()) return [];
  const matched: RedFlagRule[] = [];
  for (const rule of RED_FLAG_RULES) {
    const hit = rule.patterns.some((pattern) => {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        // match[1] is the captured red-flag phrase
        const capturedText = match[1] || match[0];
        const matchStart = match.index + match[0].indexOf(capturedText);
        if (!isTermNegated(text, matchStart, matchStart + capturedText.length).isNegated) return true;
      }
      return false;
    });
    if (hit) matched.push(rule);
  }
  return matched;
}

/**
 * Deterministically scans input text and/or chief complaints for clinical red flags.
 * Uses Unicode-aware regex patterns and strictly filters out negated mentions
 * ("no chest pain", "বুকে ব্যথা নেই", "kono shashkoshto nai").
 */
export function checkRedFlags(
  text: string,
  locale: 'bn' | 'en' = 'bn'
): SafetyAlert[] {
  return matchRedFlagRules(text).map((rule) => ({
    id: `redflag-${rule.id}-${Date.now()}`,
    drug_id: 'triage-01',
    drug_name: 'Emergency Protocol',
    severity: 'critical',
    type: 'contraindication',
    title: locale === 'en' ? rule.title_en : rule.title_bn,
    description: locale === 'en' ? rule.description_en : rule.description_bn,
  }));
}
