// Guideline disagreement for one medicine and one diagnosis.
//
// When verified passages both recommend and advise against the same medicine,
// both sides are kept and shown together. Code reads the population, care
// setting, severity, renal function and region each passage states, compares
// them with the documented patient, and decides whether the sources disagree
// about the same context (blocking) or give different advice for different
// contexts.
// No language model is involved. Quotes are verified verbatim by the caller.

import { createHash } from 'node:crypto';
import type { StructuredPatientInput } from '@/types';

export type Stance = 'recommends' | 'advises_against';

/** Context a passage states. Empty arrays mean the passage does not limit that dimension. */
export interface PassageContext {
  population: Population[];
  setting: Setting[];
  severity: Severity[];
  renal: RenalFunction[];
  region: string[];
}

export type Population = 'adults' | 'children' | 'older_adults' | 'pregnancy' | 'penicillin_allergy';
export type Setting = 'outpatient' | 'inpatient' | 'intensive_care';
export type Severity = 'mild' | 'moderate' | 'severe';
export type RenalFunction =
  | 'egfr_lt_30'
  | 'egfr_lt_45'
  | 'egfr_lt_60'
  | 'egfr_gte_30'
  | 'egfr_gte_60'
  | 'renal_impairment'
  | 'normal_renal';

const POPULATION: Record<Population, RegExp> = {
  adults: /\badults?\b/i,
  children: /\b(?:child|children|pediatric|paediatric|infants?)\b/i,
  older_adults: /\b(?:older adults|elderly|aged (?:65|sixty-five) (?:years )?(?:or|and) (?:older|over)|over 65)\b/i,
  pregnancy: /\bpregnan\w*/i,
  penicillin_allergy: /\bpenicillin (?:allergy|hypersensitivity)|beta-?lactam allergy\b/i,
};
const SETTING: Record<Setting, RegExp> = {
  outpatient: /\b(?:outpatients?|ambulatory|community setting|primary care|managed at home|home treatment)\b/i,
  inpatient: /\b(?:inpatients?|hospitali[sz]ed|admitted|hospital ward)\b/i,
  intensive_care: /\b(?:intensive care|icu|critical care)\b/i,
};
const SEVERITY: Record<Severity, RegExp> = {
  mild: /\bmild\b/i,
  moderate: /\bmoderate\b/i,
  severe: /\b(?:severe(?!\s+(?:penicillin|beta-?lactam|drug)\s+(?:allergy|hypersensitivity))|critical|life-?threatening)\b/i,
};
const RENAL: Record<RenalFunction, RegExp> = {
  egfr_lt_30: /\be?gfr\s*(?:<|below|under|less than)\s*30\b/i,
  egfr_lt_45: /\be?gfr\s*(?:<|below|under|less than)\s*45\b/i,
  egfr_lt_60: /\be?gfr\s*(?:<|below|under|less than)\s*60\b/i,
  egfr_gte_30: /\be?gfr\s*(?:>=|≥|at least|above|over|greater than)\s*30\b/i,
  egfr_gte_60: /\be?gfr\s*(?:>=|≥|at least|above|over|greater than)\s*60\b/i,
  renal_impairment: /\b(?:renal impairment|impaired renal function|chronic kidney disease|ckd|renal failure|kidney impairment)\b/i,
  normal_renal: /\b(?:normal renal function|normal kidney function|preserved renal function|without renal impairment)\b/i,
};

function extractRegions(sentence: string): string[] {
  const found: string[] = [];
  const regex = /\bin regions with\s+([^,.;()]{2,80})/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sentence)) !== null) {
    const cleaned = match[1].trim().replace(/\s+/g, ' ').toLowerCase();
    if (cleaned && !found.includes(cleaned)) found.push(cleaned);
  }
  return found;
}

export function passageContext(sentence: string): PassageContext {
  const population = (Object.keys(POPULATION) as Population[]).filter((key) => POPULATION[key].test(sentence));
  // "older adults" also matches "adults"; keep the narrower group only.
  const narrowedPop = population.includes('older_adults') ? population.filter((key) => key !== 'adults') : population;
  const setting = (Object.keys(SETTING) as Setting[]).filter((key) => SETTING[key].test(sentence));
  const severity = (Object.keys(SEVERITY) as Severity[]).filter((key) => SEVERITY[key].test(sentence));
  const rawRenal = (Object.keys(RENAL) as RenalFunction[]).filter((key) => RENAL[key].test(sentence));
  // If a specific low eGFR threshold is named alongside generic "renal impairment", keep the specific threshold.
  const hasSpecificLowEgfr = rawRenal.some((r) => r === 'egfr_lt_30' || r === 'egfr_lt_45' || r === 'egfr_lt_60');
  const renal = hasSpecificLowEgfr ? rawRenal.filter((r) => r !== 'renal_impairment') : rawRenal;
  const region = extractRegions(sentence);
  return { population: narrowedPop, setting, severity, renal, region };
}

/** Groups that cannot both describe one patient. */
const EXCLUSIVE_POPULATION: [Population, Population][] = [
  ['adults', 'children'],
  ['older_adults', 'children'],
];

const EXCLUSIVE_SEVERITY: [Severity, Severity][] = [
  ['mild', 'severe'],
];

const EXCLUSIVE_RENAL: [RenalFunction, RenalFunction][] = [
  ['egfr_lt_30', 'normal_renal'],
  ['egfr_lt_30', 'egfr_gte_30'],
  ['egfr_lt_30', 'egfr_gte_60'],
  ['egfr_lt_45', 'normal_renal'],
  ['egfr_lt_45', 'egfr_gte_60'],
  ['egfr_lt_60', 'normal_renal'],
  ['egfr_lt_60', 'egfr_gte_60'],
  ['renal_impairment', 'normal_renal'],
  ['renal_impairment', 'egfr_gte_60'],
];

function pairsDisjoint<T>(a: T[], b: T[], exclusive: [T, T][]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  return a.every((left) => b.every((right) => exclusive.some(([x, y]) => (x === left && y === right) || (x === right && y === left))));
}

function settingsDisjoint(a: Setting[], b: Setting[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  return !a.some((value) => b.includes(value));
}

function regionPairDisjoint(left: string, right: string): boolean {
  const hl = /^(high|low)\s+(.+)$/i;
  const a = hl.exec(left);
  const b = hl.exec(right);
  if (a && b && a[2].toLowerCase() === b[2].toLowerCase() && a[1].toLowerCase() !== b[1].toLowerCase()) {
    return true;
  }
  return false;
}

function regionsDisjoint(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  return a.every((left) => b.every((right) => regionPairDisjoint(left, right)));
}

/** True when two passages address clearly disjoint contexts. Anything unclear stays the same context (blocking). */
export function differentContexts(a: PassageContext, b: PassageContext): boolean {
  return (
    pairsDisjoint(a.population, b.population, EXCLUSIVE_POPULATION) ||
    settingsDisjoint(a.setting, b.setting) ||
    pairsDisjoint(a.severity, b.severity, EXCLUSIVE_SEVERITY) ||
    pairsDisjoint(a.renal, b.renal, EXCLUSIVE_RENAL) ||
    regionsDisjoint(a.region, b.region)
  );
}

/** One documented patient fact compared with what a passage states. */
export interface FitItem {
  dimension: 'population' | 'setting' | 'severity' | 'renal' | 'region';
  /** What the passage states, e.g. "adults", "outpatient", "mild", "egfr_lt_30", or region text. */
  value: Population | Setting | Severity | RenalFunction | string;
  /** What the record says, e.g. "45" (age), "not_pregnant", "outpatient", "egfr:78", "mild". */
  patient: string;
}

/** A fact the record does not document yet. */
export type NeededFact = 'age' | 'pregnancy_status' | 'allergy_status' | 'care_setting' | 'severity' | 'egfr' | 'region';

export interface ContextFit {
  matches: FitItem[];
  mismatches: FitItem[];
  needs: NeededFact[];
  applies: 'yes' | 'no' | 'unknown';
}

const POPULATION_LABEL: Record<Population, string> = {
  adults: 'adults',
  children: 'children',
  older_adults: 'older adults (65 or older)',
  pregnancy: 'pregnancy',
  penicillin_allergy: 'penicillin allergy',
};
const SETTING_LABEL: Record<Setting, string> = {
  outpatient: 'outpatient care',
  inpatient: 'hospital (inpatient) care',
  intensive_care: 'intensive care',
};
const SEVERITY_LABEL: Record<Severity, string> = {
  mild: 'mild disease',
  moderate: 'moderate disease',
  severe: 'severe disease',
};
const RENAL_LABEL: Record<RenalFunction, string> = {
  egfr_lt_30: 'eGFR < 30 mL/min',
  egfr_lt_45: 'eGFR < 45 mL/min',
  egfr_lt_60: 'eGFR < 60 mL/min',
  egfr_gte_30: 'eGFR ≥ 30 mL/min',
  egfr_gte_60: 'eGFR ≥ 60 mL/min',
  renal_impairment: 'renal impairment',
  normal_renal: 'normal renal function',
};

function egfrMatches(group: RenalFunction, egfr: number): boolean {
  switch (group) {
    case 'egfr_lt_30': return egfr < 30;
    case 'egfr_lt_45': return egfr < 45;
    case 'egfr_lt_60': return egfr < 60;
    case 'egfr_gte_30': return egfr >= 30;
    case 'egfr_gte_60': return egfr >= 60;
    case 'renal_impairment': return egfr < 60;
    case 'normal_renal': return egfr >= 60;
  }
}

/** Compares the passage's stated context with the documented patient. */
export function fitPatient(context: PassageContext, patient: StructuredPatientInput): ContextFit {
  const matches: FitItem[] = [];
  const mismatches: FitItem[] = [];
  const needs: NeededFact[] = [];
  const age = Number.isFinite(patient.age) ? patient.age : null;
  const allergyRecorded = (patient.allergies ?? []).length > 0;
  const penicillinAllergic = /penicillin|amoxicillin|beta-?lactam/i.test((patient.allergies ?? []).join(' '));
  const place = (fits: boolean, item: FitItem) => (fits ? matches : mismatches).push(item);

  for (const group of context.population) {
    if (group === 'adults' || group === 'children' || group === 'older_adults') {
      if (age === null) needs.push('age');
      else place(group === 'adults' ? age >= 18 : group === 'children' ? age < 18 : age >= 65, { dimension: 'population', value: group, patient: String(age) });
    } else if (group === 'pregnancy') {
      if (typeof patient.is_pregnant !== 'boolean') needs.push('pregnancy_status');
      else place(patient.is_pregnant, { dimension: 'population', value: group, patient: patient.is_pregnant ? 'pregnant' : 'not_pregnant' });
    } else if (group === 'penicillin_allergy') {
      if (!allergyRecorded) needs.push('allergy_status');
      else place(penicillinAllergic, { dimension: 'population', value: group, patient: penicillinAllergic ? 'penicillin_allergy' : 'no_penicillin_allergy' });
    }
  }

  if (context.setting.length) {
    const setting = patient.care_setting ?? null;
    if (!setting) needs.push('care_setting');
    else if (context.setting.includes(setting)) matches.push({ dimension: 'setting', value: setting, patient: setting });
    else mismatches.push({ dimension: 'setting', value: context.setting[0], patient: setting });
  }

  if (context.severity.length) {
    const severity = patient.severity ?? null;
    if (!severity) needs.push('severity');
    else if (context.severity.includes(severity)) matches.push({ dimension: 'severity', value: severity, patient: severity });
    else mismatches.push({ dimension: 'severity', value: context.severity[0], patient: severity });
  }

  if (context.renal.length) {
    const egfr = typeof patient.egfr === 'number' && Number.isFinite(patient.egfr) ? patient.egfr : null;
    if (egfr === null) {
      needs.push('egfr');
    } else {
      for (const group of context.renal) {
        place(egfrMatches(group, egfr), { dimension: 'renal', value: group, patient: `egfr:${egfr}` });
      }
    }
  }

  if (context.region.length) {
    const recordedRegion = patient.region?.trim().replace(/\s+/g, ' ').toLowerCase() || null;
    if (!recordedRegion) {
      needs.push('region');
    } else {
      for (const r of context.region) {
        if (recordedRegion === r) {
          matches.push({ dimension: 'region', value: r, patient: recordedRegion });
        } else if (regionPairDisjoint(r, recordedRegion)) {
          mismatches.push({ dimension: 'region', value: r, patient: recordedRegion });
        } else {
          // Unclear whether the patient's recorded region matches this passage's region; never guess.
          needs.push('region');
        }
      }
    }
  }

  const applies = mismatches.length ? 'no' : needs.length ? 'unknown' : 'yes';
  return { matches, mismatches, needs: [...new Set(needs)], applies };
}

export interface ConflictSide<Citation> {
  stance: Stance;
  /** Plain-language reading of the passage, written by code. */
  summary: string;
  context: PassageContext;
  fit: ContextFit;
  citation: Citation;
}

export type ConflictKind =
  /** Applicable sources disagree about the same population and setting. Blocks automatic choice. */
  | 'same_context'
  /** Sources give different advice for different populations or settings; only the matching one applies. */
  | 'different_context'
  /** The record lacks a fact needed to tell which side applies. Blocks until recorded. */
  | 'needs_information';

export interface GuidelineConflict<Citation> {
  key: string;
  drug_id: string;
  generic_name: string;
  kind: ConflictKind;
  /** True when the medicine must not be selected or approved without a recorded review. */
  blocking: boolean;
  /** Which side applies to this patient when the sources address different contexts. */
  applicable_stance: Stance | null;
  sides: ConflictSide<Citation>[];
  needs: NeededFact[];
}

export function summarize(stance: Stance, name: string, context: PassageContext): string {
  const who = [
    ...context.population.map((group) => POPULATION_LABEL[group]),
    ...context.setting.map((value) => SETTING_LABEL[value]),
    ...context.severity.map((value) => SEVERITY_LABEL[value]),
    ...context.renal.map((value) => RENAL_LABEL[value]),
    ...context.region.map((value) => `in regions with ${value}`),
  ];
  const scope = who.length ? ` for ${who.join(', ')}` : '';
  return stance === 'recommends' ? `Recommends ${name}${scope}.` : `Advises against ${name}${scope}.`;
}

interface SideInput<Citation> {
  stance: Stance;
  sentence: string;
  chunkId: string;
  citation: Citation;
}

/**
 * Classifies a disagreement. Returns null when only one stance has verified
 * passages (a single applicable source is not a conflict).
 */
export function classifyConflict<Citation>(
  drug: { id: string; generic_name: string },
  inputs: SideInput<Citation>[],
  patient: StructuredPatientInput,
): GuidelineConflict<Citation> | null {
  const sides: ConflictSide<Citation>[] = inputs.map((input) => {
    const context = passageContext(input.sentence);
    return { stance: input.stance, summary: summarize(input.stance, drug.generic_name, context), context, fit: fitPatient(context, patient), citation: input.citation };
  });
  const recommend = sides.filter((side) => side.stance === 'recommends');
  const against = sides.filter((side) => side.stance === 'advises_against');
  if (recommend.length === 0 || against.length === 0) return null;

  const key = createHash('sha256')
    .update(JSON.stringify([drug.id, ...inputs.map((input) => [input.stance, input.chunkId, input.sentence]).sort()]))
    .digest('hex')
    .slice(0, 32);
  const needs = [...new Set(sides.flatMap((side) => side.fit.needs))];

  const base = { key, drug_id: drug.id, generic_name: drug.generic_name, sides, needs };
  // Passages that may apply to this patient (matching, or not yet decidable).
  const live = sides.filter((side) => side.fit.applies !== 'no');
  const liveStances = new Set(live.map((side) => side.stance));
  if (liveStances.size < 2) {
    // Only one side can apply: different advice for different patients or contexts.
    return { ...base, kind: 'different_context', blocking: false, applicable_stance: liveStances.size === 1 ? [...liveStances][0] : null };
  }
  const liveRecommend = live.filter((side) => side.stance === 'recommends');
  const liveAgainst = live.filter((side) => side.stance === 'advises_against');
  const samePair = liveRecommend.some((r) => liveAgainst.some((a) => !differentContexts(r.context, a.context)));
  const bothApply = liveRecommend.some((side) => side.fit.applies === 'yes') && liveAgainst.some((side) => side.fit.applies === 'yes');
  // Opposite advice for the same kind of patient, or both sides already match: a genuine disagreement.
  if (samePair || bothApply) return { ...base, kind: 'same_context', blocking: true, applicable_stance: null };
  // Different contexts, and a missing fact decides which one applies.
  return { ...base, kind: 'needs_information', blocking: true, applicable_stance: null };
}
