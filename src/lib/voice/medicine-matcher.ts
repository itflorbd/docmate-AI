import { db } from '@/db';
import { medicineBrands, drugs } from '@/db/schema';
import { ilike, or } from 'drizzle-orm';

export const FORMULARY_REFERENCE_MEDS = [
  { brandName: 'Napa', genericName: 'Paracetamol', aliases: ['napa', 'নাপা', 'প্যারাসিটামল', 'paracetamol'] },
  { brandName: 'Napa Extra', genericName: 'Paracetamol + Caffeine', aliases: ['napa extra', 'নাপা এক্সট্রা'] },
  { brandName: 'Ace', genericName: 'Paracetamol', aliases: ['এইস', 'ace', 'paracetamol'] },
  { brandName: 'Moxacil', genericName: 'Amoxicillin', aliases: ['অ্যামোক্সিসিলিন', 'amoxicillin', 'মক্সাসিল', 'moxacil'] },
  { brandName: 'Zithrox', genericName: 'Azithromycin', aliases: ['এজিথ্রোমাইসিন', 'azithromycin', 'জিথ্রক্স', 'zithrox'] },
  { brandName: 'Seclo', genericName: 'Omeprazole', aliases: ['অমিপ্রাজল', 'omeprazole', 'সেকলো', 'seclo'] },
  { brandName: 'Pantonix', genericName: 'Pantoprazole', aliases: ['প্যান্টোপ্রাজল', 'pantoprazole', 'pantonix'] },
  { brandName: 'Neofloxin', genericName: 'Ciprofloxacin', aliases: ['সিপ্রোফ্লক্সাসিন', 'ciprofloxacin', 'neofloxin'] },
  { brandName: 'Filmet', genericName: 'Metronidazole', aliases: ['মেট্রোনিডাজল', 'metronidazole', 'filmet'] },
];

/**
 * Scans a spoken transcript and extracts recognized formulary medicines (both brand and generic)
 */
export function matchMedicineNames(
  text: string
): Array<{ brandName: string; genericName: string; aliases: string[] }> {
  if (!text) return [];
  const normalized = text.toLowerCase();
  const matched: Array<{ brandName: string; genericName: string; aliases: string[] }> = [];

  for (const med of FORMULARY_REFERENCE_MEDS) {
    for (const alias of med.aliases) {
      if (normalized.includes(alias.toLowerCase())) {
        matched.push({ brandName: med.brandName, genericName: med.genericName, aliases: med.aliases });
        break;
      }
    }
  }

  return matched;
}

export interface MedicineMatchResult {
  exactMatch: boolean;
  matchedName?: string;
  genericName?: string;
  brandName?: string;
  form?: string;
  strength?: string;
  confidence: number;
  suggestions: Array<{
    name: string;
    generic: string;
    form?: string;
    strength?: string;
    distance: number;
  }>;
}

/**
 * Standard Levenshtein Distance calculation
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[s1.length][s2.length];
}

/**
 * Matches heard medicine name against the formulary
 */
export async function matchHeardMedicine(heardText: string): Promise<MedicineMatchResult> {
  const clean = heardText.trim();
  if (!clean) {
    return { exactMatch: false, confidence: 0, suggestions: [] };
  }

  // 1. Direct database search
  const candidates = await db
    .select({
      brandName: medicineBrands.brandName,
      genericName: medicineBrands.genericName,
      form: medicineBrands.form,
      strength: medicineBrands.strength,
    })
    .from(medicineBrands)
    .where(
      or(
        ilike(medicineBrands.brandName, `%${clean}%`),
        ilike(medicineBrands.genericName, `%${clean}%`)
      )
    )
    .limit(10);

  // If no brands found, check drugs table
  if (candidates.length === 0) {
    const genericCandidates = await db
      .select({
        genericName: drugs.genericName,
        drugClass: drugs.drugClass,
      })
      .from(drugs)
      .where(ilike(drugs.genericName, `%${clean}%`))
      .limit(5);

    for (const g of genericCandidates) {
      candidates.push({
        brandName: g.genericName,
        genericName: g.genericName,
        form: 'Tab',
        strength: '',
      });
    }
  }

  // Exact match check
  const exact = candidates.find(
    (c) =>
      c.brandName.toLowerCase() === clean.toLowerCase() ||
      c.genericName.toLowerCase() === clean.toLowerCase()
  );

  if (exact) {
    return {
      exactMatch: true,
      matchedName: exact.brandName,
      brandName: exact.brandName,
      genericName: exact.genericName,
      form: exact.form,
      strength: exact.strength,
      confidence: 1.0,
      suggestions: [],
    };
  }

  // Fuzzy score candidates
  const scored = candidates
    .map((c) => {
      const distBrand = levenshteinDistance(clean, c.brandName);
      const distGeneric = levenshteinDistance(clean, c.genericName);
      const minDistance = Math.min(distBrand, distGeneric);
      return {
        name: c.brandName,
        generic: c.genericName,
        form: c.form,
        strength: c.strength,
        distance: minDistance,
      };
    })
    .sort((a, b) => a.distance - b.distance);

  const topSuggestions = scored.slice(0, 3);
  const best = topSuggestions[0];

  return {
    exactMatch: false,
    confidence: best && best.distance <= 2 ? 0.8 : 0.4,
    suggestions: topSuggestions,
  };
}
