import { describe, it, expect } from 'vitest';
import {
  checkAllergies,
  checkInteractions,
  checkPregnancy,
  checkContraindications,
  checkRenalAdjustment,
  evaluateDrugSafety,
} from '@/lib/safety-engine';
import { DrugRecord, DrugInteractionRecord, StructuredPatientInput } from '@/types';

describe('Deterministic Safety Engine (Hard Rule: Doses and Safety from Code & DB Only)', () => {
  const amoxicillinDrug: DrugRecord = {
    id: 'drug-amox',
    generic_name: 'Amoxicillin',
    drug_class: 'Aminopenicillin Antibiotic',
    indications: ['Community-Acquired Pneumonia'],
    dose_rules: {
      standard_adult: '500 mg orally every 8 hours',
      route: 'oral',
      frequency: 'TDS',
      duration_days: 7,
    },
    contraindications: {
      conditions: ['Infectious mononucleosis'],
      allergies: ['Penicillin', 'Amoxicillin', 'Ampicillin'],
    },
    pregnancy_category: 'B',
  };

  const nitroglycerinDrug: DrugRecord = {
    id: 'drug-nitro',
    generic_name: 'Nitroglycerin',
    drug_class: 'Organic Nitrate Vasodilator',
    indications: ['Angina pectoris', 'Acute Coronary Syndrome'],
    dose_rules: {
      standard_adult: '0.4 mg sublingually every 5 minutes (max 3 doses)',
      route: 'sublingual',
      frequency: 'PRN',
      duration_days: 1,
    },
    contraindications: {
      conditions: ['Severe hypotension', 'Right ventricular infarction'],
      allergies: ['Nitrates'],
    },
    pregnancy_category: 'C',
  };

  const lisinoprilDrug: DrugRecord = {
    id: 'drug-lupin',
    generic_name: 'Lisinopril',
    drug_class: 'ACE Inhibitor',
    indications: ['Hypertension', 'Heart failure'],
    dose_rules: {
      standard_adult: '10 mg orally once daily',
      route: 'oral',
      frequency: 'OD',
      duration_days: 30,
    },
    contraindications: {
      conditions: ['Bilateral renal artery stenosis', 'Angioedema history'],
      allergies: ['ACE inhibitors'],
    },
    pregnancy_category: 'D',
    renal_adjustment: {
      egfr_threshold: 30,
      action: 'reduce_dose',
      adjusted_dose: '2.5 mg to 5 mg once daily',
      note: 'Risk of acute hyperkalemia and renal functional deterioration',
    },
  };

  const methotrexateDrug: DrugRecord = {
    id: 'drug-mtx',
    generic_name: 'Methotrexate',
    drug_class: 'Antimetabolite Immunosuppressant',
    indications: ['Rheumatoid arthritis'],
    dose_rules: {
      standard_adult: '15 mg once weekly',
      route: 'oral',
      frequency: 'Weekly',
      duration_days: 30,
    },
    contraindications: {
      conditions: ['Pregnancy', 'Severe hepatic impairment'],
      allergies: ['Methotrexate'],
    },
    pregnancy_category: 'X',
  };

  const aspirinDrug: DrugRecord = {
    id: 'drug-asa',
    generic_name: 'Aspirin',
    drug_class: 'Antiplatelet / Salicylate NSAID',
    indications: ['Acute Coronary Syndrome', 'Secondary CV prevention'],
    dose_rules: {
      standard_adult: '300 mg chewed loading dose, then 75 mg daily',
      route: 'oral',
      frequency: 'OD',
      duration_days: 30,
    },
    contraindications: {
      conditions: ['Active gastrointestinal bleeding', 'Severe thrombocytopenia', 'Dengue Fever'],
      allergies: ['Aspirin', 'Salicylates', 'NSAIDs'],
      age_min: 16,
    },
    pregnancy_category: 'D',
  };

  const sampleInteractions: DrugInteractionRecord[] = [
    {
      id: 'int-nitro-sildenafil',
      drug_a: 'Nitroglycerin',
      drug_b: 'Sildenafil',
      severity: 'critical',
      note: 'Severe profound refractory hypotension and fatal cardiovascular collapse.',
    },
    {
      id: 'int-asa-ibuprofen',
      drug_a: 'Aspirin',
      drug_b: 'Ibuprofen',
      severity: 'warning',
      note: 'Ibuprofen competitively inhibits irreversible aspirin platelet COX-1 binding, diminishing antiplatelet protection.',
    },
  ];

  describe('1. Allergy Safety Check', () => {
    it('flags critical allergy when patient has exact drug allergy', () => {
      const alerts = checkAllergies(amoxicillinDrug, ['Amoxicillin']);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].type).toBe('allergy');
      expect(alerts[0].title).toContain('Amoxicillin');
    });

    it('flags critical cross-reactivity for Penicillin class allergy', () => {
      const alerts = checkAllergies(amoxicillinDrug, ['Penicillin']);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].description).toContain('anaphylaxis');
    });

    it('returns empty alert array when patient has unrelated or no allergies', () => {
      const alerts = checkAllergies(amoxicillinDrug, ['Sulfa', 'Pollen', 'Peanuts']);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('2. Drug-Drug Interactions Check', () => {
    it('detects critical fatal interaction between Nitroglycerin and Sildenafil', () => {
      const alerts = checkInteractions(nitroglycerinDrug, ['Sildenafil 50 mg'], sampleInteractions);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].title).toContain('Nitroglycerin + Sildenafil 50 mg');
      expect(alerts[0].description).toContain('hypotension');
    });

    it('detects warning interaction between Aspirin and Ibuprofen', () => {
      const alerts = checkInteractions(aspirinDrug, ['Ibuprofen 400 mg'], sampleInteractions);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].description).toContain('antiplatelet');
    });

    it('returns empty array when patient medicines have no recorded interaction', () => {
      const alerts = checkInteractions(nitroglycerinDrug, ['Paracetamol 500 mg', 'Omeprazole 20 mg'], sampleInteractions);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('3. Pregnancy & Teratogenicity Check', () => {
    it('flags Category X drugs as absolute critical contraindication in pregnancy', () => {
      const alerts = checkPregnancy(methotrexateDrug, true);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].title).toContain('Category X');
    });

    it('flags Category D drugs (e.g. ACE inhibitors) as critical risk in pregnancy', () => {
      const alerts = checkPregnancy(lisinoprilDrug, true);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].title).toContain('Category D');
    });

    it('flags Category C drugs with cautionary warning in pregnancy', () => {
      const alerts = checkPregnancy(nitroglycerinDrug, true);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].title).toContain('Category C');
    });

    it('returns no pregnancy alerts if patient is not pregnant', () => {
      const alerts = checkPregnancy(methotrexateDrug, false);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('4. Condition & Age Contraindications Check', () => {
    it('flags critical age alert when pediatric patient receives age-limited drug (Reye risk)', () => {
      const alerts = checkContraindications(aspirinDrug, [], [], 12);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].type).toBe('age');
      expect(alerts[0].title).toContain('Pediatric Safety Stop');
    });

    it('flags fatal NSAID contraindication in Dengue Fever patients', () => {
      const alerts = checkContraindications(aspirinDrug, ['Dengue fever'], ['High fever', 'Retro-orbital pain'], 30);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].title).toContain('Dengue Fever');
    });
  });

  describe('5. Renal Impairment & eGFR Check', () => {
    it('flags dose adjustment alert when patient eGFR falls below threshold', () => {
      const alerts = checkRenalAdjustment(lisinoprilDrug, 22);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('renal');
      expect(alerts[0].title).toContain('eGFR 22');
      expect(alerts[0].description).toContain('2.5 mg to 5 mg');
    });

    it('returns no renal alert when eGFR is above threshold', () => {
      const alerts = checkRenalAdjustment(lisinoprilDrug, 65);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('6. Comprehensive evaluateDrugSafety Multi-Pillar Check', () => {
    it('aggregates multiple alerts across allergy, interaction, and renal dysfunction', () => {
      const complexPatient: StructuredPatientInput = {
        age: 62,
        gender: 'female',
        chief_complaint: 'Severe joint pain and chest discomfort',
        symptoms: ['Chest pain'],
        past_medical_history: ['Hypertension'],
        current_medicines: ['Sildenafil 50 mg'],
        allergies: ['Nitrates'],
        vitals: {},
        lab_values: [],
        egfr: 25,
      };

      const alerts = evaluateDrugSafety(nitroglycerinDrug, complexPatient, sampleInteractions);
      expect(alerts.length).toBeGreaterThanOrEqual(2);
      const types = alerts.map((a) => a.type);
      expect(types).toContain('allergy');
      expect(types).toContain('drug_interaction');
    });
  });

  it('flags stored contraindications without a hardcoded drug exception', () => {
    expect(checkContraindications(amoxicillinDrug, ['INFECTIOUS MONONUCLEOSIS'], []))
      .toEqual([expect.objectContaining({ type: 'contraindication', severity: 'critical' })]);
  });

  it('checks upper age limits and includes both configured boundaries', () => {
    const drug = { ...aspirinDrug, contraindications: { ...aspirinDrug.contraindications, age_max: 80 } };
    expect(checkContraindications(drug, [], [], 81)).toEqual([expect.objectContaining({ type: 'age', severity: 'critical' })]);
    expect(checkContraindications(drug, [], [], 80)).toEqual([]);
    expect(checkContraindications(drug, [], [], 16)).toEqual([]);
  });

  it('flags an already recorded active ingredient and ignores a different medication', () => {
    const patient: StructuredPatientInput = {
      age: 40, gender: 'other', chief_complaint: 'Synthetic test',
      symptoms: [], past_medical_history: [], allergies: [], vitals: {}, lab_values: [],
      current_medicines: ['Amoxicillin 500 mg'],
    };
    expect(evaluateDrugSafety(amoxicillinDrug, patient, [])).toEqual([
      expect.objectContaining({ type: 'duplicate_therapy', severity: 'critical' }),
    ]);
    expect(evaluateDrugSafety(amoxicillinDrug, { ...patient, current_medicines: ['Different agent'] }, [])).toEqual([]);
  });

  describe('Prescription Safety Boundary & Stale Acknowledgment Invalidation', () => {
    it('produces deterministic, sorted regimen hashes', async () => {
      const { computeRegimenHash } = await import('@/lib/safety-engine');
      expect(computeRegimenHash(['drug-b', 'drug-a'])).toBe('drug-a,drug-b');
      expect(computeRegimenHash(['drug-a', 'drug-b'])).toBe('drug-a,drug-b');
    });

    it('identifies critical allergy and pregnancy X as non-bypassable hard stops', async () => {
      const { isHardStop } = await import('@/lib/safety-engine');
      expect(isHardStop({
        id: 'stop-1', drug_id: 'd1', drug_name: 'Amox', severity: 'critical', type: 'allergy',
        title: 'Allergy Anaphylaxis', description: 'Direct allergy',
      })).toBe(true);

      expect(isHardStop({
        id: 'stop-2', drug_id: 'd2', drug_name: 'Statin', severity: 'critical', type: 'pregnancy',
        title: 'Pregnancy Category X', description: 'Teratogenic',
      })).toBe(true);

      expect(isHardStop({
        id: 'warn-1', drug_id: 'd3', drug_name: 'Nitro', severity: 'warning', type: 'drug_interaction',
        title: 'Interaction', description: 'Mild interaction',
      })).toBe(false);
    });

    it('invalidates acknowledgments when case version or regimen changes', async () => {
      const { isAcknowledgmentValid, recomputeRegimenSafety, computeCaseVersion } = await import('@/lib/safety-engine');

      const initialPatient: StructuredPatientInput = {
        age: 45, gender: 'male', chief_complaint: 'Chest pain',
        symptoms: ['chest pain'], past_medical_history: [], allergies: [],
        current_medicines: ['Sildenafil 50 mg'], vitals: {}, lab_values: [],
      };

      const initialVersion = computeCaseVersion(initialPatient, '2026-11-21T10:00:00.000Z');
      const initialRegimen = [nitroglycerinDrug];
      const initialRegimenHash = nitroglycerinDrug.id;

      const acknowledgment = {
        alert_id: `interaction-${nitroglycerinDrug.id}-sildenafil`,
        drug_id: nitroglycerinDrug.id,
        case_version: initialVersion,
        regimen_hash: initialRegimenHash,
        acknowledged_at: '2026-11-21T10:05:00.000Z',
      };

      // Valid on initial matching case version and regimen
      expect(isAcknowledgmentValid(acknowledgment, initialVersion, initialRegimenHash)).toBe(true);

      // Stale if case version changes (e.g. updated patient vitals or newly added allergy)
      const updatedVersion = computeCaseVersion(initialPatient, '2026-11-21T10:30:00.000Z');
      expect(isAcknowledgmentValid(acknowledgment, updatedVersion, initialRegimenHash)).toBe(false);

      // Stale if regimen changes (e.g. added another drug)
      expect(isAcknowledgmentValid(acknowledgment, initialVersion, `${nitroglycerinDrug.id},drug-amox`)).toBe(false);

      // Recompute safety on updated case flags stale acknowledgment
      const verification = recomputeRegimenSafety(
        initialRegimen,
        initialPatient,
        sampleInteractions,
        [acknowledgment],
        updatedVersion,
      );

      expect(verification.staleAcknowledgments).toHaveLength(1);
      expect(verification.unacknowledgedCritical).toHaveLength(1);
      expect(verification.isValid).toBe(false);
    });
  });

});
