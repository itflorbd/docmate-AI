/**
 * DocMate AI - Protected Token Guard
 * 
 * HARD RULE: The humanise layer must NEVER alter numbers, drug names,
 * doses, units, negations, diagnosis names, citation markers, or safety alerts.
 * 
 * This guard extracts all clinical entities from the verified source string
 * and verifies that every single token is present unchanged in the decorated output.
 * If any token is missing or mutated, validation fails and triggers a fallback.
 */

export interface TokenValidationResult {
  valid: boolean;
  missingTokens: string[];
  totalProtectedTokens: number;
}

export class ProtectedTokenGuard {
  // Regex patterns for protected entities
  private static NUMERAL_REGEX = /[০-৯0-9]+(?:[\.\/][০-৯0-9]+)?/g;
  private static UNIT_REGEX = /\b(?:mg|মিলিগ্রাম|ml|মিলি|mcg|মাইক্রোগ্রাম|mmol\/L|kg|কেজি|দিন|সপ্তাহ|বছর|hours?|days?|weeks?|years?|বার|times?)\b/gi;
  private static DOSE_SCHEDULE_REGEX = /(?:[০-৯0-9]\+[০-৯0-9]\+[০-৯0-9]|[০-৯0-9]-[০-৯0-9]-[০-৯0-9]|TDS|BD|OD|QDS|PRN|খাবারের\s+(?:আগে|পর)|(?:before|after)\s+meals?)/gi;
  private static DRUG_REGEX = /\b(?:Paracetamol|Napa|Ace|Amoxicillin|Moxacil|Azithromycin|Aztor|Ciprofloxacin|Omeprazole|Seclo|Losectil|Metformin|Comprid|Amlodipine|Camlod|Salbutamol|Ventolin|Insulin|Cefradine|Cefuroxime|Doxycycline|Ceftriaxone)\b/gi;
  private static DIAGNOSIS_REGEX = /\b(?:Pneumonia|Asthma|COPD|CAP|ACS|Hypertension|Diabetes|Dengue|Sepsis|নিউমোনিয়া|অ্যাজমা|সিওপিডি|উচ্চ\s*রক্তচাপ|ডায়াবেটিস|ডেঙ্গু|সেপসিস)\b/gi;
  private static NEGATION_REGEX = /\b(?:না|নেই|মুক্ত|বিনা|অনুপস্থিত|no|not|denies|negative|without|nil|none)\b/gi;
  private static CITATION_REGEX = /(?:\[\^?\d+\]|chunk-[a-z0-9-]+)/gi;

  /**
   * Extracts all protected clinical tokens from a given text.
   */
  public static extractTokens(text: string): string[] {
    if (!text) return [];

    const tokens: Set<string> = new Set();

    const addMatches = (regex: RegExp) => {
      const matches = text.match(regex);
      if (matches) {
        for (const m of matches) {
          const clean = m.trim().toLowerCase();
          if (clean.length > 0) {
            tokens.add(clean);
          }
        }
      }
    };

    addMatches(this.NUMERAL_REGEX);
    addMatches(this.UNIT_REGEX);
    addMatches(this.DOSE_SCHEDULE_REGEX);
    addMatches(this.DRUG_REGEX);
    addMatches(this.DIAGNOSIS_REGEX);
    addMatches(this.NEGATION_REGEX);
    addMatches(this.CITATION_REGEX);

    return Array.from(tokens);
  }

  /**
   * Validates that all protected tokens present in the source are preserved in the decorated output.
   */
  public static validate(sourceText: string, decoratedText: string): TokenValidationResult {
    const sourceTokens = this.extractTokens(sourceText);
    if (sourceTokens.length === 0) {
      return { valid: true, missingTokens: [], totalProtectedTokens: 0 };
    }

    const decoratedTokens = new Set(this.extractTokens(decoratedText));
    const missing: string[] = [];

    for (const token of sourceTokens) {
      if (!decoratedTokens.has(token) && !decoratedText.toLowerCase().includes(token)) {
        missing.push(token);
      }
    }

    return {
      valid: missing.length === 0,
      missingTokens: missing,
      totalProtectedTokens: sourceTokens.length,
    };
  }
}
