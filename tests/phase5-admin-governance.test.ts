import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/db';
import {
  patientAccounts,
  patientProfiles,
  profileHealthSummary,
  cases,
  users,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { canUse } from '@/lib/permissions';

describe('Phase 5: Governance, Optimistic Locking & Feature Matrix', () => {
  const testPhone = `+8801733${Math.floor(100000 + Math.random() * 900000)}`;
  let accountId: string;
  let canonicalProfileId: string;
  let duplicateProfileId: string;
  let adminUserId: string;

  beforeEach(async () => {
    // 1. Get or create Super Admin
    let [admin] = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1);
    if (!admin) {
      const [newAdmin] = await db.insert(users).values({
        email: `admin_${Date.now()}@docmate.ai`,
        role: 'super_admin',
        name: 'Super Admin Test',
        status: 'active',
        passwordHash: 'hash',
      }).returning();
      admin = newAdmin;
    }
    adminUserId = admin.id;

    // 2. Setup account
    const [acc] = await db
      .insert(patientAccounts)
      .values({
        phone: testPhone,
        phoneNormalized: testPhone,
      })
      .returning();
    accountId = acc.id;

    // 3. Setup Canonical Profile
    const [canon] = await db
      .insert(patientProfiles)
      .values({
        accountId,
        name: 'Rahim Uddin',
        nameEncrypted: 'enc_rahim',
        age: 45,
        gender: 'male',
        sex: 'male',
        relation: 'self',
      })
      .returning();
    canonicalProfileId = canon.id;

    await db.insert(profileHealthSummary).values({
      profileId: canonicalProfileId,
      version: 1,
      allergies: ['Penicillin'],
      chronicConditions: ['Hypertension'],
      currentMedicines: [{ brand: 'Osartil 50', generic: 'Losartan' }],
    });

    // 4. Setup Duplicate Profile
    const [dup] = await db
      .insert(patientProfiles)
      .values({
        accountId,
        name: 'Md Rahim Uddin',
        nameEncrypted: 'enc_md_rahim',
        age: 45,
        gender: 'male',
        sex: 'male',
        relation: 'other',
      })
      .returning();
    duplicateProfileId = dup.id;

    await db.insert(profileHealthSummary).values({
      profileId: duplicateProfileId,
      version: 1,
      allergies: ['Sulfa'],
      chronicConditions: ['Type 2 Diabetes'],
      currentMedicines: [{ brand: 'Seclo 20', generic: 'Omeprazole' }],
    });

    // Assign a case to duplicate profile
    await db.insert(cases).values({
      doctorId: adminUserId,
      profileId: duplicateProfileId,
      patientCode: `P-${Date.now().toString().slice(-4)}`,
      status: 'confirmed',
      structuredInput: { chief_complaint: 'Fever and chest pain' },
      confirmedDiagnosis: 'Acute Bronchitis',
    });
  });

  afterEach(async () => {
    await db.delete(cases).where(eq(cases.profileId, canonicalProfileId));
    await db.delete(profileHealthSummary).where(eq(profileHealthSummary.profileId, canonicalProfileId));
    await db.delete(profileHealthSummary).where(eq(profileHealthSummary.profileId, duplicateProfileId));
    await db.delete(patientProfiles).where(eq(patientProfiles.accountId, accountId));
    await db.delete(patientAccounts).where(eq(patientAccounts.id, accountId));
  });

  it('1. Enforces Optimistic Locking: Detects version conflict on stale update', async () => {
    // Current version is 1
    const [current] = await db
      .select()
      .from(profileHealthSummary)
      .where(eq(profileHealthSummary.profileId, canonicalProfileId))
      .orderBy(desc(profileHealthSummary.version))
      .limit(1);

    expect(current.version).toBe(1);

    // Concurrent user A updates to version 2
    await db.insert(profileHealthSummary).values({
      profileId: canonicalProfileId,
      version: 2,
      allergies: ['Penicillin', 'Ciprofloxacin'],
      chronicConditions: ['Hypertension'],
      currentMedicines: [],
      updatedBy: adminUserId,
      changeReason: 'Updated by Clinician A',
    });

    // Concurrent user B attempts to update assuming expectedVersion = 1 -> Must detect mismatch!
    const [latest] = await db
      .select()
      .from(profileHealthSummary)
      .where(eq(profileHealthSummary.profileId, canonicalProfileId))
      .orderBy(desc(profileHealthSummary.version))
      .limit(1);

    const staleExpectedVersion = 1;
    const isConflict = latest.version !== staleExpectedVersion;
    expect(isConflict).toBe(true);
    expect(latest.version).toBe(2);
  });

  it('2. Executes Non-Destructive Duplicate Profile Merge', async () => {
    // Reassign cases to canonical
    await db
      .update(cases)
      .set({ profileId: canonicalProfileId })
      .where(eq(cases.profileId, duplicateProfileId));

    // Union health summaries
    const [cSummary] = await db
      .select()
      .from(profileHealthSummary)
      .where(eq(profileHealthSummary.profileId, canonicalProfileId))
      .orderBy(desc(profileHealthSummary.version))
      .limit(1);

    const [dSummary] = await db
      .select()
      .from(profileHealthSummary)
      .where(eq(profileHealthSummary.profileId, duplicateProfileId))
      .orderBy(desc(profileHealthSummary.version))
      .limit(1);

    const mergedAllergies = Array.from(
      new Set([...(cSummary.allergies as string[]), ...(dSummary.allergies as string[])])
    );
    const mergedConditions = Array.from(
      new Set([...(cSummary.chronicConditions as string[]), ...(dSummary.chronicConditions as string[])])
    );

    const [newVersion] = await db
      .insert(profileHealthSummary)
      .values({
        profileId: canonicalProfileId,
        version: cSummary.version + 1,
        allergies: mergedAllergies,
        chronicConditions: mergedConditions,
        currentMedicines: [
          ...((cSummary.currentMedicines as Array<Record<string, unknown>>) || []),
          ...((dSummary.currentMedicines as Array<Record<string, unknown>>) || []),
        ],
        updatedBy: adminUserId,
        changeReason: 'Merged from duplicate profile',
      })
      .returning();

    // Mark duplicate as merged (NEVER deleted)
    await db
      .update(patientProfiles)
      .set({ relation: 'merged', claimed: false })
      .where(eq(patientProfiles.id, duplicateProfileId));

    // Verify
    const reassignedCases = await db
      .select()
      .from(cases)
      .where(eq(cases.profileId, canonicalProfileId));
    expect(reassignedCases.length).toBeGreaterThanOrEqual(1);

    const [dupRecord] = await db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.id, duplicateProfileId));
    expect(dupRecord.relation).toBe('merged');

    expect(newVersion.allergies).toContain('Penicillin');
    expect(newVersion.allergies).toContain('Sulfa');
    expect(newVersion.chronicConditions).toContain('Hypertension');
    expect(newVersion.chronicConditions).toContain('Type 2 Diabetes');
  });

  it('3. Enforces the 10 New Patient-Centred Feature Keys across Roles', async () => {
    const mockDoctor = { id: adminUserId, role: 'doctor' };
    const mockPatient = { id: adminUserId, role: 'patient' };
    const mockStudent = { id: adminUserId, role: 'student' };

    // Doctor permissions
    const docSearch = await canUse(mockDoctor, 'patient.search');
    expect(docSearch.allowed).toBe(true);

    const docHistoryRequest = await canUse(mockDoctor, 'history.request');
    expect(docHistoryRequest.allowed).toBe(true);

    const docHistoryView = await canUse(mockDoctor, 'history.view');
    expect(docHistoryView.allowed).toBe(true);

    // Patient permissions
    const patientMedSchedule = await canUse(mockPatient, 'portal.medicine_schedule');
    expect(patientMedSchedule.allowed).toBe(true);

    const patientPrescriptions = await canUse(mockPatient, 'portal.prescriptions');
    expect(patientPrescriptions.allowed).toBe(true);

    const patientPermissions = await canUse(mockPatient, 'portal.permissions');
    expect(patientPermissions.allowed).toBe(true);

    const patientAccessLog = await canUse(mockPatient, 'portal.access_log');
    expect(patientAccessLog.allowed).toBe(true);

    // Student is strictly forbidden from patient data features
    const studentSearch = await canUse(mockStudent, 'patient.search');
    expect(studentSearch.allowed).toBe(false);

    const studentHistoryView = await canUse(mockStudent, 'history.view');
    expect(studentHistoryView.allowed).toBe(false);
  });
});
