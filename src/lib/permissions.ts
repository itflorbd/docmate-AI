import { and, eq, or, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  roleFeatures,
  userFeatureOverrides,
  systemSettings,
  cases,
  accessGrants,
} from '@/db/schema';
import { FeatureKey, User } from '@/types';
import { recordAuditLog } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';

export interface CanUseResult {
  allowed: boolean;
  reason: string;
  dailyLimit?: number | null;
}

interface CacheEntry {
  result: CanUseResult;
  timestamp: number;
}

export interface UserLike {
  id: string;
  role: string;
  status?: string;
  bmdc_number?: string | null;
  org_id?: string | null;
  name?: string;
  email?: string;
}

// In-memory permission cache with short TTL (30 seconds) to balance performance and immediate updates
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}
const permissionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

export function invalidateFeatureCache(userId?: string) {
  if (userId) {
    for (const key of permissionCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        permissionCache.delete(key);
      }
    }
  } else {
    permissionCache.clear();
  }
}

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Partial<Record<FeatureKey, boolean>>> = {
  super_admin: {
    'patients.manage': false,
    'ai.analyze': false,
    'ai.treatment': false,
    'prescription.create': false,
    'library.ask': true,
    'library.browse': true,
    'library.manage': true,
    'library.ingest': true,
    'library.review': true,
    'library.retire': true,
    'medicine.search': true,
    'medicine.interactions': true,
    'medicine.manage': true,
    'medicine.notices': true,
    'study.tools': false,
    'research.tools': false,
    'patient.portal': false,
    'feedback.send': true,
    'feedback.review': true,
    'users.manage': true,
    'access.manage': true,
    'plans.billing': true,
    'ai.settings': true,
    'audit.read': true,
    'system.manage': true,
    'patient.search': true,
    'patient.create': true,
    'history.request': true,
    'history.view': true,
    'portal.profiles': true,
    'portal.prescriptions': true,
    'portal.reports': true,
    'portal.medicine_schedule': true,
    'portal.permissions': true,
    'portal.access_log': true,
    'voice.assistant': true,
    'voice.dictation': true,
    'voice.avatar': true,
    'voice.readaloud': true,
    'language.prefs': true,
    'language.aliases.manage': true,
    'language.phonetic_typing': true,
    'assistant.personalize': true,
    'assistant.phrasebank.manage': true,
  },
  doctor: {
    'patients.manage': true,
    'ai.analyze': true,
    'ai.treatment': true,
    'prescription.create': true,
    'library.ask': true,
    'library.browse': true,
    'library.manage': false,
    'library.ingest': false,
    'library.review': false,
    'library.retire': false,
    'medicine.search': true,
    'medicine.interactions': true,
    'medicine.manage': false,
    'medicine.notices': true,
    'study.tools': false,
    'research.tools': false,
    'patient.portal': false,
    'feedback.send': true,
    'feedback.review': false,
    'users.manage': false,
    'access.manage': false,
    'plans.billing': true,
    'ai.settings': true,
    'audit.read': false,
    'system.manage': false,
    'patient.search': true,
    'patient.create': true,
    'history.request': true,
    'history.view': true,
    'portal.profiles': false,
    'portal.prescriptions': false,
    'portal.reports': false,
    'portal.medicine_schedule': false,
    'portal.permissions': false,
    'portal.access_log': false,
    'voice.assistant': true,
    'voice.dictation': true,
    'voice.avatar': true,
    'voice.readaloud': true,
    'language.prefs': true,
    'language.aliases.manage': false,
    'language.phonetic_typing': false,
    'assistant.personalize': true,
    'assistant.phrasebank.manage': false,
  },
  student: {
    'patients.manage': false,
    'ai.analyze': false,
    'ai.treatment': false,
    'prescription.create': false,
    'library.ask': true,
    'library.browse': true,
    'library.manage': false,
    'library.ingest': false,
    'library.review': false,
    'library.retire': false,
    'medicine.search': true,
    'medicine.interactions': true,
    'medicine.manage': false,
    'medicine.notices': true,
    'study.tools': true,
    'research.tools': false,
    'patient.portal': false,
    'feedback.send': true,
    'feedback.review': false,
    'users.manage': false,
    'access.manage': false,
    'plans.billing': true,
    'ai.settings': true,
    'audit.read': false,
    'system.manage': false,
    'patient.search': false,
    'patient.create': false,
    'history.request': false,
    'history.view': false,
    'portal.profiles': false,
    'portal.prescriptions': false,
    'portal.reports': false,
    'portal.medicine_schedule': false,
    'portal.permissions': false,
    'portal.access_log': false,
    'voice.assistant': true,
    'voice.dictation': false,
    'voice.avatar': true,
    'voice.readaloud': false,
    'language.prefs': true,
    'language.aliases.manage': false,
    'language.phonetic_typing': false,
    'assistant.personalize': true,
    'assistant.phrasebank.manage': false,
  },
  researcher: {
    'patients.manage': false,
    'ai.analyze': false,
    'ai.treatment': false,
    'prescription.create': false,
    'library.ask': true,
    'library.browse': true,
    'library.manage': false,
    'library.ingest': false,
    'library.review': false,
    'library.retire': false,
    'medicine.search': true,
    'medicine.interactions': true,
    'medicine.manage': false,
    'medicine.notices': true,
    'study.tools': false,
    'research.tools': true,
    'patient.portal': false,
    'feedback.send': true,
    'feedback.review': false,
    'users.manage': false,
    'access.manage': false,
    'plans.billing': true,
    'ai.settings': true,
    'audit.read': false,
    'system.manage': false,
    'patient.search': false,
    'patient.create': false,
    'history.request': false,
    'history.view': false,
    'portal.profiles': false,
    'portal.prescriptions': false,
    'portal.reports': false,
    'portal.medicine_schedule': false,
    'portal.permissions': false,
    'portal.access_log': false,
    'voice.assistant': true,
    'voice.dictation': false,
    'voice.avatar': true,
    'voice.readaloud': false,
    'language.prefs': true,
    'language.aliases.manage': false,
    'language.phonetic_typing': false,
    'assistant.personalize': true,
    'assistant.phrasebank.manage': false,
  },
  patient: {
    'patients.manage': false,
    'ai.analyze': false,
    'ai.treatment': false,
    'prescription.create': false,
    'library.ask': false,
    'library.browse': false,
    'library.manage': false,
    'library.ingest': false,
    'library.review': false,
    'library.retire': false,
    'medicine.search': false,
    'medicine.interactions': false,
    'medicine.manage': false,
    'medicine.notices': true,
    'study.tools': false,
    'research.tools': false,
    'patient.portal': true,
    'feedback.send': true,
    'feedback.review': false,
    'users.manage': false,
    'access.manage': false,
    'plans.billing': false,
    'ai.settings': false,
    'audit.read': false,
    'system.manage': false,
    'patient.search': false,
    'patient.create': true,
    'history.request': false,
    'history.view': true,
    'portal.profiles': true,
    'portal.prescriptions': true,
    'portal.reports': true,
    'portal.medicine_schedule': true,
    'portal.permissions': true,
    'portal.access_log': true,
    'voice.assistant': false,
    'voice.dictation': false,
    'voice.avatar': false,
    'voice.readaloud': true,
    'language.prefs': true,
    'language.aliases.manage': false,
    'language.phonetic_typing': false,
    'assistant.personalize': true,
    'assistant.phrasebank.manage': false,
  },
  medicine_controller: {
    'patients.manage': false,
    'ai.analyze': false,
    'ai.treatment': false,
    'prescription.create': false,
    'library.ask': true,
    'library.browse': true,
    'library.manage': false,
    'library.ingest': false,
    'library.review': false,
    'library.retire': false,
    'medicine.search': true,
    'medicine.interactions': true,
    'medicine.manage': true,
    'medicine.notices': true,
    'study.tools': false,
    'research.tools': false,
    'patient.portal': false,
    'feedback.send': true,
    'feedback.review': true,
    'users.manage': false,
    'access.manage': false,
    'plans.billing': false,
    'ai.settings': false,
    'audit.read': true,
    'system.manage': false,
    'patient.search': false,
    'patient.create': false,
    'history.request': false,
    'history.view': false,
    'portal.profiles': false,
    'portal.prescriptions': false,
    'portal.reports': false,
    'portal.medicine_schedule': false,
    'portal.permissions': false,
    'portal.access_log': false,
    'voice.assistant': false,
    'voice.dictation': false,
    'voice.avatar': false,
    'voice.readaloud': false,
    'language.prefs': true,
    'language.aliases.manage': true,
    'language.phonetic_typing': false,
    'assistant.personalize': true,
    'assistant.phrasebank.manage': false,
  },
};

/**
 * Evaluates whether a user is authorized to perform an action gated by a feature key.
 * 
 * Order of evaluation:
 * 1. User authentication and status check (suspended users are denied immediately).
 * 2. Doctor verification check: unverified doctors cannot access patient/clinical features.
 * 3. Global system settings kill switch check (e.g. system_settings 'killswitch:<feature>').
 * 4. User-specific feature override (user_feature_overrides table, verifying expiry).
 * 5. Role default feature permissions (role_features table).
 */
export async function canUse(
  user: UserLike | null | undefined,
  featureKey: FeatureKey
): Promise<CanUseResult> {
  if (!user || !user.id) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  // 1. Account status check
  if (user.status === 'suspended') {
    return { allowed: false, reason: 'account_suspended' };
  }

  // 2. Doctor verification rule:
  // Unverified doctors cannot open patient or clinical features
  const clinicalFeatures: FeatureKey[] = [
    'patients.manage',
    'ai.analyze',
    'ai.treatment',
    'prescription.create',
  ];
  if (
    user.role === 'doctor' &&
    user.status === 'pending_verification' &&
    clinicalFeatures.includes(featureKey)
  ) {
    return {
      allowed: false,
      reason: 'doctor_verification_required',
    };
  }

  // Check cache
  const cacheKey = `${user.id}:${user.role}:${featureKey}`;
  const cached = permissionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    // 3. Global kill switch check
    const killswitchKey = `killswitch:${featureKey}`;
    const globalKillswitch = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, killswitchKey))
      .limit(1);

    if (
      globalKillswitch.length > 0 &&
      (globalKillswitch[0].value as { disabled?: boolean })?.disabled === true
    ) {
      const res: CanUseResult = {
        allowed: false,
        reason: 'global_killswitch_active',
      };
      permissionCache.set(cacheKey, { result: res, timestamp: Date.now() });
      return res;
    }

    // 4. User-specific overrides (only query if user.id is a valid UUID)
    const now = new Date();
    if (isValidUuid(user.id)) {
      const userOverrides = await db
        .select()
        .from(userFeatureOverrides)
        .where(
          and(
            eq(userFeatureOverrides.userId, user.id),
            eq(userFeatureOverrides.featureKey, featureKey)
          )
        )
        .limit(1);

      if (userOverrides.length > 0) {
        const override = userOverrides[0];
        const isExpired = override.expiresAt && new Date(override.expiresAt) <= now;

        if (!isExpired) {
          const res: CanUseResult = {
            allowed: override.enabled,
            reason: override.enabled ? 'user_override_granted' : 'user_override_revoked',
            dailyLimit: override.dailyLimit,
          };
          permissionCache.set(cacheKey, { result: res, timestamp: Date.now() });
          return res;
        }
      }
    }

    // 5. Role default features
    const roleDefault = await db
      .select()
      .from(roleFeatures)
      .where(
        and(
          eq(roleFeatures.role, user.role),
          eq(roleFeatures.featureKey, featureKey)
        )
      )
      .limit(1);

    if (roleDefault.length > 0) {
      const rf = roleDefault[0];
      const res: CanUseResult = {
        allowed: rf.enabled,
        reason: rf.enabled ? 'role_default_granted' : 'role_default_denied',
        dailyLimit: rf.dailyLimit,
      };
      permissionCache.set(cacheKey, { result: res, timestamp: Date.now() });
      return res;
    }

    // 6. In-code default matrix fallback if database role_features has unseeded/missing rows
    const codeDefault = DEFAULT_ROLE_PERMISSIONS[user.role]?.[featureKey];
    if (codeDefault !== undefined) {
      const res: CanUseResult = {
        allowed: codeDefault,
        reason: codeDefault ? 'role_default_granted' : 'role_default_denied',
      };
      permissionCache.set(cacheKey, { result: res, timestamp: Date.now() });
      return res;
    }

    // Default deny if feature mapping not found anywhere
    const fallbackRes: CanUseResult = {
      allowed: false,
      reason: 'feature_not_configured',
    };
    permissionCache.set(cacheKey, { result: fallbackRes, timestamp: Date.now() });
    return fallbackRes;
  } catch (error) {
    console.error(`[permissions] Error checking feature ${featureKey} for user ${user.id}:`, error);
    // On unexpected database error, fail closed
    return {
      allowed: false,
      reason: 'permission_check_error',
    };
  }
}

/**
 * Asserts clinical data scope boundaries for patients, cases, and visits.
 * Non-negotiable data-scope policy:
 * - Doctor sees only their own patients/cases.
 * - Patient sees only their own shared records.
 * - Students, researchers, and medicine controllers NEVER see patient data.
 * - Super admin sees NO clinical data unless an active Break-Glass session exists.
 */
export async function assertPatientDataScope(params: {
  user: UserLike | null | undefined;
  caseDoctorId?: string | null;
  patientId?: string | null;
  caseId?: string;
  profileId?: string | null;
}): Promise<{ allowed: boolean; reason: string }> {
  const { user, caseDoctorId, patientId, caseId, profileId } = params;

  if (!user || !user.id) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  // 1. Strict ban: Students, researchers, and medicine controllers never see patient data
  if (['student', 'researcher', 'medicine_controller'].includes(user.role)) {
    return {
      allowed: false,
      reason: `role_${user.role}_forbidden_from_patient_data`,
    };
  }

  // 2. Doctor:
  // - A doctor sees (a) every record that doctor authored (caseDoctorId === user.id)
  // - (b) other doctors' records of a profile only while an active access grant ('full_history') from the patient exists
  if (user.role === 'doctor') {
    if (caseDoctorId && caseDoctorId === user.id) {
      return { allowed: true, reason: 'doctor_case_owner' };
    }

    if (profileId && isValidUuid(profileId) && isValidUuid(user.id)) {
      const now = new Date();
      const activeGrants = await db
        .select({ id: accessGrants.id })
        .from(accessGrants)
        .where(
          and(
            eq(accessGrants.profileId, profileId),
            eq(accessGrants.doctorId, user.id),
            eq(accessGrants.status, 'active'),
            eq(accessGrants.scope, 'full_history'),
            or(isNull(accessGrants.expiresAt), gt(accessGrants.expiresAt, now))
          )
        )
        .limit(1);

      if (activeGrants.length > 0) {
        return { allowed: true, reason: 'active_patient_grant' };
      }
    }

    return {
      allowed: false,
      reason: 'cross_doctor_access_prohibited',
    };
  }

  // 3. Patient: Must match own patient record
  if (user.role === 'patient') {
    if (!patientId || patientId !== user.id) {
      return {
        allowed: false,
        reason: 'cross_patient_access_prohibited',
      };
    }
    return { allowed: true, reason: 'own_patient_record' };
  }

  // 4. Super Admin: Clinical data is blocked unless break-glass is verified
  if (user.role === 'super_admin') {
    const breakGlassActive = await isBreakGlassActive(user.id, caseId);
    if (!breakGlassActive) {
      return {
        allowed: false,
        reason: 'break_glass_required_for_admin_phi',
      };
    }
    return { allowed: true, reason: 'break_glass_authorized' };
  }

  return { allowed: false, reason: 'unauthorized_role' };
}

/**
 * Checks if a doctor has an active access grant from the patient for a specific profile.
 */
export async function checkDoctorProfileAccess(
  doctorId: string,
  profileId: string
): Promise<{
  hasGrant: boolean;
  scope?: 'this_doctor_only' | 'full_history';
  status?: string;
  expiresAt?: Date | null;
}> {
  if (!isValidUuid(doctorId) || !isValidUuid(profileId)) {
    return { hasGrant: false };
  }
  const now = new Date();
  const [grant] = await db
    .select({
      id: accessGrants.id,
      scope: accessGrants.scope,
      status: accessGrants.status,
      expiresAt: accessGrants.expiresAt,
    })
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.profileId, profileId),
        eq(accessGrants.doctorId, doctorId),
        eq(accessGrants.status, 'active'),
        or(isNull(accessGrants.expiresAt), gt(accessGrants.expiresAt, now))
      )
    )
    .limit(1);

  if (!grant) {
    return { hasGrant: false };
  }

  return {
    hasGrant: true,
    scope: grant.scope as 'this_doctor_only' | 'full_history',
    status: grant.status,
    expiresAt: grant.expiresAt,
  };
}

/**
 * Record a break-glass emergency access event by a super admin.
 * Requires a mandatory justification and creates an audited, tamper-evident record.
 */
export async function recordBreakGlassAccess(params: {
  adminId: string;
  reason: string;
  caseId?: string;
  durationMinutes?: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ success: boolean; expiresAt: Date; settingKey: string }> {
  const {
    adminId,
    reason,
    caseId,
    durationMinutes = 30,
    ipAddress,
    userAgent,
  } = params;

  if (!reason || reason.trim().length < 5) {
    throw new Error('A detailed written clinical justification is required for break-glass access.');
  }

  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  const settingKey = caseId
    ? `break_glass:${adminId}:${caseId}`
    : `break_glass:${adminId}:global`;

  // Store active break glass session in systemSettings
  await db
    .insert(systemSettings)
    .values({
      key: settingKey,
      value: {
        adminId,
        caseId: caseId || null,
        reason: reason.trim(),
        expiresAt: expiresAt.toISOString(),
        durationMinutes,
      },
      updatedBy: adminId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: {
          adminId,
          caseId: caseId || null,
          reason: reason.trim(),
          expiresAt: expiresAt.toISOString(),
          durationMinutes,
        },
        updatedBy: adminId,
        updatedAt: new Date(),
      },
    });

  // Verify if caseId exists in cases table before setting foreign key
  let validCaseFk: string | undefined = undefined;
  if (caseId && isValidUuid(caseId)) {
    try {
      const exists = await db
        .select({ id: cases.id })
        .from(cases)
        .where(eq(cases.id, caseId))
        .limit(1);
      if (exists.length > 0) {
        validCaseFk = caseId;
      }
    } catch {
      // If error checking case existence, leave FK undefined and store in payload
    }
  }

  // Log in tamper-evident hash-chained audit log
  await recordAuditLog({
    userId: adminId,
    caseId: validCaseFk,
    event: 'BREAK_GLASS_ACCESS_INITIATED',
    payload: {
      reason: reason.trim(),
      caseId: caseId || 'all_cases',
      durationMinutes,
      expiresAt: expiresAt.toISOString(),
      ipAddress,
      userAgent,
    },
  });

  return { success: true, expiresAt, settingKey };
}

/**
 * Checks whether an active break-glass session exists for the super admin.
 */
export async function isBreakGlassActive(
  adminId: string,
  caseId?: string
): Promise<boolean> {
  try {
    const keysToCheck = [`break_glass:${adminId}:global`];
    if (caseId) {
      keysToCheck.push(`break_glass:${adminId}:${caseId}`);
    }

    const sessions = await db
      .select()
      .from(systemSettings)
      .where(or(...keysToCheck.map((k) => eq(systemSettings.key, k))));

    const now = new Date();
    for (const session of sessions) {
      const val = session.value as { expiresAt?: string };
      if (val?.expiresAt && new Date(val.expiresAt) > now) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('[permissions] Error checking break glass status:', error);
    return false;
  }
}

/**
 * Express / Next.js Server Action / Route guard helper.
 * Throws an Error with 403 status if feature is not permitted.
 */
export async function requireFeature(
  user: UserLike | null | undefined,
  featureKey: FeatureKey
): Promise<CanUseResult> {
  const result = await canUse(user, featureKey);
  if (!result.allowed) {
    const err = new Error(`Feature access denied: ${featureKey} (${result.reason})`);
    (err as unknown as { status: number }).status = 403;
    throw err;
  }
  return result;
}

export type RequireSuperAdminResult =
  | { user: User; error: null; status: 200 }
  | { user: User; error: string; status: 401 | 403 };

/**
 * Route guard helper requiring active Super Admin authentication.
 */
export async function requireSuperAdmin(): Promise<RequireSuperAdminResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Authentication required', status: 401, user: {} as User };
  }
  if (user.role !== 'super_admin') {
    return { error: 'Super Admin access required', status: 403, user: {} as User };
  }
  return { user, error: null, status: 200 };
}

/**
 * Route guard helper requiring specific feature permission (e.g. library.ingest, library.review, library.retire).
 */
export async function requireFeaturePermission(featureKey: FeatureKey): Promise<RequireSuperAdminResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Authentication required', status: 401, user: {} as User };
  }
  const check = await canUse(user, featureKey);
  if (!check.allowed) {
    return { error: check.reason || 'Forbidden: Insufficient privileges', status: 403, user };
  }
  return { user, error: null, status: 200 };
}


export type RequireMedicineControllerResult =
  | { user: User; error: null; status: 200 }
  | { user: User; error: string; status: 401 | 403 };

/**
 * Route guard helper requiring active Medicine Controller or Super Admin authentication.
 */
export async function requireMedicineControllerOrAdmin(): Promise<RequireMedicineControllerResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Authentication required', status: 401, user: {} as User };
  }
  if (user.role !== 'medicine_controller' && user.role !== 'super_admin') {
    return { error: 'Medicine Controller or Super Admin access required', status: 403, user: {} as User };
  }
  return { user, error: null, status: 200 };
}
