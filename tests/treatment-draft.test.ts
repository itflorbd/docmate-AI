import { describe, expect, it } from 'vitest';
import { buildTreatmentDraft, diagnosisTerms, type EvidenceChunk } from '@/lib/treatment-draft';
import { verifyQuoteInChunk } from '@/lib/verifier';
import type { DrugRecord, StructuredPatientInput } from '@/types';

// Synthetic fixtures modelled on the demo library and formulary. Not approved clinical data.
const guideline = (id: string, text: string, sourceTitle = 'Synthetic Respiratory Guideline', section = 'Section 3: Regimens'): EvidenceChunk => ({
  id,
  text,
  section,
  page: 3,
  sourceTitle,
  sourceType: 'guideline',
  lifecycle: 'published',
});

const amoxicillin: DrugRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  generic_name: 'Amoxicillin',
  drug_class: 'Aminopenicillin Antibiotic',
  indications: ['Community-Acquired Pneumonia'],
  dose_rules: { standard_adult: '500 mg orally every 8 hours', pediatric: '40 mg/kg/day in 3 divided doses', route: 'oral', frequency: 'TDS', duration_days: 7, max_daily_dose: '3000 mg' },
  contraindications: { conditions: [], allergies: ['Penicillin', 'Amoxicillin'], age_min: 0 },
  pregnancy_category: 'B',
};
const doxycycline: DrugRecord = {
  id: '00000000-0000-4000-8000-000000000002',
  generic_name: 'Doxycycline',
  drug_class: 'Tetracycline Antibiotic',
  indications: ['Atypical Pneumonia'],
  dose_rules: { standard_adult: '100 mg orally twice daily', pediatric: 'Avoid in children < 8 years', route: 'oral', frequency: 'BD', duration_days: 7 },
  contraindications: { conditions: [], allergies: ['Doxycycline'], age_min: 8 },
  pregnancy_category: 'D',
};
const ibuprofen: DrugRecord = {
  id: '00000000-0000-4000-8000-000000000003',
  generic_name: 'Ibuprofen',
  drug_class: 'NSAID',
  indications: ['Fever', 'Dengue fever pain'],
  dose_rules: { standard_adult: '400 mg every 8 hours', route: 'oral', frequency: 'TDS', duration_days: 3 },
  contraindications: { conditions: [], allergies: ['Ibuprofen'] },
  pregnancy_category: 'C',
};
const formulary = [amoxicillin, doxycycline, ibuprofen];

const firstLine = 'For previously healthy adult outpatients with mild community-acquired pneumonia, oral Amoxicillin 500 mg three times daily is the recommended first-line therapy.';
const allergyAlternative = 'In patients with severe penicillin hypersensitivity, beta-lactams must be avoided entirely; oral Doxycycline 100 mg twice daily should be prescribed.';

const patient = (extra: Partial<StructuredPatientInput> = {}): StructuredPatientInput => ({
  age: 45,
  gender: 'male',
  chief_complaint: 'Cough and fever',
  symptoms: [],
  past_medical_history: [],
  current_medicines: [],
  allergies: ['No known allergies'],
  vitals: {},
  lab_values: [],
  ...extra,
});

const build = (chunks: EvidenceChunk[], extra: Partial<StructuredPatientInput> = {}, diagnosis = 'Community-acquired pneumonia', activeUrgentFindings = 0) =>
  buildTreatmentDraft({ diagnosis, patient: patient(extra), formulary, interactions: [], chunks, activeUrgentFindings });

describe('treatment draft', () => {
  it('proposes a formulary medicine with a verified guideline quote and formulary dosing', () => {
    const chunk = guideline('g1', `Clinical improvement is expected within 72 hours. ${firstLine}`);
    const draft = build([chunk]);
    expect(draft.status).toBe('proposed');
    const option = draft.options[0];
    expect(option).toMatchObject({ generic_name: 'Amoxicillin', preferred: true, dose_text: '500 mg orally every 8 hours', route: 'oral', duration_days: 7 });
    expect(option.citation.chunk_id).toBe('g1');
    expect(verifyQuoteInChunk(option.citation.quote, chunk.text)).toBe(true);
    expect(option.safety.status).toBe('clear');
  });

  it('never cites an unrelated synthetic record, even when its quote is verbatim', () => {
    const record: EvidenceChunk = {
      ...guideline('r1', 'SYNTHETIC RECORD FX-104. Cedar-17 was given oral Amoxicillin 500 mg for community-acquired pneumonia, recommended by the clinic.'),
      sourceTitle: 'Demo resource library',
      sourceType: 'textbook',
    };
    const caseReport: EvidenceChunk = { ...record, id: 'r2', sourceType: 'case_report' };
    const unpublished: EvidenceChunk = { ...guideline('r3', firstLine), lifecycle: 'in_review' };
    const draft = build([record, caseReport, unpublished]);
    expect(draft.status).toBe('insufficient_evidence');
    expect(draft.options).toEqual([]);
    expect(draft.follow_up_questions).toContainEqual({
      code: 'no_guideline_for_diagnosis',
      params: { diagnosis: 'Community-acquired pneumonia' },
    });
  });

  it('does not use a guideline about a different diagnosis', () => {
    const cardiology = guideline('c1', 'Aspirin 300 mg is recommended in acute coronary syndrome. Amoxicillin is recommended for dental prophylaxis.', 'Synthetic Cardiology Protocol');
    expect(build([cardiology]).options).toEqual([]);
  });

  it('treats a warning sentence as a contraindication, not support', () => {
    const dengue = guideline('d1', 'NSAIDs such as Ibuprofen are strictly contraindicated in dengue fever.', 'Synthetic Dengue Guideline');
    const draft = build([dengue], {}, 'Dengue fever');
    expect(draft.options).toEqual([]);
    expect(draft.excluded).toContainEqual({ generic_name: 'Ibuprofen', reason: { code: 'library_warns_against_diagnosis' } });
  });

  it('keeps both sides when the library recommends and warns against the same medicine', () => {
    const draft = build([guideline('g1', firstLine), guideline('g2', 'Amoxicillin should not be used for community-acquired pneumonia in this region.')]);
    const option = draft.options.find((o) => o.generic_name === 'Amoxicillin');
    expect(option?.dispute?.kind).toBe('same_context');
    expect(draft.conflicts[0].sides.map((side) => side.stance).sort()).toEqual(['advises_against', 'recommends']);
  });

  it('reads negation per clause and shows the condition the quote depends on', () => {
    const chunks = [guideline('g1', firstLine), guideline('g2', allergyAlternative, 'Synthetic Respiratory Guideline', 'Section 4: Penicillin allergy')];
    const allergic = build(chunks, { allergies: ['Penicillin (anaphylaxis)'] });
    const doxy = allergic.options.find((o) => o.generic_name === 'Doxycycline')!;
    expect(doxy.safety.status).toBe('clear');
    expect(doxy.condition).toBe('In patients with severe penicillin hypersensitivity');
    expect(allergic.options.find((o) => o.generic_name === 'Amoxicillin')?.safety.status).toBe('blocked');
    // Without a penicillin allergy, the allergy-only alternative does not fit the patient.
    expect(build(chunks).excluded).toContainEqual({ generic_name: 'Doxycycline', reason: { code: 'evidence_for_penicillin_allergy' } });
  });

  it('lists unconditional evidence before conditional evidence', () => {
    const azithro: DrugRecord = { ...doxycycline, id: '00000000-0000-4000-8000-000000000004', generic_name: 'Azithromycin', indications: ['Atypical Pneumonia'], pregnancy_category: 'B', contraindications: { conditions: [], allergies: [] } };
    const draft = buildTreatmentDraft({
      diagnosis: 'Community-acquired pneumonia',
      patient: patient(),
      formulary: [azithro, amoxicillin],
      interactions: [],
      chunks: [guideline('g1', `When Legionella is suspected, Azithromycin may be used as first-line monotherapy for pneumonia. ${firstLine}`)],
      activeUrgentFindings: 0,
    });
    expect(draft.options.map((o) => o.generic_name)).toEqual(['Amoxicillin', 'Azithromycin']);
    expect(draft.options[1].condition).toMatch(/^When Legionella is suspected/);
  });

  it('ignores mentions that do not recommend the medicine', () => {
    expect(build([guideline('g1', 'Amoxicillin levels rise in renal failure and pose a risk of toxicity in pneumonia.')]).options).toEqual([]);
  });

  it('matches evidence to the documented patient and uses the child dose', () => {
    expect(build([guideline('g1', firstLine)], { age: 6, weight_kg: 20 }).excluded[0].reason).toEqual({
      code: 'evidence_for_adults_patient_is_child',
    });
    const child = build([guideline('g1', 'For children with community-acquired pneumonia, oral Amoxicillin is the recommended first-line therapy.')], { age: 6, weight_kg: 20 });
    expect(child.options[0].dose_text).toBe('40 mg/kg/day in 3 divided doses');
  });

  it('abstains with a question when allergy status is missing', () => {
    const draft = build([guideline('g1', firstLine)], { allergies: [] });
    expect(draft.status).toBe('insufficient_evidence');
    expect(draft.follow_up_questions[0]).toEqual({ code: 'ask_allergy_status' });
    expect(draft.missing_information).toContain('allergy_status');
  });

  it('stops while an urgent finding is unresolved', () => {
    const draft = build([guideline('g1', firstLine)], {}, 'Community-acquired pneumonia', 1);
    expect(draft.status).toBe('urgent_review_required');
    expect(draft.options).toEqual([]);
  });

  it('extracts diagnosis terms and common abbreviations', () => {
    expect(diagnosisTerms('Suspected ACS (STEMI)')).toEqual(expect.arrayContaining(['stemi', 'coronary']));
    expect(diagnosisTerms('Community-acquired pneumonia')).toContain('pneumonia');
  });
});

describe('guideline disagreement', () => {
  // Two synthetic guidelines that disagree. Not real clinical guidance.
  const sourceA = (text: string) => ({ ...guideline('a1', text, 'Synthetic Guideline A (2025)'), sourceYear: 2025, sourceVersion: 1 });
  const sourceB = (text: string) => ({ ...guideline('b1', text, 'Synthetic Guideline B (2026)'), sourceYear: 2026, sourceVersion: 2 });
  const recommendA = 'For adult outpatients with community-acquired pneumonia, Amoxicillin is the recommended first-line therapy.';
  const againstB = 'For adult outpatients with community-acquired pneumonia, Amoxicillin should not be used as first-line therapy.';

  it('same population and setting: both passages kept, verified, and the option is disputed', () => {
    const a = sourceA(recommendA);
    const b = sourceB(againstB);
    const draft = build([a, b], { care_setting: 'outpatient' });
    const conflict = draft.conflicts[0];
    expect(conflict).toMatchObject({ generic_name: 'Amoxicillin', kind: 'same_context', blocking: true });
    const byStance = Object.fromEntries(conflict.sides.map((side) => [side.stance, side]));
    expect(byStance.recommends.citation).toMatchObject({ chunk_id: 'a1', source_title: 'Synthetic Guideline A (2025)', source_year: 2025, source_version: 1 });
    expect(byStance.advises_against.citation).toMatchObject({ chunk_id: 'b1', source_year: 2026 });
    expect(verifyQuoteInChunk(byStance.recommends.citation.quote, a.text)).toBe(true);
    expect(verifyQuoteInChunk(byStance.advises_against.citation.quote, b.text)).toBe(true);
    expect(byStance.recommends.fit.matches).toContainEqual({ dimension: 'population', value: 'adults', patient: '45' });
    expect(byStance.recommends.summary).toBe('Recommends Amoxicillin for adults, outpatient care.');
    expect(draft.options.find((o) => o.generic_name === 'Amoxicillin')?.dispute).toEqual({ key: conflict.key, kind: 'same_context' });
    expect(draft.status).toBe('proposed');
  });

  it('different populations: only the matching passage applies and nothing is blocked', () => {
    const draft = build([sourceA(recommendA), sourceB('In children with community-acquired pneumonia, Amoxicillin should not be used.')], { care_setting: 'outpatient' });
    expect(draft.conflicts[0]).toMatchObject({ kind: 'different_context', blocking: false, applicable_stance: 'recommends' });
    expect(draft.options.find((o) => o.generic_name === 'Amoxicillin')?.dispute).toBeNull();
  });

  it('different populations with the care setting not recorded: still not blocked when only one side can apply', () => {
    const draft = build([sourceA(recommendA), sourceB('In children with community-acquired pneumonia, Amoxicillin should not be used.')]);
    expect(draft.conflicts[0]).toMatchObject({ kind: 'different_context', blocking: false, applicable_stance: 'recommends' });
    expect(draft.conflicts[0].needs).toContain('care_setting');
  });

  it('different settings with no care setting recorded: needs information and blocks', () => {
    const inpatient = sourceB('For hospitalized adults with community-acquired pneumonia, Amoxicillin should not be used.');
    const unknown = build([sourceA(recommendA), inpatient]);
    expect(unknown.conflicts[0]).toMatchObject({ kind: 'needs_information', blocking: true });
    expect(unknown.conflicts[0].needs).toContain('care_setting');
    const recorded = build([sourceA(recommendA), inpatient], { care_setting: 'outpatient' });
    expect(recorded.conflicts[0]).toMatchObject({ kind: 'different_context', blocking: false, applicable_stance: 'recommends' });
    const admitted = build([sourceA(recommendA), inpatient], { care_setting: 'inpatient' });
    expect(admitted.options.find((o) => o.generic_name === 'Amoxicillin')).toBeUndefined();
    expect(admitted.excluded.map((entry) => entry.generic_name)).toContain('Amoxicillin');
  });

  it('a single applicable source is not a conflict', () => {
    const draft = build([sourceA(recommendA)], { care_setting: 'outpatient' });
    expect(draft.conflicts).toEqual([]);
    expect(draft.options[0].dispute).toBeNull();
  });

  it('the conflict key changes when a quote changes, so an old review cannot be reused', () => {
    const one = build([sourceA(recommendA), sourceB(againstB)], { care_setting: 'outpatient' }).conflicts[0].key;
    const altered = build([sourceA(recommendA), sourceB(againstB.replace('first-line therapy', 'initial therapy'))], { care_setting: 'outpatient' }).conflicts[0].key;
    expect(altered).not.toBe(one);
  });

  it('keeps every medication safety stop on a disputed option', () => {
    const draft = build([sourceA(recommendA), sourceB(againstB)], { care_setting: 'outpatient', allergies: ['Penicillin (anaphylaxis)'] });
    const option = draft.options.find((o) => o.generic_name === 'Amoxicillin');
    expect(option?.dispute?.kind).toBe('same_context');
    expect(option?.safety.status).toBe('blocked');
  });

  it('strips a leading PDF heading line from quotes while keeping verbatim chunk verification', () => {
    const metformin: DrugRecord = {
      id: '00000000-0000-4000-8000-000000000010',
      generic_name: 'Metformin',
      drug_class: 'Biguanide',
      indications: ['Type 2 Diabetes Mellitus'],
      dose_rules: { standard_adult: '500 mg twice daily', route: 'oral', frequency: 'Every 12 hours', duration_days: 30, max_daily_dose: '2000 mg' },
      contraindications: { conditions: [], allergies: [] },
      pregnancy_category: 'B',
      renal_adjustment: { egfr_threshold: 30, action: 'avoid', note: 'Avoid if eGFR < 30' },
    };
    const guidelineAChunkText = [
      'SYNTHETIC TEST DOCUMENT - NOT CLINICAL GUIDANCE',
      'SYNTHETIC TEST Guideline A - Type 2 Diabetes Initial Therapy (2025)',
      'SYNTHETIC TEST DOCUMENT. Invented for DocMate software testing. Not clinical guidance. Publisher: DocMate Test Fixtures. Publication year 2025. Version 1. Section 2: Initial drug therapy',
      'For adult outpatients with type 2 diabetes mellitus, Metformin is the recommended first-line therapy at diagnosis. Review glycaemic control after three months of therapy.',
    ].join('\n');
    const draft = buildTreatmentDraft({
      diagnosis: 'Type 2 Diabetes Mellitus',
      patient: patient({ care_setting: 'outpatient', egfr: 78 }),
      formulary: [metformin],
      interactions: [],
      chunks: [guideline('syn-a', guidelineAChunkText, 'SYNTHETIC TEST Guideline A - Type 2 Diabetes Initial Therapy (2025)', 'Initial drug therapy')],
      activeUrgentFindings: 0,
    });
    expect(draft.options).toHaveLength(1);
    expect(draft.options[0].citation.quote).toBe(
      'For adult outpatients with type 2 diabetes mellitus, Metformin is the recommended first-line therapy at diagnosis.',
    );
    expect(verifyQuoteInChunk(draft.options[0].citation.quote, guidelineAChunkText)).toBe(true);
  });
});
