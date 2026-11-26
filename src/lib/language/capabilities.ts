// src/lib/language/capabilities.ts
// DocMate AI - Fixed Capabilities Explanation & Ambiguity Resolution

import { AmbiguityInfo, ReplyLanguage } from './types';

export interface CapabilitiesResponse {
  isCapabilitiesInquiry: boolean;
  messageBn: string;
  messageEn: string;
  ambiguity: AmbiguityInfo;
}

// Regex identifying "What can you see / How efficient is this / Capabilities" inquiries
const CAPABILITIES_REGEX = /(?:tmi|tumi|apni|তুমি|আপনি|you)?\s*(?:ki|what)?\s*(?:dekhte\s*paro|dekhte\s*paren|dekhcho|দেখতে\s*পারো|দেখতে\s*পারেন|see\s*this|can\s*you\s*see|what\s*can\s*you\s*see|how\s*much\s*efficient|how\s*efficient)/iu;

const AMBIGUOUS_PRONOUNS_REGEX = /(?:^|\s)(?:this|eta|eita|eyta|ota|oita|sheta|seta|এটি|এটা|ওটা|সেটা)(?:\s|[?!.,]|$)/iu;

/**
 * Checks whether an utterance is asking about the assistant's visibility or capabilities.
 */
export function isCapabilitiesQuery(text: string): boolean {
  if (!text) return false;
  return CAPABILITIES_REGEX.test(text);
}

/**
 * Generates the deterministic capabilities response explaining exact vision boundaries.
 */
export function getCapabilitiesExplanation(replyLang: ReplyLanguage = 'bn'): {
  replyText: string;
  ambiguity: AmbiguityInfo;
} {
  const messageBn =
    'আমি ডকমেট এআই সহকারী। আমি শুধুমাত্র এই মুহূর্তে খোলা রোগীর কেস এবং আমাদের অভ্যন্তরীণ ভেরিফাইড ক্লিনিক্যাল লাইব্রেরির রেফারেন্স দেখতে পারি। আমি ইন্টারনেট, বাইরের কোনো ফাইল বা আপনার স্ক্রিন দেখতে পারি না। ' +
    'আপনি নির্দিষ্ট কোন ওষুধ, পরীক্ষা বা ক্লিনিকাল সিদ্ধান্তের কার্যকারিতা জানতে চাচ্ছেন? নিচে বেছে নিন বা লিখে জানান।';

  const messageEn =
    'I am DocMate AI assistant. I can only see the currently open patient case and our internal verified clinical library. I cannot see the internet, external files, or your broader screen. ' +
    'Which specific medication, lab test, or clinical guideline are you asking about? Please select below or specify.';

  const ambiguity: AmbiguityInfo = {
    isAmbiguous: true,
    reason: 'Capabilities inquiry with ambiguous pronoun reference ("this")',
    clarifyingQuestionBn: 'আপনি নির্দিষ্ট কোন চিকিৎসা বা নির্দেশিকা সম্পর্কে জানতে চাচ্ছেন?',
    clarifyingQuestionEn: 'Which specific treatment or guideline are you asking about?',
    quickChips: [
      {
        labelBn: 'বর্তমান প্রেসক্রিপশন',
        labelEn: 'Current Prescription',
        value: 'বর্তমান প্রেসক্রিপশন সম্পর্কে বিস্তারিত জানতে চাই',
      },
      {
        labelBn: 'রোগ নির্ণয় নির্দেশিকা',
        labelEn: 'Diagnostic Guidelines',
        value: 'এই রোগের ভেরিফাইড গাইডলাইন কী?',
      },
      {
        labelBn: 'ওষুধের কার্যকারিতা ও ডোজ',
        labelEn: 'Drug Efficacy & Dosage',
        value: 'প্রথম সারির ওষুধের কার্যকারিতা ও ডোজ কত?',
      },
    ],
  };

  return {
    replyText: replyLang === 'en' ? messageEn : messageBn,
    ambiguity,
  };
}

/**
 * Checks if a query uses ambiguous demonstrative pronouns without an explicit antecedent.
 */
export function detectAmbiguousDemonstratives(
  text: string,
  hasExplicitClinicalEntity: boolean
): AmbiguityInfo | null {
  if (AMBIGUOUS_PRONOUNS_REGEX.test(text) && !hasExplicitClinicalEntity) {
    return {
      isAmbiguous: true,
      reason: 'Ambiguous pronoun reference without explicit clinical subject',
      clarifyingQuestionBn: 'আপনি নির্দিষ্ট কোন ওষুধ, লক্ষণ বা কেস উপাদান সম্পর্কে জানতে চাচ্ছেন?',
      clarifyingQuestionEn: 'Which specific medication, symptom, or case element are you referring to?',
      quickChips: [
        {
          labelBn: 'লক্ষণ বিশ্লেষণ',
          labelEn: 'Analyze Symptoms',
          value: 'রোগীর লক্ষণগুলো বিশ্লেষণ করুন',
        },
        {
          labelBn: 'ওষুধের তথ্য',
          labelEn: 'Medication Info',
          value: 'ওষুধের সঠিক মাত্রা ও নির্দেশিকা',
        },
      ],
    };
  }
  return null;
}
