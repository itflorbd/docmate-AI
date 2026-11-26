import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { buildCarryItems, type PriorVisit } from '@/lib/follow-up';

describe('Task 4: Linked prescriptions in follow-up carry-forward (unit)', () => {
  it('carries forward items from linked prescriptions with source.field = "prescription"', () => {
    const visit: PriorVisit = {
      id: 'case-1',
      patientCode: 'P-RX-1',
      createdAt: new Date('2026-10-01T09:00:00Z'),
      structuredInput: { age: 52, gender: 'male', vitals: {}, lab_values: [] },
      confirmedDiagnosis: 'Type 2 diabetes mellitus',
      doctorName: 'Dr. Demo',
      approvedPlan: [],
      prescribedItems: [
        { generic_name: 'Metformin', strength: '500 mg', dosing_schedule: '1+0+1', duration_days: 30 },
      ],
      approvalNote: null,
      openItems: [],
    };
    const items = buildCarryItems(visit, []);
    const med = items.find((item) => item.kind === 'medication');
    expect(med).toBeDefined();
    expect(med?.label).toBe('Metformin 500 mg');
    expect(med?.value).toBe('1+0+1, 30 days');
    expect(med?.source.field).toBe('prescription');
  });
});

const dbUrl = process.env.DATABASE_URL ?? '';
describe.runIf(/docmate_(integration|judges|treatment|test|gaps)/.test(dbUrl))('Task 4: Linked vs unlinked vs inaccessible prescriptions (database)', async () => {
  const { db } = await import('@/db');
  const schema = await import('@/db/schema');
  const { previewCarryForward } = await import('@/lib/follow-up-server');
  const stamp = `${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  let doctorA = '';
  let doctorB = '';
  let profileId = '';
  let grantId = '';
  let visitA1 = '';
  let visitB0 = '';

  beforeAll(async () => {
    const [a] = await db.insert(schema.users).values({ email: `rx-a-${stamp}@test.local`, passwordHash: 'x', role: 'doctor', name: 'Dr. Rx A' }).returning();
    const [b] = await db.insert(schema.users).values({ email: `rx-b-${stamp}@test.local`, passwordHash: 'x', role: 'doctor', name: 'Dr. Rx B' }).returning();
    doctorA = a.id;
    doctorB = b.id;

    const phoneDigits = String(Date.now()).slice(-8);
    const [account] = await db.insert(schema.patientAccounts).values({ phone: `+88018${phoneDigits}`, phoneNormalized: `+88018${phoneDigits}` }).returning();
    const [profile] = await db.insert(schema.patientProfiles).values({ accountId: account.id, name: 'Synthetic Rx Patient', age: 54, gender: 'male' }).returning();
    profileId = profile.id;

    const [patientRow] = await db
      .insert(schema.patients)
      .values({
        doctorId: doctorA,
        patientCode: `P-RX-${stamp}`,
        nameEncrypted: 'Synthetic Rx Patient',
        age: 54,
        gender: 'male',
      })
      .returning();

    const [grant] = await db.insert(schema.accessGrants).values({ profileId, doctorId: doctorA, scope: 'this_doctor_only', status: 'active' }).returning();
    grantId = grant.id;

    const [b0] = await db
      .insert(schema.cases)
      .values({
        doctorId: doctorB,
        profileId,
        patientCode: `P-RX-B0-${stamp}`,
        status: 'confirmed',
        structuredInput: { age: 54, gender: 'male', vitals: {}, lab_values: [] },
        createdAt: new Date('2026-06-01T09:00:00Z'),
      })
      .returning();
    const [a1] = await db
      .insert(schema.cases)
      .values({
        doctorId: doctorA,
        profileId,
        patientCode: `P-RX-A1-${stamp}`,
        status: 'confirmed',
        confirmedDiagnosis: 'Type 2 diabetes mellitus',
        structuredInput: { age: 54, gender: 'male', vitals: {}, lab_values: [] },
        createdAt: new Date('2026-10-01T09:00:00Z'),
      })
      .returning();
    visitB0 = b0.id;
    visitA1 = a1.id;

    // 1. Prescription linked to Doctor A's visit (should carry forward)
    const [rxLinked] = await db
      .insert(schema.prescriptions)
      .values({
        patientId: patientRow.id,
        profileId,
        caseId: visitA1,
        doctorId: doctorA,
        rxNumber: `RX-L-${stamp}`,
        diagnosis: 'Type 2 diabetes mellitus',
        investigations: [],
        status: 'draft',
        qrHash: crypto.createHash('sha256').update(`L-${stamp}`).digest('hex'),
      })
      .returning();
    await db.insert(schema.prescriptionItems).values({
      prescriptionId: rxLinked.id,
      brandName: 'Comet',
      genericName: 'Metformin',
      strength: '500 mg',
      dosingSchedule: '1+0+1',
      durationDays: 30,
    });

    // 2. Unlinked prescription (case_id IS NULL) for the same patient (must NOT be guessed or carried forward)
    const [rxUnlinked] = await db
      .insert(schema.prescriptions)
      .values({
        patientId: patientRow.id,
        profileId,
        caseId: null,
        doctorId: doctorA,
        rxNumber: `RX-U-${stamp}`,
        diagnosis: 'Unlinked visit',
        investigations: [],
        status: 'draft',
        qrHash: crypto.createHash('sha256').update(`U-${stamp}`).digest('hex'),
      })
      .returning();
    await db.insert(schema.prescriptionItems).values({
      prescriptionId: rxUnlinked.id,
      brandName: 'UnlinkedBrand',
      genericName: 'UnlinkedDrug',
      strength: '10 mg',
      dosingSchedule: '0+0+1',
      durationDays: 14,
    });

    // 3. Prescription linked to Doctor B's inaccessible visit (must be excluded under this_doctor_only)
    const [rxOther] = await db
      .insert(schema.prescriptions)
      .values({
        patientId: patientRow.id,
        profileId,
        caseId: visitB0,
        doctorId: doctorB,
        rxNumber: `RX-B-${stamp}`,
        diagnosis: 'Other doctor visit',
        investigations: [],
        status: 'draft',
        qrHash: crypto.createHash('sha256').update(`B-${stamp}`).digest('hex'),
      })
      .returning();
    await db.insert(schema.prescriptionItems).values({
      prescriptionId: rxOther.id,
      brandName: 'SecretBrand',
      genericName: 'SecretMed',
      strength: '25 mg',
      dosingSchedule: '1+0+0',
      durationDays: 7,
    });
  });

  // Rows stay in the disposable database: never delete cases or edit audit_logs.

  it('carries forward linked prescription items, ignores unlinked prescriptions, and excludes another doctor’s prescription without full_history', async () => {
    const preview = await previewCarryForward(doctorA, visitA1);
    expect(preview).not.toBeNull();
    expect(preview?.history_excluded).toBe(true);

    const medItems = (preview?.items ?? []).filter((item) => item.kind === 'medication');
    expect(medItems).toHaveLength(1);
    expect(medItems[0]).toMatchObject({
      label: 'Metformin 500 mg',
      source: { case_id: visitA1, field: 'prescription' },
    });
    expect(medItems.some((m) => m.label.includes('UnlinkedDrug'))).toBe(false);
    expect(medItems.some((m) => m.label.includes('SecretMed'))).toBe(false);
  });

  it('includes another doctor’s linked prescription when granted full_history', async () => {
    await db.update(schema.accessGrants).set({ scope: 'full_history' }).where(eq(schema.accessGrants.id, grantId));
    const preview = await previewCarryForward(doctorA, visitA1);
    expect(preview?.history_excluded).toBe(false);

    const medItems = (preview?.items ?? []).filter((item) => item.kind === 'medication');
    expect(medItems.some((m) => m.label === 'Metformin 500 mg' && m.source.field === 'prescription')).toBe(true);
    expect(medItems.some((m) => m.label === 'SecretMed 25 mg' && m.source.case_id === visitB0 && m.source.field === 'prescription')).toBe(true);
    expect(medItems.some((m) => m.label.includes('UnlinkedDrug'))).toBe(false);
  });
});
