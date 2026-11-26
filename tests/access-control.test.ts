import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  canUse,
  assertPatientDataScope,
  recordBreakGlassAccess,
  isBreakGlassActive,
  invalidateFeatureCache,
} from '../src/lib/permissions';
import { db } from '../src/db';
import {
  userFeatureOverrides,
  systemSettings,
  users,
  accessGrants,
  patientAccounts,
  patientProfiles,
} from '../src/db/schema';
import { eq, like } from 'drizzle-orm';
import { FeatureKey, UserRole } from '../src/types';

describe('Fine-Grained Feature RBAC & Data-Scope Enforcement', () => {
  beforeAll(async () => {
    const dbUsers = await db.select().from(users);
    for (const u of dbUsers) {
      if (mockUsers[u.role as UserRole]) {
        mockUsers[u.role as UserRole].id = u.id;
      }
    }
  });

  beforeEach(async () => {
    invalidateFeatureCache();
    await db.delete(systemSettings).where(like(systemSettings.key, 'break_glass:%'));
  });

  const mockUsers: Record<UserRole, { id: string; role: UserRole; status: string; email: string }> = {
    super_admin: {
      id: '95e33ccb-e149-43ba-9ca7-0379168dfbb6',
      role: 'super_admin',
      status: 'active',
      email: 'admin@docmate.ai',
    },
    doctor: {
      id: '43eb5601-471a-49ad-84e9-c298591deea7',
      role: 'doctor',
      status: 'active',
      email: 'doctor@docmate.ai',
    },
    student: {
      id: '812e507e-a43b-4736-bc5c-ecb0b8dbd51f',
      role: 'student',
      status: 'active',
      email: 'student@docmate.ai',
    },
    researcher: {
      id: '641a3454-6c3e-4c22-a84d-b4f1922c1087',
      role: 'researcher',
      status: 'active',
      email: 'researcher@docmate.ai',
    },
    patient: {
      id: '08d9af54-0a89-489d-8b24-5b4d21c85b9d',
      role: 'patient',
      status: 'active',
      email: 'patient@docmate.ai',
    },
    medicine_controller: {
      id: '0f18fd9c-96d9-4945-b34a-84da7df1cbf7',
      role: 'medicine_controller',
      status: 'active',
      email: 'controller@docmate.ai',
    },
  };

  it('1. Enforces default feature capabilities across all 6 roles', async () => {
    // Doctor can manage patients and run AI analysis
    const docPatientAccess = await canUse(mockUsers.doctor, 'patients.manage');
    expect(docPatientAccess.allowed).toBe(true);

    const docAiAccess = await canUse(mockUsers.doctor, 'ai.analyze');
    expect(docAiAccess.allowed).toBe(true);

    // Student & Researcher cannot manage patients, generate AI diagnoses, or write prescriptions
    const studentPatient = await canUse(mockUsers.student, 'patients.manage');
    expect(studentPatient.allowed).toBe(false);

    const studentTreatment = await canUse(mockUsers.student, 'ai.treatment');
    expect(studentTreatment.allowed).toBe(false);

    const researcherPrescription = await canUse(mockUsers.researcher, 'prescription.create');
    expect(researcherPrescription.allowed).toBe(false);

    // Medicine Controller can manage medicines and check interactions, but cannot access patient features
    const controllerMedManage = await canUse(mockUsers.medicine_controller, 'medicine.manage');
    expect(controllerMedManage.allowed).toBe(true);

    const controllerPatientAccess = await canUse(mockUsers.medicine_controller, 'patients.manage');
    expect(controllerPatientAccess.allowed).toBe(false);

    // Super Admin has ingestion, review, and retire capabilities
    const adminIngest = await canUse(mockUsers.super_admin, 'library.ingest');
    const adminReview = await canUse(mockUsers.super_admin, 'library.review');
    const adminRetire = await canUse(mockUsers.super_admin, 'library.retire');
    expect(adminIngest.allowed).toBe(true);
    expect(adminReview.allowed).toBe(true);
    expect(adminRetire.allowed).toBe(true);

    // Non-super-admins cannot ingest, review, or retire library sources by default
    const doctorIngest = await canUse(mockUsers.doctor, 'library.ingest');
    const studentReview = await canUse(mockUsers.student, 'library.review');
    const researcherRetire = await canUse(mockUsers.researcher, 'library.retire');
    expect(doctorIngest.allowed).toBe(false);
    expect(studentReview.allowed).toBe(false);
    expect(researcherRetire.allowed).toBe(false);

    // Patient can access patient portal, but cannot run clinical AI
    const patientPortal = await canUse(mockUsers.patient, 'patient.portal');
    expect(patientPortal.allowed).toBe(true);

    const patientAi = await canUse(mockUsers.patient, 'ai.analyze');
    expect(patientAi.allowed).toBe(false);

    // Assistant personalization is available to all signed-in users, but phrasebank management is super_admin only
    const docPersonalize = await canUse(mockUsers.doctor, 'assistant.personalize');
    const studentPersonalize = await canUse(mockUsers.student, 'assistant.personalize');
    const adminPersonalize = await canUse(mockUsers.super_admin, 'assistant.personalize');
    expect(docPersonalize.allowed).toBe(true);
    expect(studentPersonalize.allowed).toBe(true);
    expect(adminPersonalize.allowed).toBe(true);

    const adminPhrasebank = await canUse(mockUsers.super_admin, 'assistant.phrasebank.manage');
    const docPhrasebank = await canUse(mockUsers.doctor, 'assistant.phrasebank.manage');
    expect(adminPhrasebank.allowed).toBe(true);
    expect(docPhrasebank.allowed).toBe(false);
  });

  it('2. Denies all capabilities immediately if user is suspended', async () => {
    const suspendedDoctor = {
      ...mockUsers.doctor,
      status: 'suspended',
    };

    const res = await canUse(suspendedDoctor, 'patients.manage');
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('account_suspended');

    const resLibrary = await canUse(suspendedDoctor, 'library.browse');
    expect(resLibrary.allowed).toBe(false);
    expect(resLibrary.reason).toBe('account_suspended');
  });

  it('3. Blocks clinical features for unverified doctors until approved', async () => {
    const unverifiedDoctor = {
      ...mockUsers.doctor,
      status: 'pending_verification',
    };

    const clinicalRes = await canUse(unverifiedDoctor, 'patients.manage');
    expect(clinicalRes.allowed).toBe(false);
    expect(clinicalRes.reason).toBe('doctor_verification_required');

    const treatmentRes = await canUse(unverifiedDoctor, 'ai.treatment');
    expect(treatmentRes.allowed).toBe(false);
    expect(treatmentRes.reason).toBe('doctor_verification_required');

    // Non-clinical features like browsing guidelines are still permitted for education
    const browseRes = await canUse(unverifiedDoctor, 'library.browse');
    expect(browseRes.allowed).toBe(true);
  });

  it('4. Applies user-specific feature overrides and honors expiration', async () => {
    const testUserId = mockUsers.student.id;
    const testFeature: FeatureKey = 'ai.analyze';

    // Verify student is normally denied ai.analyze
    const initialCheck = await canUse(mockUsers.student, testFeature);
    expect(initialCheck.allowed).toBe(false);

    // 1. Grant override to student
    await db.insert(userFeatureOverrides).values({
      userId: testUserId,
      featureKey: testFeature,
      enabled: true,
      reason: 'Special academic trial granted by super_admin',
    });
    invalidateFeatureCache(testUserId);

    const grantedCheck = await canUse(mockUsers.student, testFeature);
    expect(grantedCheck.allowed).toBe(true);
    expect(grantedCheck.reason).toBe('user_override_granted');

    // 2. Set expired override
    const pastDate = new Date(Date.now() - 60_000);
    await db
      .update(userFeatureOverrides)
      .set({ expiresAt: pastDate })
      .where(eq(userFeatureOverrides.userId, testUserId));
    invalidateFeatureCache(testUserId);

    const expiredCheck = await canUse(mockUsers.student, testFeature);
    expect(expiredCheck.allowed).toBe(false);

    // Cleanup override
    await db
      .delete(userFeatureOverrides)
      .where(eq(userFeatureOverrides.userId, testUserId));
    invalidateFeatureCache(testUserId);
  });

  it('5. Global killswitch in system_settings disables feature for everyone', async () => {
    const killswitchKey = 'killswitch:ai.treatment';

    // Initially doctor can access ai.treatment
    const beforeKillswitch = await canUse(mockUsers.doctor, 'ai.treatment');
    expect(beforeKillswitch.allowed).toBe(true);

    // Activate global kill switch
    await db
      .insert(systemSettings)
      .values({
        key: killswitchKey,
        value: { disabled: true, reason: 'Clinical safety emergency hold' },
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: { disabled: true, reason: 'Clinical safety emergency hold' } },
      });
    invalidateFeatureCache();

    const afterKillswitch = await canUse(mockUsers.doctor, 'ai.treatment');
    expect(afterKillswitch.allowed).toBe(false);
    expect(afterKillswitch.reason).toBe('global_killswitch_active');

    // Restore kill switch
    await db.delete(systemSettings).where(eq(systemSettings.key, killswitchKey));
    invalidateFeatureCache();

    const restoredCheck = await canUse(mockUsers.doctor, 'ai.treatment');
    expect(restoredCheck.allowed).toBe(true);
  });

  it('6. Enforces non-negotiable Data-Scope Policy for clinical patient records', async () => {
    const doctorA = mockUsers.doctor;
    const doctorBId = 'e2222222-2222-4222-8222-222222222222';
    const patientA = mockUsers.patient;
    const patientBId = 'f3333333-3333-4333-8333-333333333333';

    // Doctor sees own case
    const ownCaseAccess = await assertPatientDataScope({
      user: doctorA,
      caseDoctorId: doctorA.id,
    });
    expect(ownCaseAccess.allowed).toBe(true);

    // Doctor CANNOT see another doctor's case
    const crossDoctorAccess = await assertPatientDataScope({
      user: doctorA,
      caseDoctorId: doctorBId,
    });
    expect(crossDoctorAccess.allowed).toBe(false);
    expect(crossDoctorAccess.reason).toBe('cross_doctor_access_prohibited');

    // Patient sees own record
    const patientOwnAccess = await assertPatientDataScope({
      user: patientA,
      patientId: patientA.id,
    });
    expect(patientOwnAccess.allowed).toBe(true);

    // Patient CANNOT see another patient's record
    const crossPatientAccess = await assertPatientDataScope({
      user: patientA,
      patientId: patientBId,
    });
    expect(crossPatientAccess.allowed).toBe(false);
    expect(crossPatientAccess.reason).toBe('cross_patient_access_prohibited');

    // Student, Researcher, Medicine Controller are ALWAYS BLOCKED from patient data
    const studentPhi = await assertPatientDataScope({
      user: mockUsers.student,
      caseDoctorId: doctorA.id,
    });
    expect(studentPhi.allowed).toBe(false);
    expect(studentPhi.reason).toBe('role_student_forbidden_from_patient_data');

    const researcherPhi = await assertPatientDataScope({
      user: mockUsers.researcher,
      caseDoctorId: doctorA.id,
    });
    expect(researcherPhi.allowed).toBe(false);

    const controllerPhi = await assertPatientDataScope({
      user: mockUsers.medicine_controller,
      caseDoctorId: doctorA.id,
    });
    expect(controllerPhi.allowed).toBe(false);
  });

  it('7. Enforces Break-Glass requirements for Super Admin clinical access', async () => {
    const admin = mockUsers.super_admin;
    const testCaseId = 'c1234567-89ab-cdef-0123-456789abcdef';

    // Super Admin CANNOT access clinical data without active break-glass
    const initialAdminAccess = await assertPatientDataScope({
      user: admin,
      caseId: testCaseId,
    });
    expect(initialAdminAccess.allowed).toBe(false);
    expect(initialAdminAccess.reason).toBe('break_glass_required_for_admin_phi');

    // Attempting break-glass without justification throws an error
    await expect(
      recordBreakGlassAccess({
        adminId: admin.id,
        reason: '   ',
      })
    ).rejects.toThrow();

    // Initiate audited break glass with clinical justification
    const breakGlass = await recordBreakGlassAccess({
      adminId: admin.id,
      caseId: testCaseId,
      reason: 'Court order / clinical incident safety audit #INC-2026-99',
      durationMinutes: 15,
    });
    expect(breakGlass.success).toBe(true);

    // Active break glass verified
    const isActive = await isBreakGlassActive(admin.id, testCaseId);
    expect(isActive).toBe(true);

    // Access granted under Break Glass
    const grantedAdminAccess = await assertPatientDataScope({
      user: admin,
      caseId: testCaseId,
    });
    expect(grantedAdminAccess.allowed).toBe(true);
    expect(grantedAdminAccess.reason).toBe('break_glass_authorized');

    // Clean up break glass setting
    await db.delete(systemSettings).where(eq(systemSettings.key, breakGlass.settingKey));
  });

  it('8. Supports patient-controlled access grant for cross-doctor record visibility', async () => {
    const doctorA = mockUsers.doctor;
    const doctorBId = 'e2222222-2222-4222-8222-222222222222';

    // 1. Create a mock patient account and profile
    const testPhone = `+880179900${Math.floor(1000 + Math.random() * 9000)}`;
    const [account] = await db
      .insert(patientAccounts)
      .values({
        phone: testPhone,
        phoneNormalized: testPhone,
      })
      .returning();

    const [profile] = await db
      .insert(patientProfiles)
      .values({
        accountId: account.id,
        name: 'Grant Test Patient',
        nameEncrypted: 'enc_name',
        age: 38,
        gender: 'female',
        sex: 'female',
        relation: 'self',
      })
      .returning();

    // 2. Doctor A attempts to view Doctor B's authored record without a grant -> DENIED
    const deniedNoGrant = await assertPatientDataScope({
      user: doctorA,
      caseDoctorId: doctorBId,
      profileId: profile.id,
    });
    expect(deniedNoGrant.allowed).toBe(false);
    expect(deniedNoGrant.reason).toBe('cross_doctor_access_prohibited');

    // 3. Patient grants full_history access to Doctor A (active for 30 days)
    const [grant] = await db
      .insert(accessGrants)
      .values({
        profileId: profile.id,
        doctorId: doctorA.id,
        scope: 'full_history',
        status: 'active',
        grantedVia: 'otp',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .returning();

    // 4. Now Doctor A attempts to view Doctor B's record for this profile -> ALLOWED!
    const allowedWithGrant = await assertPatientDataScope({
      user: doctorA,
      caseDoctorId: doctorBId,
      profileId: profile.id,
    });
    expect(allowedWithGrant.allowed).toBe(true);
    expect(allowedWithGrant.reason).toBe('active_patient_grant');

    // 5. If grant is revoked by the patient -> DENIED again
    await db
      .update(accessGrants)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(eq(accessGrants.id, grant.id));

    const deniedRevoked = await assertPatientDataScope({
      user: doctorA,
      caseDoctorId: doctorBId,
      profileId: profile.id,
    });
    expect(deniedRevoked.allowed).toBe(false);
    expect(deniedRevoked.reason).toBe('cross_doctor_access_prohibited');

    // Clean up test data
    await db.delete(accessGrants).where(eq(accessGrants.profileId, profile.id));
    await db.delete(patientProfiles).where(eq(patientProfiles.id, profile.id));
    await db.delete(patientAccounts).where(eq(patientAccounts.id, account.id));
  });

  it('9. Enforces Voice Assistant Feature Key Permissions & Role Isolation', async () => {
    // Super Admin: all voice features enabled
    expect((await canUse(mockUsers.super_admin, 'voice.assistant')).allowed).toBe(true);
    expect((await canUse(mockUsers.super_admin, 'voice.dictation')).allowed).toBe(true);
    expect((await canUse(mockUsers.super_admin, 'voice.avatar')).allowed).toBe(true);
    expect((await canUse(mockUsers.super_admin, 'voice.readaloud')).allowed).toBe(true);

    // Doctor: all voice features enabled
    expect((await canUse(mockUsers.doctor, 'voice.assistant')).allowed).toBe(true);
    expect((await canUse(mockUsers.doctor, 'voice.dictation')).allowed).toBe(true);
    expect((await canUse(mockUsers.doctor, 'voice.avatar')).allowed).toBe(true);
    expect((await canUse(mockUsers.doctor, 'voice.readaloud')).allowed).toBe(true);

    // Student: voice assistant (library only) and avatar enabled; dictation and read-aloud denied
    expect((await canUse(mockUsers.student, 'voice.assistant')).allowed).toBe(true);
    expect((await canUse(mockUsers.student, 'voice.avatar')).allowed).toBe(true);
    expect((await canUse(mockUsers.student, 'voice.dictation')).allowed).toBe(false);
    expect((await canUse(mockUsers.student, 'voice.readaloud')).allowed).toBe(false);

    // Researcher: voice assistant (library only) and avatar enabled; dictation and read-aloud denied
    expect((await canUse(mockUsers.researcher, 'voice.assistant')).allowed).toBe(true);
    expect((await canUse(mockUsers.researcher, 'voice.avatar')).allowed).toBe(true);
    expect((await canUse(mockUsers.researcher, 'voice.dictation')).allowed).toBe(false);
    expect((await canUse(mockUsers.researcher, 'voice.readaloud')).allowed).toBe(false);

    // Patient: read-aloud only; assistant, dictation, avatar denied
    expect((await canUse(mockUsers.patient, 'voice.readaloud')).allowed).toBe(true);
    expect((await canUse(mockUsers.patient, 'voice.assistant')).allowed).toBe(false);
    expect((await canUse(mockUsers.patient, 'voice.dictation')).allowed).toBe(false);
    expect((await canUse(mockUsers.patient, 'voice.avatar')).allowed).toBe(false);

    // Medicine Controller: all voice features denied
    expect((await canUse(mockUsers.medicine_controller, 'voice.assistant')).allowed).toBe(false);
    expect((await canUse(mockUsers.medicine_controller, 'voice.dictation')).allowed).toBe(false);
    expect((await canUse(mockUsers.medicine_controller, 'voice.avatar')).allowed).toBe(false);
    expect((await canUse(mockUsers.medicine_controller, 'voice.readaloud')).allowed).toBe(false);
  }, 15000);

  it('10. Enforces Multilingual Language Layer Feature Key Permissions & Role Isolation', async () => {
    // All signed-in roles can access personal language preferences
    expect((await canUse(mockUsers.super_admin, 'language.prefs')).allowed).toBe(true);
    expect((await canUse(mockUsers.doctor, 'language.prefs')).allowed).toBe(true);
    expect((await canUse(mockUsers.student, 'language.prefs')).allowed).toBe(true);
    expect((await canUse(mockUsers.researcher, 'language.prefs')).allowed).toBe(true);
    expect((await canUse(mockUsers.patient, 'language.prefs')).allowed).toBe(true);
    expect((await canUse(mockUsers.medicine_controller, 'language.prefs')).allowed).toBe(true);

    // Only Super Admin and Medicine Controller can manage term aliases
    expect((await canUse(mockUsers.super_admin, 'language.aliases.manage')).allowed).toBe(true);
    expect((await canUse(mockUsers.medicine_controller, 'language.aliases.manage')).allowed).toBe(true);
    expect((await canUse(mockUsers.doctor, 'language.aliases.manage')).allowed).toBe(false);
    expect((await canUse(mockUsers.student, 'language.aliases.manage')).allowed).toBe(false);
    expect((await canUse(mockUsers.researcher, 'language.aliases.manage')).allowed).toBe(false);
    expect((await canUse(mockUsers.patient, 'language.aliases.manage')).allowed).toBe(false);

    // Phonetic typing flag is enabled for Super Admin, off by default for other roles
    expect((await canUse(mockUsers.super_admin, 'language.phonetic_typing')).allowed).toBe(true);
    expect((await canUse(mockUsers.doctor, 'language.phonetic_typing')).allowed).toBe(false);
  });
});
