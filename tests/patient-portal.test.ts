import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/db';
import {
  patientAccounts,
  patientProfiles,
  profileHealthSummary,
  medicineIntakeLogs,
  accessGrants,
  users,
} from '@/db/schema';
import { eq } from 'drizzle-orm';

describe('Phase 4: Upgraded Patient Portal & Multi-Profile Model', () => {
  const testPhone = `+8801755${Math.floor(100000 + Math.random() * 900000)}`;
  let testAccountId: string;
  let selfProfileId: string;
  let childProfileId: string;

  beforeEach(async () => {
    // 1. Setup account
    const [acc] = await db
      .insert(patientAccounts)
      .values({
        phone: testPhone,
        phoneNormalized: testPhone,
      })
      .returning();
    testAccountId = acc.id;

    // 2. Setup Self Profile
    const [selfProf] = await db
      .insert(patientProfiles)
      .values({
        accountId: testAccountId,
        name: 'Portal Test User',
        nameEncrypted: 'enc_name',
        age: 36,
        gender: 'male',
        sex: 'male',
        relation: 'self',
        claimed: true,
      })
      .returning();
    selfProfileId = selfProf.id;

    await db.insert(profileHealthSummary).values({
      profileId: selfProfileId,
      version: 1,
      allergies: ['Penicillin'],
      chronicConditions: ['Hypertension'],
      currentMedicines: [{ brand: 'Osartil 50', generic: 'Losartan potassium', dose: '50mg' }],
      bloodGroup: 'B+',
    });

    // 3. Setup Child Profile
    const [childProf] = await db
      .insert(patientProfiles)
      .values({
        accountId: testAccountId,
        name: 'Portal Test Child',
        nameEncrypted: 'enc_child',
        age: 6,
        gender: 'male',
        sex: 'male',
        relation: 'child',
        claimed: true,
      })
      .returning();
    childProfileId = childProf.id;
  });

  afterEach(async () => {
    await db.delete(medicineIntakeLogs).where(eq(medicineIntakeLogs.profileId, selfProfileId));
    await db.delete(accessGrants).where(eq(accessGrants.profileId, selfProfileId));
    await db.delete(profileHealthSummary).where(eq(profileHealthSummary.profileId, selfProfileId));
    await db.delete(patientProfiles).where(eq(patientProfiles.accountId, testAccountId));
    await db.delete(patientAccounts).where(eq(patientAccounts.id, testAccountId));
  });

  it('1. Successfully manages multi-profile family accounts', async () => {
    const profiles = await db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.accountId, testAccountId));

    expect(profiles.length).toBe(2);
    const self = profiles.find((p) => p.relation === 'self');
    const child = profiles.find((p) => p.relation === 'child');

    expect(self).toBeDefined();
    expect(self?.name).toBe('Portal Test User');
    expect(child).toBeDefined();
    expect(child?.id).toBe(childProfileId);
    expect(child?.name).toBe('Portal Test Child');
  });

  it('2. Records medicine intake event with timestamp and slot', async () => {
    const [intake] = await db
      .insert(medicineIntakeLogs)
      .values({
        profileId: selfProfileId,
        slot: 'morning',
        takenAt: new Date(),
      })
      .returning();

    expect(intake).toBeDefined();
    expect(intake.profileId).toBe(selfProfileId);
    expect(intake.slot).toBe('morning');
    expect(intake.takenAt).toBeInstanceOf(Date);
  });

  it('3. Revokes an active doctor access grant upon patient request', async () => {
    let [doctor] = await db.select().from(users).where(eq(users.role, 'doctor')).limit(1);
    if (!doctor) {
      const [newDoc] = await db.insert(users).values({
        email: `doc_${Date.now()}@docmate.ai`,
        role: 'doctor',
        name: 'Dr. Test Grant',
        status: 'active',
        passwordHash: 'hash',
      }).returning();
      doctor = newDoc;
    }

    // Create grant
    const [grant] = await db
      .insert(accessGrants)
      .values({
        profileId: selfProfileId,
        doctorId: doctor.id,
        scope: 'full_history',
        status: 'active',
        grantedVia: 'otp',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .returning();

    expect(grant.status).toBe('active');

    // Revoke grant
    const [revoked] = await db
      .update(accessGrants)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
      })
      .where(eq(accessGrants.id, grant.id))
      .returning();

    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedAt).toBeDefined();
  });
});
