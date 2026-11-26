// One server-side medication safety decision, shared by every route that can
// check, finalize, issue, print or deliver a prescription (AGENTS.md rule 6).
//
// Policy (pending clinician review, see output/patient-qa/Doctor_Treatment_Validation.md):
// - Hard stops cannot be overridden: documented allergy, pregnancy category D/X
//   in pregnancy, formulary age limits, renal "avoid" below the eGFR threshold,
//   DGDA critical recall, a medicine missing from the formulary, and missing
//   safety inputs (allergy status, pregnancy status, child weight).
// - Other critical alerts (interaction, duplicate therapy, recorded condition
//   contraindication, renal dose reduction) need an explicit clinician override
//   with a reason. An override is bound to the exact regimen and patient context;
//   any change to either invalidates it.
// - Warnings are shown but do not block.

import crypto from 'node:crypto';
import { checkAllergies, checkContraindications, checkInteractions, checkPregnancy, normalizeName } from './safety-engine';
import type { DrugInteractionRecord, DrugRecord, SafetyAlert } from '@/types';

export type StopKind = 'hard' | 'override' | 'none';

export interface SafetyContext {
  age: number | null;
  gender: string | null;
  weightKg: number | null;
  /** Entries as recorded; "no known allergies" entries count as a recorded answer. */
  allergies: string[];
  /** null = not asked or not recorded. */
  isPregnant: boolean | null;
  egfr: number | null;
  conditions: string[];
  currentMedicines: string[];
}

export interface RegimenItem {
  genericName: string;
  brandName?: string;
  strength: string;
  form: string;
  dosingSchedule: string;
  durationDays: number;
}

export interface RecallNotice {
  title: string;
  body: string;
}

export interface SafetyOverride {
  alertId: string;
  reason: string;
  clinicianId: string;
  contextVersion: string;
  regimenHash: string;
  recordedAt: string;
}

export interface DecisionAlert extends Omit<SafetyAlert, 'type'> {
  type: SafetyAlert['type'] | 'missing_input' | 'formulary' | 'recall';
  stop: StopKind;
  override?: { reason: string; clinicianId: string; recordedAt: string };
}

export interface SafetyDecision {
  /** 'clear' = may finalize; 'needs_override' = overridable stops remain; 'blocked' = hard stop. */
  status: 'clear' | 'needs_override' | 'blocked';
  safeToFinalize: boolean;
  alerts: DecisionAlert[];
  missingInputs: string[];
  contextVersion: string;
  regimenHash: string;
  /** Overrides that no longer match the current regimen or context. */
  staleOverrides: number;
}

const NO_KNOWN_ALLERGY = /^(?:nkda|nka|none|nil|no(?:\s+known)?(?:\s+drug)?\s+allerg(?:y|ies)|no allergy|কোনো\s*(?:এলার্জি|অ্যালার্জি)\s*নেই|এলার্জি\s*নেই|নেই)$/iu;

export function isNoKnownAllergy(entry: string): boolean {
  return NO_KNOWN_ALLERGY.test(entry.trim().replace(/[.।]+$/u, ''));
}

function sha(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** Hash of the exact regimen: medicine, strength, form, schedule and duration. */
export function computeRegimenHash(items: RegimenItem[]): string {
  return sha(
    items
      .map((item) => [norm(item.genericName), norm(item.strength), norm(item.form), norm(item.dosingSchedule), item.durationDays])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
}

/** Hash of every patient input the safety rules read. */
export function computeContextVersion(context: SafetyContext): string {
  return sha({
    age: context.age,
    gender: context.gender,
    weightKg: context.weightKg,
    allergies: [...context.allergies].map(norm).sort(),
    isPregnant: context.isPregnant,
    egfr: context.egfr,
    conditions: [...context.conditions].map(norm).sort(),
    currentMedicines: [...context.currentMedicines].map(norm).sort(),
  });
}

/** Safety inputs that must be recorded before any prescription is finalized. */
export function missingSafetyInputs(context: SafetyContext): string[] {
  const missing: string[] = [];
  if (context.age === null || !Number.isFinite(context.age)) missing.push('age');
  if (context.allergies.filter((entry) => entry.trim()).length === 0) missing.push('allergy_status');
  const female = context.gender === 'female';
  if (female && context.age !== null && context.age >= 12 && context.age <= 50 && context.isPregnant === null) {
    missing.push('pregnancy_status');
  }
  if (context.age !== null && context.age < 12 && (context.weightKg === null || context.weightKg <= 0)) missing.push('weight');
  return missing;
}

const MISSING_TEXT: Record<string, { title: string; description: string }> = {
  age: { title: 'Age not recorded', description: 'Record the patient age before prescribing.' },
  allergy_status: {
    title: 'Allergy status not recorded',
    description: 'Record each allergy, or record "No known allergies" after asking the patient.',
  },
  pregnancy_status: {
    title: 'Pregnancy status not recorded',
    description: 'Record whether the patient is pregnant before prescribing.',
  },
  weight: { title: 'Child weight not recorded', description: 'Record the weight in kg. Child doses depend on weight.' },
};

const HARD_TYPES = new Set(['allergy', 'pregnancy', 'age', 'missing_input', 'formulary', 'recall']);

function stopFor(alert: Omit<DecisionAlert, 'stop'>): StopKind {
  if (alert.severity !== 'critical') return 'none';
  if (HARD_TYPES.has(alert.type)) return 'hard';
  if (alert.type === 'renal' && alert.id.startsWith('renal-avoid-')) return 'hard';
  return 'override';
}

export interface EvaluateInput {
  context: SafetyContext;
  items: RegimenItem[];
  formulary: DrugRecord[];
  interactions: DrugInteractionRecord[];
  recalls?: RecallNotice[];
  overrides?: SafetyOverride[];
}

/** Pure, deterministic safety decision for an exact regimen and patient context. */
export function evaluatePrescriptionSafety(input: EvaluateInput): SafetyDecision {
  const { context, items, formulary, interactions } = input;
  const contextVersion = computeContextVersion(context);
  const regimenHash = computeRegimenHash(items);
  const raw: Omit<DecisionAlert, 'stop'>[] = [];
  const allergies = context.allergies.filter((entry) => entry.trim() && !isNoKnownAllergy(entry));

  const missingInputs = missingSafetyInputs(context);
  for (const key of missingInputs) {
    raw.push({
      id: `missing-${key}`,
      drug_id: '',
      drug_name: '',
      severity: 'critical',
      type: 'missing_input',
      ...MISSING_TEXT[key],
    });
  }
  if (items.length === 0) {
    raw.push({
      id: 'missing-medicines',
      drug_id: '',
      drug_name: '',
      severity: 'critical',
      type: 'missing_input',
      title: 'No medicines on the prescription',
      description: 'Add at least one medicine before finalizing.',
    });
  }

  const matched: { item: RegimenItem; drug: DrugRecord }[] = [];
  for (const item of items) {
    const drug = formulary.find((record) => normalizeName(record.generic_name) === normalizeName(item.genericName));
    if (!drug) {
      raw.push({
        id: `formulary-${normalizeName(item.genericName)}`,
        drug_id: '',
        drug_name: item.genericName,
        severity: 'critical',
        type: 'formulary',
        title: `${item.genericName} is not in the approved formulary`,
        description: 'Only medicines with an approved formulary record can be checked and prescribed.',
      });
      continue;
    }
    matched.push({ item, drug });
  }

  const medicineNames = matched.map(({ drug }) => drug.generic_name);
  for (const { drug } of matched) {
    raw.push(...checkAllergies(drug, allergies));
    raw.push(...checkPregnancy(drug, context.isPregnant === true));
    raw.push(...checkContraindications(drug, context.conditions, [], context.age ?? undefined));

    if (drug.renal_adjustment && context.egfr !== null && context.egfr < drug.renal_adjustment.egfr_threshold) {
      const avoid = drug.renal_adjustment.action === 'avoid';
      raw.push({
        id: `renal-${avoid ? 'avoid' : 'adjust'}-${drug.id}`,
        drug_id: drug.id,
        drug_name: drug.generic_name,
        severity: 'critical',
        type: 'renal',
        title: avoid
          ? `${drug.generic_name}: avoid at eGFR ${context.egfr}`
          : `${drug.generic_name}: reduce dose at eGFR ${context.egfr}`,
        description: [drug.renal_adjustment.note, drug.renal_adjustment.adjusted_dose].filter(Boolean).join('. '),
      });
    } else if (drug.renal_adjustment && context.egfr === null) {
      raw.push({
        id: `renal-unknown-${drug.id}`,
        drug_id: drug.id,
        drug_name: drug.generic_name,
        severity: 'warning',
        type: 'renal',
        title: `${drug.generic_name}: kidney function not recorded`,
        description: `This medicine needs a dose change when eGFR is below ${drug.renal_adjustment.egfr_threshold}.`,
      });
    }

    // Interactions with the patient's current medicines and the rest of this regimen.
    const others = [...context.currentMedicines, ...medicineNames.filter((name) => name !== drug.generic_name)];
    for (const alert of checkInteractions(drug, others, interactions)) {
      // One stable id per medicine pair, whichever side found it.
      const other = alert.id.slice(`interaction-${drug.id}-`.length);
      const pair = [normalizeName(drug.generic_name), other].sort().join('+');
      raw.push({ ...alert, id: `interaction-${pair}` });
    }

    const ingredient = normalizeName(drug.generic_name);
    const alreadyTaking = context.currentMedicines.some((medicine) => normalizeName(medicine.split(/\s+(?=\d)/, 1)[0]) === ingredient);
    const twiceInRegimen = medicineNames.filter((name) => normalizeName(name) === ingredient).length > 1;
    if (alreadyTaking || twiceInRegimen) {
      raw.push({
        id: `duplicate-${drug.id}`,
        drug_id: drug.id,
        drug_name: drug.generic_name,
        severity: 'critical',
        type: 'duplicate_therapy',
        title: `${drug.generic_name} is listed twice`,
        description: alreadyTaking
          ? `${drug.generic_name} is already in the current medicine list.`
          : `${drug.generic_name} appears more than once on this prescription.`,
      });
    }
  }

  for (const item of items) {
    const generic = item.genericName.toLowerCase();
    const brand = item.brandName?.toLowerCase();
    for (const notice of input.recalls ?? []) {
      const text = `${notice.title} ${notice.body}`.toLowerCase();
      if (text.includes(generic) || (brand && brand.length > 2 && text.includes(brand))) {
        raw.push({
          id: `recall-${normalizeName(item.genericName)}`,
          drug_id: '',
          drug_name: item.brandName || item.genericName,
          severity: 'critical',
          type: 'recall',
          title: `DGDA recall: ${item.brandName || item.genericName}`,
          description: notice.title,
        });
      }
    }
  }

  // A+B and B+A describe one problem; keep one alert per id.
  const seen = new Set<string>();
  const unique = raw.filter((alert) => {
    if (seen.has(alert.id)) return false;
    seen.add(alert.id);
    return true;
  });

  const valid = new Map<string, SafetyOverride>();
  let staleOverrides = 0;
  for (const override of input.overrides ?? []) {
    if (override.contextVersion === contextVersion && override.regimenHash === regimenHash) valid.set(override.alertId, override);
    else staleOverrides++;
  }

  const alerts: DecisionAlert[] = unique.map((alert) => {
    const stop = stopFor(alert);
    const override = stop === 'override' ? valid.get(alert.id) : undefined;
    return {
      ...alert,
      stop,
      ...(override ? { override: { reason: override.reason, clinicianId: override.clinicianId, recordedAt: override.recordedAt } } : {}),
    };
  });

  const blocked = alerts.some((alert) => alert.stop === 'hard');
  const pending = alerts.some((alert) => alert.stop === 'override' && !alert.override);
  const status = blocked ? 'blocked' : pending ? 'needs_override' : 'clear';
  return { status, safeToFinalize: status === 'clear', alerts, missingInputs, contextVersion, regimenHash, staleOverrides };
}

/** Builds a DrugRecord from a `drugs` table row. */
export function drugRecordFromRow(row: {
  id: string;
  genericName: string;
  drugClass: string;
  indications: unknown;
  doseRules: unknown;
  contraindications: unknown;
  pregnancyCategory: string;
  renalAdjustment: unknown;
  sourceChunkId?: string | null;
}): DrugRecord {
  const contraindications = (row.contraindications ?? {}) as DrugRecord['contraindications'];
  return {
    id: row.id,
    generic_name: row.genericName,
    drug_class: row.drugClass,
    indications: (row.indications as string[]) ?? [],
    dose_rules: row.doseRules as DrugRecord['dose_rules'],
    contraindications: { ...contraindications, conditions: contraindications.conditions ?? [], allergies: contraindications.allergies ?? [] },
    pregnancy_category: row.pregnancyCategory as DrugRecord['pregnancy_category'],
    renal_adjustment: (row.renalAdjustment as DrugRecord['renal_adjustment']) ?? undefined,
    source_chunk_id: row.sourceChunkId ?? undefined,
  };
}
