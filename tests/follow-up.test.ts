import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { applyReconciliation, buildCarryItems, checkReconciliation, initialFollowUpInput, type PriorVisit, type Reconciliation } from '@/lib/follow-up';

// Synthetic visits only. No real patient data.
const visit1: PriorVisit = {
  id: '00000000-0000-4000-8000-0000000000a1',
  patientCode: 'P-FU-1',
  createdAt: new Date('2026-10-01T09:00:00Z'),
  structuredInput: {
    age: 52,
    gender: 'female',
    chief_complaint: 'Thirst',
    allergies: ['Sulfonamide rash'],
    current_medicines: ['Metformin 500 mg twice daily'],
    vitals: { blood_pressure_systolic: 150, blood_pressure_diastolic: 95 },
    weight_kg: 74,
    lab_values: [{ name: 'HbA1c', value: 7.9, unit: '%' }],
    past_medical_history: [],
  },
  confirmedDiagnosis: 'Type 2 diabetes mellitus',
  doctorName: 'Dr. Demo',
  approvedPlan: [],
  approvalNote: 'Review HbA1c in 3 months',
  openItems: ['Has the patient had an eye examination?'],
};

const decide = (overrides: Partial<Reconciliation> = {}): Reconciliation => ({
  decisions: [
    { id: 'allergy:sulfonamide-rash', action: 'confirm' },
    { id: 'medication:metformin-500-mg-twice-daily', action: 'changed', value: 'Metformin 1000 mg twice daily' },
  ],
  added_allergies: [],
  chief_complaint: 'Follow-up of diabetes',
  working_diagnosis: 'Type 2 diabetes mellitus',
  diagnosis_confirmed: true,
  today: { vitals: { blood_pressure_systolic: 138 }, labs: [] },
  ...overrides,
});

describe('carry-forward items', () => {
  const items = buildCarryItems(visit1, []);

  it('lists diagnosis, allergies, medicines, labs, measurements and the plan with date and source', () => {
    expect(items.map((item) => item.kind)).toEqual(['diagnosis', 'allergy', 'medication', 'lab', 'measurement', 'measurement', 'measurement', 'plan', 'open_item']);
    for (const item of items) {
      expect(item.source).toMatchObject({ case_id: visit1.id, patient_code: 'P-FU-1', visit_date: '2026-10-01T09:00:00.000Z', selected_visit: true });
    }
    expect(items.find((item) => item.kind === 'lab')).toMatchObject({ label: 'HbA1c', value: '7.9 %', source: { field: 'lab_values' } });
  });

  it('starts the new visit with no current clinical facts', () => {
    const input = initialFollowUpInput(visit1);
    expect(input).toMatchObject({ age: 52, gender: 'female', allergies: [], current_medicines: [], vitals: {}, lab_values: [], chief_complaint: '' });
  });

  it('collects allergies and medicines from earlier accessible visits, newest first, without duplicates', () => {
    const visit0: PriorVisit = { ...visit1, id: '00000000-0000-4000-8000-0000000000a0', createdAt: new Date('2026-06-01T09:00:00Z'), structuredInput: { allergies: ['Sulfonamide rash', 'Penicillin'], current_medicines: [] }, confirmedDiagnosis: null, approvalNote: null, openItems: [] };
    const merged = buildCarryItems(visit1, [visit0]);
    const allergies = merged.filter((item) => item.kind === 'allergy');
    expect(allergies.map((item) => [item.label, item.source.case_id])).toEqual([
      ['Sulfonamide rash', visit1.id],
      ['Penicillin', visit0.id],
    ]);
  });
});

describe('reconciliation', () => {
  const items = buildCarryItems(visit1, []);

  it('requires a decision on every allergy and medicine', () => {
    const errors = checkReconciliation(items, decide({ decisions: [{ id: 'allergy:sulfonamide-rash', action: 'confirm' }] }));
    expect(errors).toEqual([{ code: 'missing_decision', item_id: 'medication:metformin-500-mg-twice-daily' }]);
  });

  it('rejects a changed medicine without the new value and decisions that do not fit the item', () => {
    const errors = checkReconciliation(items, decide({
      decisions: [
        { id: 'allergy:sulfonamide-rash', action: 'continue' },
        { id: 'medication:metformin-500-mg-twice-daily', action: 'changed' },
        { id: 'medication:invented', action: 'continue' },
      ],
    }));
    expect(errors.map((error) => error.code).sort()).toEqual(['invalid_decision', 'missing_value', 'unknown_item']);
  });

  it('applies decisions; old measurements stay historical and only today’s values are current', () => {
    const { input, used, workingDiagnosis } = applyReconciliation(initialFollowUpInput(visit1), items, decide(), visit1.id);
    expect(input.current_medicines).toEqual(['Metformin 1000 mg twice daily']);
    expect(input.allergies).toEqual(['Sulfonamide rash']);
    expect(input.vitals).toEqual({ blood_pressure_systolic: 138 });
    expect(input.lab_values).toEqual([]);
    expect(input.weight_kg).toBeUndefined();
    expect(input.prior_visit?.historical).toContainEqual({ label: 'HbA1c', value: '7.9 %', visit_date: '2026-10-01T09:00:00.000Z', case_id: visit1.id });
    expect(workingDiagnosis).toBe('Type 2 diabetes mellitus');
    expect(used.find((use) => use.kind === 'medication')).toMatchObject({ decision: 'changed', label: 'Metformin 1000 mg twice daily', used_for: 'interaction_check' });
    expect(used.find((use) => use.kind === 'allergy')).toMatchObject({ decision: 'confirmed', used_for: 'allergy_check' });
    expect(used.find((use) => use.kind === 'diagnosis')).toMatchObject({ decision: 'confirmed_today', used_for: 'working_diagnosis' });
  });

  it('a stopped medicine and a removed allergy are not current', () => {
    const { input } = applyReconciliation(initialFollowUpInput(visit1), items, decide({
      decisions: [
        { id: 'allergy:sulfonamide-rash', action: 'remove' },
        { id: 'medication:metformin-500-mg-twice-daily', action: 'stopped' },
      ],
    }), visit1.id);
    expect(input.current_medicines).toEqual([]);
    expect(input.allergies).toEqual([]);
  });
});

// Ownership, consent, exclusion and repeat submission against the disposable database.
const dbUrl = process.env.DATABASE_URL ?? '';
describe.runIf(/docmate_(integration|judges|treatment|test|gaps)/.test(dbUrl))('follow-up access (database)', async () => {
  const { db } = await import('@/db');
  const schema = await import('@/db/schema');
  const { authorizePriorVisit, previewCarryForward, startFollowUp } = await import('@/lib/follow-up-server');
  const stamp = Date.now().toString(36);
  let doctorA = '';
  let doctorB = '';
  let profileId = '';
  let grantId = '';
  let visitA1 = '';
  let visitB0 = '';

  beforeAll(async () => {
    const [a] = await db.insert(schema.users).values({ email: `fu-a-${stamp}@test.local`, passwordHash: 'x', role: 'doctor', name: 'Dr. A (synthetic)' }).returning();
    const [b] = await db.insert(schema.users).values({ email: `fu-b-${stamp}@test.local`, passwordHash: 'x', role: 'doctor', name: 'Dr. B (synthetic)' }).returning();
    doctorA = a.id;
    doctorB = b.id;
    const [account] = await db.insert(schema.patientAccounts).values({ phone: `+88017${stamp.slice(-8).padStart(8, '0')}`, phoneNormalized: `+88017${stamp.slice(-8).padStart(8, '0')}` }).returning();
    const [profile] = await db.insert(schema.patientProfiles).values({ accountId: account.id, name: 'Synthetic FU', age: 52, gender: 'female' }).returning();
    profileId = profile.id;
    const [grant] = await db.insert(schema.accessGrants).values({ profileId, doctorId: doctorA, scope: 'this_doctor_only', status: 'active' }).returning();
    grantId = grant.id;
    const [b0] = await db
      .insert(schema.cases)
      .values({ doctorId: doctorB, profileId, patientCode: `P-FU-B0-${stamp}`, status: 'confirmed', structuredInput: { age: 52, gender: 'female', allergies: ['Hidden allergy'], current_medicines: ['Hidden medicine'], vitals: {}, lab_values: [] }, createdAt: new Date('2026-06-01T09:00:00Z') })
      .returning();
    const [a1] = await db
      .insert(schema.cases)
      .values({ doctorId: doctorA, profileId, patientCode: `P-FU-A1-${stamp}`, status: 'confirmed', confirmedDiagnosis: 'Type 2 diabetes mellitus', structuredInput: visit1.structuredInput, createdAt: new Date('2026-10-01T09:00:00Z') })
      .returning();
    visitB0 = b0.id;
    visitA1 = a1.id;
  });

  // Rows stay in the disposable database: deleting cases would break the audit hash chain.

  it('excludes another doctor’s visit without a full-history grant', async () => {
    const preview = await previewCarryForward(doctorA, visitA1);
    expect(preview?.history_excluded).toBe(true);
    expect(preview?.items.map((item) => item.label)).not.toContain('Hidden allergy');
    expect(preview?.items.some((item) => item.source.case_id === visitB0)).toBe(false);
  });

  it('refuses another doctor’s visit, and the doctor’s own visit once consent is revoked', async () => {
    expect(await authorizePriorVisit(doctorA, visitB0)).toBeNull();
    await db.update(schema.accessGrants).set({ status: 'revoked' }).where(eq(schema.accessGrants.id, grantId));
    expect(await authorizePriorVisit(doctorA, visitA1)).toBeNull();
    await db.update(schema.accessGrants).set({ status: 'active' }).where(eq(schema.accessGrants.id, grantId));
  });

  it('creates one follow-up for repeated and concurrent submissions, and leaves Visit 1 unchanged', async () => {
    const [before] = await db.select().from(schema.cases).where(eq(schema.cases.id, visitA1));
    const user = { id: doctorA, role: 'doctor' };
    const [first, second] = await Promise.all([startFollowUp(user, visitA1, 'key-one-aaaa'), startFollowUp(user, visitA1, 'key-one-aaaa')]);
    const again = await startFollowUp(user, visitA1, 'key-two-bbbb');
    expect(new Set([first?.caseId, second?.caseId, again?.caseId]).size).toBe(1);
    expect([first?.created, second?.created].filter(Boolean)).toHaveLength(1);
    const rows = await db.select().from(schema.caseFollowUps).where(eq(schema.caseFollowUps.previousCaseId, visitA1));
    expect(rows).toHaveLength(1);
    const [after] = await db.select().from(schema.cases).where(eq(schema.cases.id, visitA1));
    expect(after).toEqual(before);
  });
});
