import { CleanedPage } from './cleaner';

export interface QualityReport {
  score: number; // 0 to 100
  needsReview: boolean;
  warnings: string[];
  warningsBn: string[];
  hasLegacyBanglaFont: boolean;
  avgCharsPerPage: number;
  emptyPageRatio: number;
  garbledRatio: number;
}

// Typical SutonnyMJ / Bijoy ANSI legacy substrings that show up when Bangla fonts lack Unicode mapping
const LEGACY_BANGLA_PATTERNS = [
  /\bAvwg\b/i, // আমি
  /\bAvcbvi\b/i, // আপনার
  /\bK_v\b/i, // কথা
  /\bwKQz\b/i, // কিছু
  /\bKiv\b/i, // করা
  /\bGes\b/i, // এবং
  /\bhnj\b/i,
  /\bRvq\b/i, // যায়
  /\b†\w+/i, // ANSI e-kar character †
  /\b\w+‡\w+/i,
  /\b[A-Za-z]{2,8}়/,
];

export function assessExtractionQuality(pages: CleanedPage[]): QualityReport {
  if (pages.length === 0) {
    return {
      score: 0,
      needsReview: true,
      warnings: ['Document contains no extracted pages or text.'],
      warningsBn: ['নথিতে কোনো টেক্সট বা পৃষ্ঠা পাওয়া যায়নি।'],
      hasLegacyBanglaFont: false,
      avgCharsPerPage: 0,
      emptyPageRatio: 1,
      garbledRatio: 1,
    };
  }

  let totalChars = 0;
  let emptyPages = 0;
  let replacementCharCount = 0;
  let legacyBanglaHits = 0;

  for (const page of pages) {
    const len = page.text.length;
    totalChars += len;
    if (len < 40) emptyPages++;

    // Check replacement characters (e.g. \uFFFD, or long runs of ???)
    const matches = page.text.match(/\uFFFD|\?{3,}/g);
    if (matches) {
      replacementCharCount += matches.length;
    }

    // Check for legacy ANSI font patterns
    for (const pattern of LEGACY_BANGLA_PATTERNS) {
      if (pattern.test(page.text)) {
        legacyBanglaHits++;
      }
    }
  }

  const avgCharsPerPage = Math.round(totalChars / pages.length);
  const emptyPageRatio = emptyPages / pages.length;
  const garbledRatio = totalChars > 0 ? (replacementCharCount * 10) / totalChars : 0;
  const hasLegacyBanglaFont = legacyBanglaHits >= 3;

  let score = 100;

  // Penalize for very short text / high empty page ratio
  if (avgCharsPerPage < 100) score -= 35;
  else if (avgCharsPerPage < 300) score -= 15;

  if (emptyPageRatio > 0.4) score -= 30;
  else if (emptyPageRatio > 0.15) score -= 15;

  // Penalize for garbled characters
  if (garbledRatio > 0.05) score -= 40;
  else if (garbledRatio > 0.01) score -= 20;

  // Severe penalty for legacy unmapped Bangla fonts
  if (hasLegacyBanglaFont) score -= 45;

  score = Math.max(0, Math.min(100, score));

  const warnings: string[] = [];
  const warningsBn: string[] = [];

  if (hasLegacyBanglaFont) {
    warnings.push('Legacy non-Unicode Bangla font encoding (e.g. SutonnyMJ/Bijoy) detected. Text is garbled and cannot be accurately cited or verified. Please upload standard Unicode text.');
    warningsBn.push('পুরোনো নন-ইউনিকোড বাংলা ফন্ট (যেমন সুতন্নিএমজে/বিজয়) শনাক্ত হয়েছে। টেক্সট অপাঠ্য এবং নির্ভুলভাবে রেফারেন্স করা সম্ভব নয়। অনুগ্রহ করে প্রমিত ইউনিকোড ফাইল আপলোড করুন।');
  }

  if (avgCharsPerPage < 150 && emptyPageRatio > 0.3) {
    warnings.push('Low character density detected across pages. This may be a scanned document requiring OCR.');
    warningsBn.push('পৃষ্ঠাগুলোতে টেক্সটের ঘনত্ব কম। এটি স্ক্যান করা নথি হতে পারে যার জন্য ওসিআর (OCR) প্রয়োজন।');
  }

  if (garbledRatio > 0.02) {
    warnings.push('High concentration of replacement characters ( or ???) detected.');
    warningsBn.push('নথিতে অস্বাভাবিক বা অবোধ্য প্রতীকের উপস্থিতি শনাক্ত হয়েছে।');
  }

  const needsReview = score < 60 || hasLegacyBanglaFont;

  return {
    score,
    needsReview,
    warnings,
    warningsBn,
    hasLegacyBanglaFont,
    avgCharsPerPage,
    emptyPageRatio,
    garbledRatio,
  };
}
