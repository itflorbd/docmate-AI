import { describe, expect, it } from 'vitest';
import {
  computeContextVersion,
  computeRegimenHash,
  evaluatePrescriptionSafety,
  isNoKnownAllergy,
  type RegimenItem,
  type SafetyContext,
  type SafetyOverride,
} from '@/lib/prescription-safety';
import { clinicalGate } from '@/lib/clinical-release';
import type { DrugInteractionRecord, DrugRecord } from '@/types';

// Synthetic formulary fixtures. Values mirror the seeded demo formulary and are
// not approved clinical data.
const drug = (id: string, generic: string, drugClass: string, extra: Partial<DrugRecord> = {}): DrugRecord => ({
  id,
  generic_name: generic,
  drug_class: drugClass,
  indications: [],
  dose_rules: { standard_adult: '1 tablet', route: 'oral', frequency: 'OD', duration_days: 7 },
  contraindications: { conditions: [], allergies: [generic] },
  pregnancy_category: 'B',
  ...extra,
});

const formulary: DrugRecord[] = [
  drug('d-amox', 'Amoxicillin', 'Aminopenicillin Antibiotic', {
    contraindications: { conditions: [], allergies: ['Penicillin', 'Amoxicillin'], age_min: 0 },
  }),
  drug('d-para', 'Paracetamol', 'Analgesic & Antipyretic', {
    contraindications: { conditions: ['Acute liver failure'], allergies: ['Paracetamol'], age_min: 0 },
  }),
  drug('d-asp', 'Aspirin', 'Antiplatelet & Salicylate', {
    pregnancy_category: 'D',
    contraindications: { conditions: [], allergies: ['Aspirin'], age_min: 16 },
  }),
  drug('d-clop', 'Clopidogrel', 'P2Y12 Antiplatelet Agent', { contraindications: { conditions: [], allergies: ['Clopidogrel'], age_min: 18 } }),
  drug('d-war', 'Warfarin', 'Vitamin K Antagonist', { pregnancy_category: 'X' }),
  drug('d-met', 'Metformin', 'Biguanide', {
    renal_adjustment: { egfr_threshold: 30, action: 'avoid', note: 'Lactic acidosis risk' },
  }),
  drug('d-spi', 'Spironolactone', 'Potassium-sparing diuretic', {
    renal_adjustment: { egfr_threshold: 45, action: 'reduce_dose', note: 'Hyperkalaemia risk', adjusted_dose: '25 mg every other day' },
  }),
  drug('d-old', 'Elderlyrestricted', 'Fixture class', { contraindications: { conditions: [], allergies: [], age_max: 75 } }),
];

const interactions: DrugInteractionRecord[] = [
  { id: 'i1', drug_a: 'Aspirin', drug_b: 'Warfarin', severity: 'critical', note: 'Major bleeding risk.' },
  { id: 'i2', drug_a: 'Clopidogrel', drug_b: 'Omeprazole', severity: 'warning', note: 'Reduced antiplatelet effect.' },
];

const adult: SafetyContext = {
  age: 40,
  gender: 'male',
  weightKg: 70,
  allergies: ['No known allergies'],
  isPregnant: null,
  egfr: 90,
  conditions: [],
  currentMedicines: [],
};

const item = (genericName: string, extra: Partial<RegimenItem> = {}): RegimenItem => ({
  genericName,
  brandName: genericName,
  strength: '500 mg',
  form: 'Tab',
  dosingSchedule: '1+1+1',
  durationDays: 5,
  ...extra,
});

const evaluate = (context: Partial<SafetyContext>, items: RegimenItem[], overrides: SafetyOverride[] = []) =>
  evaluatePrescriptionSafety({ context: { ...adult, ...context }, items, formulary, interactions, overrides });

const ids = (decision: ReturnType<typeof evaluate>) => decision.alerts.map((alert) => `${alert.id}:${alert.stop}`);

describe('prescription safety decision', () => {
  it('is clear for a formulary medicine with complete inputs', () => {
    const decision = evaluate({}, [item('Paracetamol')]);
    expect(decision.status).toBe('clear');
    expect(decision.safeToFinalize).toBe(true);
  });

  it('hard-stops a documented allergy, including drug-class allergy', () => {
    const decision = evaluate({ allergies: ['Penicillin (anaphylaxis)'] }, [item('Amoxicillin')]);
    expect(decision.status).toBe('blocked');
    expect(decision.alerts.find((alert) => alert.type === 'allergy')?.stop).toBe('hard');
  });

  it('requires an override for a critical interaction and accepts one bound to the regimen', () => {
    const items = [item('Aspirin', { strength: '75 mg' }), item('Warfarin', { strength: '5 mg' })];
    const first = evaluate({}, items);
    expect(first.status).toBe('needs_override');
    const alert = first.alerts.find((entry) => entry.type === 'drug_interaction')!;
    expect(alert.stop).toBe('override');
    expect(first.alerts.filter((entry) => entry.type === 'drug_interaction')).toHaveLength(1);

    const override: SafetyOverride = {
      alertId: alert.id,
      reason: 'Specialist plan, INR monitored weekly',
      clinicianId: 'doc-1',
      contextVersion: first.contextVersion,
      regimenHash: first.regimenHash,
      recordedAt: new Date().toISOString(),
    };
    const second = evaluate({}, items, [override]);
    expect(second.status).toBe('clear');
    expect(second.alerts.find((entry) => entry.id === alert.id)?.override?.reason).toContain('INR');
  });

  it('checks interactions with current medicines', () => {
    const decision = evaluate({ currentMedicines: ['Warfarin 5mg OD'] }, [item('Aspirin', { strength: '75 mg' })]);
    expect(decision.alerts.some((alert) => alert.type === 'drug_interaction' && alert.severity === 'critical')).toBe(true);
  });

  it('invalidates an override when the regimen or patient context changes', () => {
    const items = [item('Aspirin', { strength: '75 mg' }), item('Warfarin', { strength: '5 mg' })];
    const first = evaluate({}, items);
    const alertId = first.alerts.find((entry) => entry.type === 'drug_interaction')!.id;
    const override: SafetyOverride = {
      alertId,
      reason: 'Reviewed with cardiology',
      clinicianId: 'doc-1',
      contextVersion: first.contextVersion,
      regimenHash: first.regimenHash,
      recordedAt: new Date().toISOString(),
    };
    const changedDose = evaluate({}, [item('Aspirin', { strength: '300 mg' }), items[1]], [override]);
    expect(changedDose.status).toBe('needs_override');
    expect(changedDose.staleOverrides).toBe(1);
    const changedPatient = evaluate({ egfr: 50 }, items, [override]);
    expect(changedPatient.status).toBe('needs_override');
  });

  it('never lets an override clear a hard stop', () => {
    const first = evaluate({ allergies: ['Penicillin'] }, [item('Amoxicillin')]);
    const allergy = first.alerts.find((alert) => alert.type === 'allergy')!;
    const decision = evaluate({ allergies: ['Penicillin'] }, [item('Amoxicillin')], [
      { alertId: allergy.id, reason: 'Patient insists', clinicianId: 'doc-1', contextVersion: first.contextVersion, regimenHash: first.regimenHash, recordedAt: '' },
    ]);
    expect(decision.status).toBe('blocked');
  });

  it('requires an override for a recorded condition contraindication', () => {
    const decision = evaluate({ conditions: ['Acute liver failure'] }, [item('Paracetamol')]);
    expect(ids(decision)).toContain('condition-d-para-acuteliverfailure:override');
  });

  it('hard-stops category D and X medicines in pregnancy', () => {
    const decision = evaluate({ gender: 'female', age: 28, isPregnant: true }, [item('Warfarin', { strength: '5 mg' })]);
    expect(decision.alerts.find((alert) => alert.type === 'pregnancy')?.stop).toBe('hard');
    expect(decision.status).toBe('blocked');
  });

  it('hard-stops paediatric and elderly formulary age limits', () => {
    expect(evaluate({ age: 10, weightKg: 30 }, [item('Aspirin', { strength: '75 mg' })]).alerts.find((a) => a.type === 'age')?.stop).toBe('hard');
    expect(evaluate({ age: 82 }, [item('Elderlyrestricted')]).alerts.find((a) => a.type === 'age')?.stop).toBe('hard');
  });

  it('applies renal rules: avoid is a hard stop, dose reduction needs an override, unknown eGFR warns', () => {
    expect(ids(evaluate({ egfr: 25 }, [item('Metformin')]))).toContain('renal-avoid-d-met:hard');
    expect(ids(evaluate({ egfr: 40 }, [item('Spironolactone', { strength: '25 mg' })]))).toContain('renal-adjust-d-spi:override');
    const unknown = evaluate({ egfr: null }, [item('Metformin')]);
    expect(ids(unknown)).toContain('renal-unknown-d-met:none');
    expect(unknown.status).toBe('clear');
  });

  it('flags duplicate therapy within the regimen and against current medicines', () => {
    expect(evaluate({}, [item('Paracetamol'), item('Paracetamol', { strength: '1 g' })]).alerts.some((a) => a.type === 'duplicate_therapy')).toBe(true);
    expect(evaluate({ currentMedicines: ['Paracetamol 500mg'] }, [item('Paracetamol')]).alerts.some((a) => a.type === 'duplicate_therapy')).toBe(true);
  });

  it('blocks when safety inputs are missing', () => {
    expect(evaluate({ allergies: [] }, [item('Paracetamol')]).missingInputs).toEqual(['allergy_status']);
    expect(evaluate({ gender: 'female', age: 30, isPregnant: null }, [item('Paracetamol')]).missingInputs).toEqual(['pregnancy_status']);
    expect(evaluate({ age: 6, weightKg: null }, [item('Paracetamol')]).missingInputs).toEqual(['weight']);
    expect(evaluate({ allergies: [] }, [item('Paracetamol')]).status).toBe('blocked');
    expect(evaluate({}, []).status).toBe('blocked');
  });

  it('blocks medicines missing from the formulary and recalled medicines', () => {
    expect(evaluate({}, [item('Unknownazole')]).alerts[0].type).toBe('formulary');
    const recalled = evaluatePrescriptionSafety({
      context: adult,
      items: [item('Paracetamol', { brandName: 'Napa' })],
      formulary,
      interactions,
      recalls: [{ title: 'Recall: Napa batch 22', body: 'Contamination' }],
    });
    expect(recalled.status).toBe('blocked');
  });

  it('treats "no known allergies" as a recorded answer, never as an allergen', () => {
    expect(isNoKnownAllergy('NKDA')).toBe(true);
    expect(isNoKnownAllergy('কোনো এলার্জি নেই')).toBe(true);
    expect(isNoKnownAllergy('Penicillin')).toBe(false);
  });

  it('hashes the exact regimen independent of item order', () => {
    const a = [item('Aspirin'), item('Warfarin')];
    expect(computeRegimenHash(a)).toBe(computeRegimenHash([...a].reverse()));
    expect(computeRegimenHash(a)).not.toBe(computeRegimenHash([item('Aspirin', { durationDays: 6 }), item('Warfarin')]));
    expect(computeContextVersion(adult)).not.toBe(computeContextVersion({ ...adult, allergies: ['Penicillin'] }));
  });
});

describe('clinical release gate', () => {
  it('keeps official issuance closed by default', () => {
    expect(clinicalGate({}).officialIssuance).toBe(false);
    expect(clinicalGate({ DOCMATE_CLINICAL_RELEASE: 'approved' }).officialIssuance).toBe(false);
    expect(clinicalGate({ DOCMATE_CLINICAL_RELEASE: 'approved', DOCMATE_CLINICAL_RELEASE_REF: 'CRB-2026-01' }).officialIssuance).toBe(true);
  });

  it('allows synthetic treatment drafts only in demo mode or after release', () => {
    expect(clinicalGate({}).treatmentDrafts).toBe(false);
    expect(clinicalGate({ DOCMATE_DEMO_MODE: 'false' }).treatmentDrafts).toBe(false);
    expect(clinicalGate({ DOCMATE_DEMO_MODE: 'true' }).treatmentDrafts).toBe(true);
  });
});
