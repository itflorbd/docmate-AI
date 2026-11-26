// src/lib/language/reply-policy.ts
// DocMate AI - Reply Language Policy & Clinical Wording Standardizer

import { LanguageDetectionResult, ReplyLanguage } from './types';

export interface UserLanguageOptions {
  replyLanguage?: 'auto' | 'bn' | 'en';
  banglishReply?: boolean;
}

/**
 * Resolves the target reply language according to user preferences and detected input style.
 */
export function resolveReplyLanguage(
  detection: LanguageDetectionResult,
  userPrefs?: UserLanguageOptions
): ReplyLanguage {
  const pref = userPrefs?.replyLanguage || 'auto';

  if (pref === 'bn') return 'bn';
  if (pref === 'en') return 'en';

  // Auto mode
  switch (detection.lang) {
    case 'en':
      return 'en';

    case 'banglish':
      // Doctor typed in romanized Bangla (Banglish)
      if (userPrefs?.banglishReply) {
        return 'banglish';
      }
      // Default clinical standard: reply in clear, professional Bangla script
      return 'bn';

    case 'mixed':
      // Mixed sentence: follow dominant language (defaulting to Bangla)
      return detection.dominantLang === 'en' ? 'en' : 'bn';

    case 'bn':
    default:
      return 'bn';
  }
}

/**
 * Formats clinical terms for bilingual clarity in Bengali replies.
 * Standard: 'বাংলা শব্দ (English Term)'
 * e.g. formatBilingualTerm('জ্বর', 'Fever') => 'জ্বর (Fever)'
 */
export function formatBilingualTerm(banglaTerm: string, canonicalEn: string): string {
  if (!banglaTerm || !canonicalEn) return banglaTerm || canonicalEn;
  const enCapitalized = canonicalEn.charAt(0).toUpperCase() + canonicalEn.slice(1);
  return `${banglaTerm} (${enCapitalized})`;
}
