import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db';
import { patientAccounts, patientProfiles, accessGrants, patientConsentLogs, accessLogs, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorizePatientProfileAccess } from '@/lib/patient-authorization';
import { User } from '@/types';

describe('Consent Revocation Transaction & Ownership Tests', () => {
  const ts = Date.now().toString().slice(-6);
  const patientPhone = `+880173${ts}`;
  const otherPhone = `+880174${ts}`;
  const doctorEmail = `synth.dr.rev.${ts}@docmate.app`;

  let accountId: string;
  let otherAccountId: string;
  let profileId: string;
  let otherProfileId: string;
  let doctorUserId: string;
  let grantId: string;

  let patientUser: User;
  let otherPatientUser: User;
  let doctorUser: User;

  beforeAll(async () => {
    // 1. Doctor user
    const [doc] = await db.insert(users).values({
      email: doctorEmail,
      passwordHash: 'dummyhash',
      name: 'Dr. Test Revocation',
      role: 'doctor',
      status: 'active',
    }).returning();
    doctorUserId = doc.id;

    doctorUser = {
      id: doctorUserId,
      email: doctorEmail,
      role: 'doctor',
      name: 'Dr. Test Revocation',
      status: 'active',
      mfa_enabled: false,
      created_at: new Date().toISOString(),
    };

    // 2. Patient A
    const [acc] = await db.insert(patientAccounts).values({
      phone: patientPhone,
      phoneNormalized: patientPhone,
    }).returning();
    accountId = acc.id;

    const [prof] = await db.insert(patientProfiles).values({
      accountId: accountId,
      relation: 'self',
      name: 'Patient Owner Self',
      age: 29,
      gender: 'male',
    }).returning();
    profileId = prof.id;

    // 2. Patient A User & Account
    const [patientRow] = await db.insert(users).values({
      email: `synth.patient.${ts}@example.com`,
      passwordHash: 'dummyhash',
      name: 'Patient Owner',
      role: 'patient',
      phone: patientPhone,
      status: 'active',
    }).returning();

    patientUser = {
      id: patientRow.id,
      email: patientRow.email,
      role: 'patient',
      name: 'Patient Owner',
      status: 'active',
      phone: patientPhone,
      mfa_enabled: false,
      created_at: new Date().toISOString(),
    };

    // 3. Other Patient B
    const [otherAcc] = await db.insert(patientAccounts).values({
      phone: otherPhone,
      phoneNormalized: otherPhone,
    }).returning();
    otherAccountId = otherAcc.id;

    const [otherProf] = await db.insert(patientProfiles).values({
      accountId: otherAccountId,
      relation: 'self',
      name: 'Patient Other Self',
      age: 40,
      gender: 'female',
    }).returning();
    otherProfileId = otherProf.id;

    otherPatientUser = {
      id: crypto.randomUUID(),
      email: 'synth.other@example.com',
      role: 'patient',
      name: 'Patient Other',
      status: 'active',
      phone: otherPhone,
      mfa_enabled: false,
      created_at: new Date().toISOString(),
    };

    // 4. Initial active grant
    const [grant] = await db.insert(accessGrants).values({
      profileId,
      doctorId: doctorUserId,
      scope: 'this_doctor_only',
      status: 'active',
    }).returning();
    grantId = grant.id;
  });

  afterAll(async () => {
    if (grantId) await db.delete(accessGrants).where(eq(accessGrants.id, grantId));
    if (profileId) await db.delete(patientProfiles).where(eq(patientProfiles.id, profileId));
    if (otherProfileId) await db.delete(patientProfiles).where(eq(patientProfiles.id, otherProfileId));
    if (accountId) await db.delete(patientAccounts).where(eq(patientAccounts.id, accountId));
    if (otherAccountId) await db.delete(patientAccounts).where(eq(patientAccounts.id, otherAccountId));
    if (doctorUserId) await db.delete(users).where(eq(users.id, doctorUserId));
    if (patientUser?.id) await db.delete(users).where(eq(users.id, patientUser.id));
  });

  it('1. Other patient CANNOT revoke a grant they do not own (forbidden 403)', async () => {
    const auth = await authorizePatientProfileAccess(otherPatientUser, profileId, 'write');
    expect(auth.authorized).toBe(false);
    expect(auth.status).toBe(403);
  });

  it('2. Audit write failure in transaction rolls back grant update', async () => {
    // Verify grant is currently active
    const [grantBefore] = await db.select().from(accessGrants).where(eq(accessGrants.id, grantId));
    expect(grantBefore.status).toBe('active');

    // Simulate atomic transaction where audit log write fails
    let rolledBack = false;
    try {
      await db.transaction(async (tx) => {
        // Step A: Update grant
        await tx
          .update(accessGrants)
          .set({ status: 'revoked', revokedAt: new Date() })
          .where(eq(accessGrants.id, grantId));

        // Step B: Write consent log
        await tx.insert(patientConsentLogs).values({
          profileId,
          action: 'revoked',
          reason: 'Test revocation',
        });

        // Step C: Simulated failure in audit logging
        throw new Error('SIMULATED_AUDIT_WRITE_FAILURE');
      });
    } catch (err: unknown) {
      if ((err as Error).message === 'SIMULATED_AUDIT_WRITE_FAILURE') {
        rolledBack = true;
      }
    }

    expect(rolledBack).toBe(true);

    // Verify grant status did NOT stay 'revoked' (rolled back to 'active')
    const [grantAfter] = await db.select().from(accessGrants).where(eq(accessGrants.id, grantId));
    expect(grantAfter.status).toBe('active');
    expect(grantAfter.revokedAt).toBeNull();
  });

  it('3. Successful atomic revocation: updates grant AND writes consent + access audit logs', async () => {
    // Execute atomic transaction matching the route
    await db.transaction(async (tx) => {
      await tx
        .update(accessGrants)
        .set({ status: 'revoked', revokedAt: new Date() })
        .where(eq(accessGrants.id, grantId));

      await tx.insert(patientConsentLogs).values({
        profileId,
        action: 'revoked',
        reason: 'Patient revoked access via Patient Portal test',
      });

      await tx.insert(accessLogs).values({
        userId: patientUser.id,
        profileId,
        userRole: patientUser.role,
        action: 'grant_revoked',
        recordType: 'access_grant',
        recordId: grantId,
        reason: 'Patient explicitly revoked clinical data sharing grant',
      });
    });

    // 1. Verify grant is revoked
    const [grant] = await db.select().from(accessGrants).where(eq(accessGrants.id, grantId));
    expect(grant.status).toBe('revoked');
    expect(grant.revokedAt).not.toBeNull();

    // 2. Verify doctor access is now DENIED
    const doctorAuth = await authorizePatientProfileAccess(doctorUser, profileId, 'read');
    expect(doctorAuth.authorized).toBe(false);
    expect(doctorAuth.status).toBe(403);

    // 3. Verify consent log was written
    const consentLogs = await db
      .select()
      .from(patientConsentLogs)
      .where(and(eq(patientConsentLogs.profileId, profileId), eq(patientConsentLogs.action, 'revoked')));
    expect(consentLogs.length).toBeGreaterThanOrEqual(1);

    // 4. Verify access log was written
    const accLogs = await db
      .select()
      .from(accessLogs)
      .where(and(eq(accessLogs.profileId, profileId), eq(accessLogs.action, 'grant_revoked')));
    expect(accLogs.length).toBeGreaterThanOrEqual(1);
  });
});
