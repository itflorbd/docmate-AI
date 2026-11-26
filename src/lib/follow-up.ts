// Follow-up visits: what an earlier visit can carry forward, and how the doctor
// reconciles it. Pure functions; the server module reads and writes the rows.
//
// Rules:
// - Nothing from an earlier visit becomes a current fact without the doctor's
//   decision. Medicines need reconciliation; today's working diagnosis needs
//   explicit confirmation.
// - Old measurements and labs stay historical, with their date and source.
//   Today's vitals and labs start empty until recorded.
// - Only visits the doctor may see are read; the caller filters them.

import { z } from 'zod';
import type { LabValue, PatientVitals, StructuredPatientInput } from '@/types';

export type CarryKind = 'diagnosis' | 'allergy' | 'medication' | 'lab' | 'measurement' | 'plan' | 'open_item';

export interface CarrySource {
  case_id: string;
  patient_code: string;
  /** ISO date of the visit the fact comes from. */
  visit_date: string;
  /** Where in that visit the fact was recorded. */
  field: 'working_diagnosis' | 'allergies' | 'current_medicines' | 'lab_values' | 'vitals' | 'approved_plan' | 'prescription' | 'missing_information';
  doctor_name: string | null;
  /** True for the visit the doctor chose to continue. */
  selected_visit: boolean;
}

export interface CarryItem {
  id: string;
  kind: CarryKind;
  /** Short label, e.g. "Metformin 500 mg" or "HbA1c". */
  label: string;
  /** Value with unit for labs and measurements. */
  value: string | null;
  source: CarrySource;
}

export interface PriorVisit {
  id: string;
  patientCode: string;
  createdAt: Date;
  structuredInput: Partial<StructuredPatientInput>;
  confirmedDiagnosis: string | null;
  doctorName: string | null;
  /** Approved treatment plan items, if any. */
  approvedPlan: { generic_name: string; dose_text: string; frequency: string; duration_days: number }[];
  /** Items from prescriptions explicitly linked to this visit via prescriptions.case_id. */
  prescribedItems?: { generic_name: string; strength: string; dosing_schedule: string; duration_days: number }[];
  approvalNote: string | null;
  /** Open questions from the latest analysis. */
  openItems: string[];
}

const VITAL_LABELS: Record<keyof PatientVitals, { label: string; unit: string }> = {
  blood_pressure_systolic: { label: 'Blood pressure (systolic)', unit: 'mmHg' },
  blood_pressure_diastolic: { label: 'Blood pressure (diastolic)', unit: 'mmHg' },
  heart_rate: { label: 'Heart rate', unit: 'bpm' },
  respiratory_rate: { label: 'Respiratory rate', unit: '/min' },
  temperature_celsius: { label: 'Temperature', unit: '°C' },
  spo2_percent: { label: 'SpO2', unit: '%' },
};

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/**
 * Items that can be carried forward. The selected visit gives the diagnosis,
 * labs, measurements, plan and open items. Allergies and medicines are
 * collected from every accessible visit up to and including it.
 */
export function buildCarryItems(selected: PriorVisit, earlier: PriorVisit[]): CarryItem[] {
  const items: CarryItem[] = [];
  const source = (visit: PriorVisit, field: CarrySource['field']): CarrySource => ({
    case_id: visit.id,
    patient_code: visit.patientCode,
    visit_date: visit.createdAt.toISOString(),
    field,
    doctor_name: visit.doctorName,
    selected_visit: visit.id === selected.id,
  });
  const input = selected.structuredInput;

  if (selected.confirmedDiagnosis) {
    items.push({ id: 'diagnosis', kind: 'diagnosis', label: selected.confirmedDiagnosis, value: null, source: source(selected, 'working_diagnosis') });
  }

  // Allergies and medicines: newest visit first, one item per distinct entry.
  const seen = new Set<string>();
  for (const visit of [selected, ...earlier.filter((visit) => visit.createdAt <= selected.createdAt && visit.id !== selected.id)].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    for (const allergy of visit.structuredInput.allergies ?? []) {
      const key = `allergy:${slug(allergy)}`;
      if (!allergy.trim() || seen.has(key)) continue;
      seen.add(key);
      items.push({ id: key, kind: 'allergy', label: allergy.trim(), value: null, source: source(visit, 'allergies') });
    }
    for (const medicine of visit.structuredInput.current_medicines ?? []) {
      const key = `medication:${slug(medicine)}`;
      if (!medicine.trim() || seen.has(key)) continue;
      seen.add(key);
      items.push({ id: key, kind: 'medication', label: medicine.trim(), value: null, source: source(visit, 'current_medicines') });
    }
    for (const planned of visit.approvedPlan) {
      const key = `medication:${slug(planned.generic_name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: key,
        kind: 'medication',
        label: `${planned.generic_name} ${planned.dose_text}`.trim(),
        value: `${planned.frequency}, ${planned.duration_days} days`,
        source: source(visit, 'approved_plan'),
      });
    }
    for (const rxItem of visit.prescribedItems ?? []) {
      const key = `medication:${slug(rxItem.generic_name)}`;
      if (!rxItem.generic_name.trim() || seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: key,
        kind: 'medication',
        label: `${rxItem.generic_name} ${rxItem.strength}`.trim(),
        value: `${rxItem.dosing_schedule}, ${rxItem.duration_days} days`,
        source: source(visit, 'prescription'),
      });
    }
  }

  for (const lab of input.lab_values ?? []) {
    items.push({ id: `lab:${slug(lab.name)}`, kind: 'lab', label: lab.name, value: `${lab.value} ${lab.unit}`.trim(), source: source(selected, 'lab_values') });
  }
  for (const [key, meta] of Object.entries(VITAL_LABELS) as [keyof PatientVitals, { label: string; unit: string }][]) {
    const value = input.vitals?.[key];
    if (typeof value === 'number') items.push({ id: `measurement:${key}`, kind: 'measurement', label: meta.label, value: `${value} ${meta.unit}`, source: source(selected, 'vitals') });
  }
  if (typeof input.weight_kg === 'number') {
    items.push({ id: 'measurement:weight_kg', kind: 'measurement', label: 'Weight', value: `${input.weight_kg} kg`, source: source(selected, 'vitals') });
  }
  if (selected.approvalNote) {
    items.push({ id: 'plan:note', kind: 'plan', label: selected.approvalNote, value: null, source: source(selected, 'approved_plan') });
  }
  selected.openItems.slice(0, 5).forEach((text, index) => {
    items.push({ id: `open:${index}`, kind: 'open_item', label: text, value: null, source: source(selected, 'missing_information') });
  });
  return items;
}

/** The new visit's record before reconciliation: identity only, nothing clinical is current yet. */
export function initialFollowUpInput(selected: PriorVisit): StructuredPatientInput {
  const input = selected.structuredInput;
  return {
    age: input.age ?? 0,
    gender: input.gender ?? 'other',
    chief_complaint: '',
    symptoms: [],
    past_medical_history: input.past_medical_history ?? [],
    current_medicines: [],
    allergies: [],
    vitals: {},
    lab_values: [],
  };
}

export const reconciliationSchema = z
  .object({
    decisions: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          action: z.enum(['confirm', 'remove', 'continue', 'changed', 'stopped', 'still_open', 'done', 'not_relevant']),
          /** Corrected value for "confirm" (edited allergy) or "changed" (new dose). */
          value: z.string().trim().max(200).optional(),
        }),
      )
      .max(100),
    added_allergies: z.array(z.string().trim().min(2).max(120)).max(20).default([]),
    chief_complaint: z.string().trim().min(2).max(500),
    working_diagnosis: z.string().trim().min(2).max(200),
    /** The doctor confirms today's working diagnosis; it is never copied silently. */
    diagnosis_confirmed: z.literal(true),
    today: z
      .object({
        vitals: z
          .object({
            blood_pressure_systolic: z.number().int().min(50).max(260).optional(),
            blood_pressure_diastolic: z.number().int().min(30).max(160).optional(),
            heart_rate: z.number().int().min(20).max(250).optional(),
            respiratory_rate: z.number().int().min(4).max(80).optional(),
            temperature_celsius: z.number().min(30).max(45).optional(),
            spo2_percent: z.number().int().min(50).max(100).optional(),
          })
          .strict()
          .default({}),
        weight_kg: z.number().positive().max(400).optional(),
        labs: z.array(z.object({ name: z.string().trim().min(1).max(80), value: z.number(), unit: z.string().trim().min(1).max(20) })).max(20).default([]),
      })
      .default({ vitals: {}, labs: [] }),
  })
  .strict();
export type Reconciliation = z.infer<typeof reconciliationSchema>;

const ALLOWED: Record<CarryKind, Reconciliation['decisions'][number]['action'][]> = {
  diagnosis: ['still_open', 'done', 'not_relevant'],
  allergy: ['confirm', 'remove'],
  medication: ['continue', 'changed', 'stopped'],
  lab: [],
  measurement: [],
  plan: ['still_open', 'done', 'not_relevant'],
  open_item: ['still_open', 'done', 'not_relevant'],
};
/** Kinds that need a decision before the visit can be planned. */
const REQUIRED: CarryKind[] = ['allergy', 'medication'];

export type ReconcileError = { code: 'missing_decision' | 'invalid_decision' | 'unknown_item' | 'missing_value'; item_id: string };

export function checkReconciliation(items: CarryItem[], body: Reconciliation): ReconcileError[] {
  const errors: ReconcileError[] = [];
  const byId = new Map(body.decisions.map((decision) => [decision.id, decision]));
  for (const decision of body.decisions) {
    const item = items.find((entry) => entry.id === decision.id);
    if (!item) errors.push({ code: 'unknown_item', item_id: decision.id });
    else if (!ALLOWED[item.kind].includes(decision.action)) errors.push({ code: 'invalid_decision', item_id: decision.id });
    else if (decision.action === 'changed' && !decision.value) errors.push({ code: 'missing_value', item_id: decision.id });
  }
  for (const item of items) {
    if (REQUIRED.includes(item.kind) && !byId.has(item.id)) errors.push({ code: 'missing_decision', item_id: item.id });
  }
  return errors;
}

export interface HistoryUse {
  item_id: string;
  kind: CarryKind;
  label: string;
  /** Value with unit for historical labs and measurements. */
  value?: string | null;
  /** What the doctor decided. "corrected" and "changed" mean the label is the new value. */
  decision: 'confirmed' | 'corrected' | 'continued' | 'changed' | 'historical' | 'confirmed_today';
  /** Where the plan uses it. */
  used_for: 'allergy_check' | 'interaction_check' | 'working_diagnosis' | 'historical_context';
  source: CarrySource;
}

/** Applies the doctor's decisions. Returns the new record and which history it relied on. */
export function applyReconciliation(base: StructuredPatientInput, items: CarryItem[], body: Reconciliation, previousCaseId: string) {
  const decisions = new Map(body.decisions.map((decision) => [decision.id, decision]));
  const allergies: string[] = [];
  const medicines: string[] = [];
  const used: HistoryUse[] = [];

  for (const item of items) {
    const decision = decisions.get(item.id);
    if (item.kind === 'allergy' && decision?.action === 'confirm') {
      const value = decision.value || item.label;
      allergies.push(value);
      used.push({ item_id: item.id, kind: item.kind, label: value, decision: value === item.label ? 'confirmed' : 'corrected', used_for: 'allergy_check', source: item.source });
    }
    if (item.kind === 'medication' && (decision?.action === 'continue' || decision?.action === 'changed')) {
      const value = decision.action === 'changed' ? decision.value! : item.label;
      medicines.push(value);
      used.push({ item_id: item.id, kind: item.kind, label: value, decision: decision.action === 'changed' ? 'changed' : 'continued', used_for: 'interaction_check', source: item.source });
    }
    if ((item.kind === 'lab' || item.kind === 'measurement') && item.source.selected_visit) {
      used.push({ item_id: item.id, kind: item.kind, label: item.label, value: item.value, decision: 'historical', used_for: 'historical_context', source: item.source });
    }
  }
  const diagnosisItem = items.find((item) => item.kind === 'diagnosis');
  if (diagnosisItem && diagnosisItem.label.trim().toLowerCase() === body.working_diagnosis.trim().toLowerCase()) {
    used.push({ item_id: diagnosisItem.id, kind: 'diagnosis', label: diagnosisItem.label, decision: 'confirmed_today', used_for: 'working_diagnosis', source: diagnosisItem.source });
  }

  const vitals: PatientVitals = Object.fromEntries(Object.entries(body.today.vitals).filter(([, value]) => typeof value === 'number'));
  const labs: LabValue[] = body.today.labs.map((lab) => ({ name: lab.name, value: lab.value, unit: lab.unit }));
  const historical = items
    .filter((item) => (item.kind === 'lab' || item.kind === 'measurement') && item.source.selected_visit)
    .map((item) => ({ label: item.label, value: item.value, visit_date: item.source.visit_date, case_id: item.source.case_id }));

  const input: StructuredPatientInput = {
    ...base,
    chief_complaint: body.chief_complaint,
    allergies: [...new Set([...allergies, ...body.added_allergies])],
    current_medicines: [...new Set(medicines)],
    vitals,
    lab_values: labs,
    ...(body.today.weight_kg ? { weight_kg: body.today.weight_kg } : {}),
    // Labelled history; the engines read today's vitals and labs only.
    prior_visit: { case_id: previousCaseId, historical },
  };
  return { input, used, workingDiagnosis: body.working_diagnosis };
}
