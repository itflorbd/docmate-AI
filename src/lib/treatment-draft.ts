// Deterministic draft treatment plan for a confirmed working diagnosis.
//
// AGENTS.md rules 2, 3, 4 and 6:
// - A medicine is proposed only when (a) its approved formulary record lists an
//   indication matching the diagnosis and (b) a published guideline passage
//   names the medicine and the diagnosis in the same sentence, without a
//   negation, and fits the documented patient (adult/child/pregnancy).
// - The quote is checked verbatim against the chunk in code.
// - Dose, route, frequency and duration come only from the formulary record.
// - Weak, conflicting or missing evidence returns insufficient_evidence with
//   concrete follow-up questions. Unresolved urgent findings stop the draft.
// No language model is involved.

import { classifyConflict, type GuidelineConflict } from './guideline-conflict';
import { verifyQuoteInChunk } from './verifier';
import { evaluatePrescriptionSafety, missingSafetyInputs, type SafetyContext, type SafetyDecision } from './prescription-safety';
import type { DrugInteractionRecord, DrugRecord, StructuredPatientInput } from '@/types';

export interface EvidenceChunk {
  id: string;
  text: string;
  section: string;
  page: number | null;
  sourceTitle: string;
  sourceType: string;
  lifecycle: string;
  /** Publication year and library version, when recorded. */
  sourceYear?: number | null;
  sourceVersion?: number | null;
}

export interface DraftCitation {
  chunk_id: string;
  quote: string;
  source_title: string;
  section: string;
  page: number | null;
  source_year?: number | null;
  source_version?: number | null;
  verified: true;
}

export interface DraftOption {
  drug_id: string;
  generic_name: string;
  drug_class: string;
  /** True when the quote calls it first-line or recommended. */
  preferred: boolean;
  /** Condition stated in the quote, e.g. "In patients with severe penicillin hypersensitivity". The doctor confirms it applies. */
  condition: string | null;
  dose_text: string;
  route: string;
  frequency: string;
  duration_days: number;
  max_daily_dose: string | null;
  formulary_notes: string | null;
  citation: DraftCitation;
  safety: SafetyDecision;
  /** Set when verified guidelines disagree about this medicine and the doctor must review. */
  dispute?: { key: string; kind: GuidelineConflict<DraftCitation>['kind'] } | null;
}

export type FollowUpQuestionCode =
  | 'urgent_review_required'
  | 'ask_allergy_status'
  | 'ask_pregnancy_status'
  | 'ask_weight'
  | 'ask_age'
  | 'no_guideline_for_diagnosis'
  | 'all_options_blocked';

export interface DraftFollowUpQuestion {
  code: FollowUpQuestionCode;
  params?: Record<string, string | number>;
}

export type ExcludedReasonCode =
  | 'guideline_advises_against_patient'
  | 'library_warns_against_diagnosis'
  | 'no_matching_guideline_for_patient'
  | 'evidence_for_adults_patient_is_child'
  | 'evidence_for_children'
  | 'evidence_for_pregnancy'
  | 'evidence_for_penicillin_allergy'
  | 'no_approved_child_dose'
  | 'no_approved_dose';

export interface DraftExcludedReason {
  code: ExcludedReasonCode;
  params?: Record<string, string | number>;
}

export interface TreatmentDraft {
  status: 'proposed' | 'insufficient_evidence' | 'urgent_review_required';
  diagnosis: string;
  options: DraftOption[];
  /** Medicines with evidence that were left out, and why (code + params for i18n & stable audit). */
  excluded: { generic_name: string; reason: DraftExcludedReason }[];
  /** Medicines where verified guideline passages disagree, with both sides. */
  conflicts: GuidelineConflict<DraftCitation>[];
  follow_up_questions: DraftFollowUpQuestion[];
  missing_information: string[];
}

const STOP = new Set(['acute', 'chronic', 'mild', 'moderate', 'severe', 'suspected', 'probable', 'with', 'without', 'and', 'the', 'adult', 'disease', 'syndrome', 'infection', 'type', 'stage', 'primary', 'secondary', 'uncomplicated']);

/** Words that name the diagnosis, e.g. "Community-acquired pneumonia" -> ["community", "acquired", "pneumonia"]. */
export function diagnosisTerms(diagnosis: string): string[] {
  const words = diagnosis
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP.has(word));
  const expansions: Record<string, string[]> = {
    cap: ['pneumonia'],
    acs: ['coronary'],
    stemi: ['stemi', 'coronary'],
    nstemi: ['nstemi', 'coronary'],
    htn: ['hypertension'],
    dengue: ['dengue'],
  };
  const abbreviations = diagnosis.toLowerCase().split(/[^a-z]+/).flatMap((word) => expansions[word] ?? []);
  return [...new Set([...words, ...abbreviations])];
}

const NEGATIVE = /\b(?:contraindicated|avoid(?:ed)?|never|must not|should not|not recommended|do not|prohibited|discontinue)\b/i;
const PREFERRED = /\b(?:first-line|first line|recommended|preferred|should be (?:chewed|given|administered|prescribed))\b/i;
// A supporting sentence must recommend the medicine, not only mention it.
const RECOMMENDS = /\b(?:recommended|first-line|first line|preferred|such as|should be (?:chewed|given|administered|prescribed)|may be (?:administered|given|used|added|prescribed|considered)|appropriate alternatives?|is the (?:sole|first)|therapy)\b/i;
// Sentences about harm are warnings, never support.
const RISK = /\b(?:risk|toxicity|adverse|hyperkal\w*|hazard|caution)\b/i;
// Opening clause that limits when a quote applies, e.g. "In patients with ... ," or "When ... ,".
const CONDITION = /^(?:in patients with|in regions with|in regions|when|if|unless|for patients with|for persistent)\b[^,;]*/i;

export function sentences(text: string): string[] {
  // Split off leading heading lines before collapsing whitespace: a line with no
  // end punctuation followed by a newline and a line starting with a capital letter.
  const blocks = text
    .replace(/\r\n?/g, '\n')
    .split(/(?<![.!?,;:\-])[ \t]*\n+[ \t]*(?=[A-Z(])/);
  return blocks.flatMap((block) =>
    block
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?:])\s+(?=[A-Z(])|\s+(?=\d{1,2}\.\s+[A-Z])/)
      .map((sentence) => sentence.trim().replace(/\s+\d{1,2}\.$/, '').replace(/^\d{1,2}\.\s+/, ''))
      .filter((sentence) => sentence.length >= 20),
  );
}

/** The clause of a sentence that names the medicine ("A must be avoided; give B" -> "give B"). */
function clauseNaming(sentence: string, name: string): string {
  return sentence.split(/;\s*/).find((clause) => mentions(clause, name)) ?? sentence;
}

const mentions = (text: string, term: string) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text);

/** Returns an exclusion reason code when the passage's wording does not fit this patient. */
function fitsPatient(sentence: string, patient: Pick<StructuredPatientInput, 'age' | 'is_pregnant' | 'allergies'>): ExcludedReasonCode | null {
  const lower = sentence.toLowerCase();
  if (/\badults?\b/.test(lower) && patient.age < 18) return 'evidence_for_adults_patient_is_child';
  if (/\b(?:child|children|pediatric|paediatric)\b/.test(lower) && !/\badults?\b/.test(lower) && patient.age >= 18) return 'evidence_for_children';
  if (/\bpregnan/.test(lower) && !NEGATIVE.test(lower) && patient.is_pregnant !== true) return 'evidence_for_pregnancy';
  const penicillinAllergic = (patient.allergies ?? []).some((allergy) => /penicillin|amoxicillin|beta-?lactam/i.test(allergy));
  if (/penicillin (?:allergy|hypersensitivity)/.test(lower) && !penicillinAllergic) return 'evidence_for_penicillin_allergy';
  return null;
}

function citationFor(chunk: EvidenceChunk, sentence: string): DraftCitation {
  return {
    chunk_id: chunk.id,
    quote: sentence,
    source_title: chunk.sourceTitle,
    section: chunk.section,
    page: chunk.page,
    source_year: chunk.sourceYear ?? null,
    source_version: chunk.sourceVersion ?? null,
    verified: true,
  };
}

function pickRecommendation(sides: { stance: string; sentence: string; chunk: EvidenceChunk }[]) {
  const recommend = sides.filter((side) => side.stance === 'recommends');
  const best = recommend.find((side) => PREFERRED.test(side.sentence)) ?? recommend[0];
  return best ? { chunk: best.chunk, sentence: best.sentence } : null;
}

export function safetyContextFromCase(patient: StructuredPatientInput): SafetyContext {
  return {
    age: Number.isFinite(patient.age) ? patient.age : null,
    gender: patient.gender ?? null,
    weightKg: patient.weight_kg ?? null,
    allergies: patient.allergies ?? [],
    isPregnant: typeof patient.is_pregnant === 'boolean' ? patient.is_pregnant : null,
    egfr: patient.egfr ?? null,
    conditions: patient.past_medical_history ?? [],
    currentMedicines: patient.current_medicines ?? [],
  };
}

const QUESTION_CODE: Record<string, FollowUpQuestionCode> = {
  allergy_status: 'ask_allergy_status',
  pregnancy_status: 'ask_pregnancy_status',
  weight: 'ask_weight',
  age: 'ask_age',
};

export interface BuildDraftInput {
  diagnosis: string;
  patient: StructuredPatientInput;
  formulary: DrugRecord[];
  interactions: DrugInteractionRecord[];
  chunks: EvidenceChunk[];
  activeUrgentFindings: number;
}

export function buildTreatmentDraft(input: BuildDraftInput): TreatmentDraft {
  const { diagnosis, patient } = input;
  const base = { diagnosis, options: [] as DraftOption[], excluded: [] as TreatmentDraft['excluded'], conflicts: [] as TreatmentDraft['conflicts'] };

  if (input.activeUrgentFindings > 0) {
    return {
      ...base,
      status: 'urgent_review_required',
      follow_up_questions: [{ code: 'urgent_review_required' }],
      missing_information: ['Decision on urgent finding'],
    };
  }

  const terms = diagnosisTerms(diagnosis);
  // Only published guidelines may support a treatment recommendation. Patient
  // records, case reports and textbooks never do.
  const published = input.chunks.filter((chunk) => chunk.sourceType === 'guideline' && chunk.lifecycle === 'published');
  // A guideline is about this diagnosis when its title or any of its passages names it.
  const relevantSources = new Set(
    published.filter((chunk) => terms.some((term) => mentions(chunk.text, term) || mentions(chunk.sourceTitle, term))).map((chunk) => chunk.sourceTitle),
  );
  const guidelines = published.filter((chunk) => relevantSources.has(chunk.sourceTitle));
  const context = safetyContextFromCase(patient);

  for (const drug of input.formulary) {
    const indicated = drug.indications.some((indication) => terms.some((term) => mentions(indication, term)));
    if (!indicated) continue;

    let support: { chunk: EvidenceChunk; sentence: string } | null = null;
    let contradicted: string | null = null;
    let mismatch: ExcludedReasonCode | null = null;
    // Every verified passage for and against this medicine, kept for the conflict view.
    const sides: { stance: 'recommends' | 'advises_against'; sentence: string; chunk: EvidenceChunk }[] = [];
    for (const chunk of guidelines) {
      for (const sentence of sentences(chunk.text)) {
        if (!mentions(sentence, drug.generic_name)) continue;
        // A passage that is not verbatim in its chunk is never shown as evidence.
        if (!verifyQuoteInChunk(sentence, chunk.text)) continue;
        const clause = clauseNaming(sentence, drug.generic_name);
        if (NEGATIVE.test(clause)) {
          contradicted = sentence;
          sides.push({ stance: 'advises_against', sentence, chunk });
          continue;
        }
        if (RISK.test(clause) || !RECOMMENDS.test(clause)) continue;
        sides.push({ stance: 'recommends', sentence, chunk });
        const misfit = fitsPatient(sentence, patient);
        if (misfit) {
          mismatch = misfit;
          continue;
        }
        if (!support || (PREFERRED.test(sentence) && !PREFERRED.test(support.sentence))) support = { chunk, sentence };
      }
    }

    const conflict = classifyConflict(
      drug,
      sides.map((side) => ({ stance: side.stance, sentence: side.sentence, chunkId: side.chunk.id, citation: citationFor(side.chunk, side.sentence) })),
      patient,
    );
    if (conflict) base.conflicts.push(conflict);
    // A disagreement that blocks still shows the option (dose, safety), but it is
    // never preselected and cannot be approved without a recorded review.
    const recommendation = support ?? (conflict?.blocking ? pickRecommendation(sides) : null);
    if (!recommendation) {
      if (conflict && conflict.applicable_stance === 'advises_against') base.excluded.push({ generic_name: drug.generic_name, reason: { code: 'guideline_advises_against_patient' } });
      else if (contradicted) base.excluded.push({ generic_name: drug.generic_name, reason: { code: 'library_warns_against_diagnosis' } });
      else if (mismatch) base.excluded.push({ generic_name: drug.generic_name, reason: { code: mismatch } });
      continue;
    }
    if (contradicted && !conflict) {
      base.excluded.push({ generic_name: drug.generic_name, reason: { code: 'library_warns_against_diagnosis' } });
      continue;
    }
    if (conflict && !conflict.blocking && conflict.applicable_stance !== 'recommends') {
      base.excluded.push({
        generic_name: drug.generic_name,
        reason: { code: conflict.applicable_stance === 'advises_against' ? 'guideline_advises_against_patient' : 'no_matching_guideline_for_patient' },
      });
      continue;
    }
    support = recommendation;

    const child = patient.age < 18;
    const dose = child ? drug.dose_rules.pediatric : drug.dose_rules.standard_adult;
    if (!dose || /contraindicated|not indicated|avoid|not established/i.test(dose)) {
      base.excluded.push({ generic_name: drug.generic_name, reason: { code: child ? 'no_approved_child_dose' : 'no_approved_dose' } });
      continue;
    }

    const safety = evaluatePrescriptionSafety({
      context,
      items: [{ genericName: drug.generic_name, strength: dose, form: drug.dose_rules.route, dosingSchedule: drug.dose_rules.frequency, durationDays: drug.dose_rules.duration_days }],
      formulary: input.formulary,
      interactions: input.interactions,
    });

    base.options.push({
      drug_id: drug.id,
      generic_name: drug.generic_name,
      drug_class: drug.drug_class,
      preferred: PREFERRED.test(clauseNaming(support.sentence, drug.generic_name)),
      condition: support.sentence.match(CONDITION)?.[0].trim() ?? null,
      dose_text: dose,
      route: drug.dose_rules.route,
      frequency: drug.dose_rules.frequency,
      duration_days: drug.dose_rules.duration_days,
      max_daily_dose: drug.dose_rules.max_daily_dose ?? null,
      formulary_notes: drug.dose_rules.notes ?? null,
      citation: citationFor(support.chunk, support.sentence),
      safety,
      dispute: conflict?.blocking ? { key: conflict.key, kind: conflict.kind } : null,
    });
  }

  // Usable first, then unconditional evidence, then first-line wording, then name (stable order).
  base.options.sort(
    (a, b) =>
      Number(a.safety.status === 'blocked') - Number(b.safety.status === 'blocked') ||
      Number(a.condition !== null) - Number(b.condition !== null) ||
      Number(b.preferred) - Number(a.preferred) ||
      a.generic_name.localeCompare(b.generic_name),
  );

  const missing = missingSafetyInputs(context);
  const usable = base.options.filter((option) => option.safety.status !== 'blocked');
  const missingQuestions: DraftFollowUpQuestion[] = missing
    .map((key) => QUESTION_CODE[key])
    .filter((code): code is FollowUpQuestionCode => Boolean(code))
    .map((code) => ({ code }));
  if (usable.length === 0) {
    const questions: DraftFollowUpQuestion[] = [...missingQuestions];
    if (base.options.length === 0) {
      questions.push({ code: 'no_guideline_for_diagnosis', params: { diagnosis } });
    } else {
      questions.push({ code: 'all_options_blocked' });
    }
    return {
      ...base,
      status: 'insufficient_evidence',
      follow_up_questions: questions,
      missing_information: missing.length ? missing : ['Guideline evidence for this diagnosis'],
    };
  }

  return { ...base, status: 'proposed', follow_up_questions: missingQuestions, missing_information: missing };
}
