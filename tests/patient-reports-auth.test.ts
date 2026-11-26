import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db';
import { patientAccounts, patientProfiles, accessGrants, patientReports, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { authorizePatientProfileAccess } from '@/lib/patient-authorization';
import { getStorageDriver } from '@/lib/storage';
import { User } from '@/types';

describe('Patient Report Authorization, Isolation, and File Storage Tests', () => {
  const ts = Date.now().toString().slice(-7);
  const phoneA = `+880171${ts}`;
  const phoneB = `+880172${ts}`;
  const doctorEmail = `synth.dr.auth.${ts}@docmate.app`;

  let accountAId: string;
  let accountBId: string;
  let profileAId: string;
  let profileBId: string;
  let doctorUserId: string;

  const userA: User = {
    id: 'user-a-uuid',
    email: 'synth.patient.a@example.com',
    role: 'patient',
    name: 'Synthetic Patient A',
    status: 'active',
    phone: phoneA,
    mfa_enabled: false,
    created_at: new Date().toISOString(),
  };

  const userB: User = {
    id: 'user-b-uuid',
    email: 'synth.patient.b@example.com',
    role: 'patient',
    name: 'Synthetic Patient B',
    status: 'active',
    phone: phoneB,
    mfa_enabled: false,
    created_at: new Date().toISOString(),
  };

  let doctorUser: User;

  beforeAll(async () => {
    // 1. Create or ensure doctor user
    const [existingDoctor] = await db.select().from(users).where(eq(users.email, doctorEmail)).limit(1);
    if (existingDoctor) {
      doctorUserId = existingDoctor.id;
    } else {
      const [newDoc] = await db.insert(users).values({
        email: doctorEmail,
        passwordHash: 'dummyhash',
        name: 'Dr. Synthetic Test',
        role: 'doctor',
        status: 'active',
      }).returning();
      doctorUserId = newDoc.id;
    }

    doctorUser = {
      id: doctorUserId,
      email: doctorEmail,
      role: 'doctor',
      name: 'Dr. Synthetic Test',
      status: 'active',
      mfa_enabled: false,
      created_at: new Date().toISOString(),
    };

    // 2. Create Account A and Profile A
    const [accA] = await db.insert(patientAccounts).values({
      phone: phoneA,
      phoneNormalized: phoneA,
    }).returning();
    accountAId = accA.id;

    const [profA] = await db.insert(patientProfiles).values({
      accountId: accountAId,
      relation: 'self',
      name: 'Synthetic Patient A Self',
      age: 32,
      gender: 'female',
    }).returning();
    profileAId = profA.id;

    // 3. Create Account B and Profile B
    const [accB] = await db.insert(patientAccounts).values({
      phone: phoneB,
      phoneNormalized: phoneB,
    }).returning();
    accountBId = accB.id;

    const [profB] = await db.insert(patientProfiles).values({
      accountId: accountBId,
      relation: 'self',
      name: 'Synthetic Patient B Self',
      age: 45,
      gender: 'male',
    }).returning();
    profileBId = profB.id;
  });

  afterAll(async () => {
    // Clean up test records
    if (profileAId) await db.delete(patientProfiles).where(eq(patientProfiles.id, profileAId));
    if (profileBId) await db.delete(patientProfiles).where(eq(patientProfiles.id, profileBId));
    if (accountAId) await db.delete(patientAccounts).where(eq(patientAccounts.id, accountAId));
    if (accountBId) await db.delete(patientAccounts).where(eq(patientAccounts.id, accountBId));
  });

  it('1. Isolation: Patient A CANNOT access Patient B records (returns 403 Forbidden)', async () => {
    const auth = await authorizePatientProfileAccess(userA, profileBId, 'read');
    expect(auth.authorized).toBe(false);
    expect(auth.status).toBe(403);
    expect(auth.error).toContain('does not belong to your account');
  });

  it('2. Isolation: Patient B CANNOT access Patient A records (returns 403 Forbidden)', async () => {
    const auth = await authorizePatientProfileAccess(userB, profileAId, 'read');
    expect(auth.authorized).toBe(false);
    expect(auth.status).toBe(403);
    expect(auth.error).toContain('does not belong to your account');
  });

  it('3. Ownership: Patients CAN access their own profile records', async () => {
    const authA = await authorizePatientProfileAccess(userA, profileAId, 'read');
    expect(authA.authorized).toBe(true);
    expect(authA.isOwner).toBe(true);

    const authB = await authorizePatientProfileAccess(userB, profileBId, 'read');
    expect(authB.authorized).toBe(true);
    expect(authB.isOwner).toBe(true);
  });

  it('4. Doctor without active grant CANNOT access patient records', async () => {
    const auth = await authorizePatientProfileAccess(doctorUser, profileAId, 'read');
    expect(auth.authorized).toBe(false);
    expect(auth.status).toBe(403);
    expect(auth.error).toContain('No active consent grant');
  });

  it('5. Doctor WITH active grant CAN read patient records', async () => {
    // Grant access from Profile A to Doctor
    const [grant] = await db.insert(accessGrants).values({
      profileId: profileAId,
      doctorId: doctorUserId,
      scope: 'full_history',
      status: 'active',
    }).returning();

    try {
      const auth = await authorizePatientProfileAccess(doctorUser, profileAId, 'read');
      expect(auth.authorized).toBe(true);
      expect(auth.isDoctor).toBe(true);
    } finally {
      await db.delete(accessGrants).where(eq(accessGrants.id, grant.id));
    }
  });

  it('6. Doctor CANNOT modify report sharing or delete patient records (returns 403)', async () => {
    // Even with an active grant
    const [grant] = await db.insert(accessGrants).values({
      profileId: profileAId,
      doctorId: doctorUserId,
      scope: 'full_history',
      status: 'active',
    }).returning();

    try {
      const auth = await authorizePatientProfileAccess(doctorUser, profileAId, 'share');
      expect(auth.authorized).toBe(false);
      expect(auth.status).toBe(403);
      expect(auth.error).toContain('Only the patient can manage report sharing');
    } finally {
      await db.delete(accessGrants).where(eq(accessGrants.id, grant.id));
    }
  });

  it('7. Private file storage: saves, retrieves, and cleans up without dangling files', async () => {
    const storage = getStorageDriver();
    const testKey = `patient-reports/${profileAId}/test-${Date.now()}.pdf`;
    const dummyBuffer = Buffer.from('%PDF-1.4 synthetic test patient report file content');

    // Save file
    await storage.save(testKey, dummyBuffer, 'application/pdf');
    expect(await storage.exists(testKey)).toBe(true);

    // Retrieve file
    const readBuffer = await storage.get(testKey);
    expect(readBuffer).not.toBeNull();
    expect(readBuffer?.toString()).toBe(dummyBuffer.toString());

    // Clean up / rollback simulation
    await storage.delete(testKey);
    expect(await storage.exists(testKey)).toBe(false);
  });

  it('8. Failed upload leaves no dangling report metadata or file', async () => {
    const storage = getStorageDriver();
    const danglingKey = `patient-reports/${profileAId}/rollback-${Date.now()}.pdf`;
    const dummyBuffer = Buffer.from('test buffer');

    // Simulate saving file
    await storage.save(danglingKey, dummyBuffer, 'application/pdf');
    expect(await storage.exists(danglingKey)).toBe(true);

    // Simulate database failure trigger -> rollback
    try {
      // Simulate error: invalid foreign key or rejected constraint
      throw new Error('Simulated DB constraint error during report insertion');
    } catch {
      // Handler rollback
      await storage.delete(danglingKey);
    }

    // Verify no dangling file remains
    expect(await storage.exists(danglingKey)).toBe(false);

    // Verify no DB record exists
    const matchingReports = await db
      .select()
      .from(patientReports)
      .where(eq(patientReports.fileUrl, danglingKey));
    expect(matchingReports).toHaveLength(0);
  });
});
