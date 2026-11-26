import { db } from '@/db';
import { patientProfiles, patientAccounts, accessGrants } from '@/db/schema';
import { eq, and, gt, or, isNull } from 'drizzle-orm';
import { User } from '@/types';
import { normalizeBangladeshiPhone } from '@/lib/phone';

export interface ProfileAuthResult {
  authorized: boolean;
  status: number;
  error?: string;
  isOwner?: boolean;
  isDoctor?: boolean;
  isAdmin?: boolean;
  profile?: typeof patientProfiles.$inferSelect;
  account?: typeof patientAccounts.$inferSelect;
}

/**
 * Authorizes access to a patient profile based on caller role, account ownership, and active access grants.
 * - Patients can only access profiles belonging to their own phone account.
 * - Doctors can only access profiles where an active, non-expired consent grant exists.
 * - Doctors cannot toggle sharing or delete patient records.
 */
export async function authorizePatientProfileAccess(
  user: User,
  profileId: string,
  action: 'read' | 'write' | 'share' | 'delete' = 'read'
): Promise<ProfileAuthResult> {
  if (!profileId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
    return { authorized: false, status: 400, error: 'Valid profile ID is required' };
  }

  const [profile] = await db
    .select()
    .from(patientProfiles)
    .where(eq(patientProfiles.id, profileId))
    .limit(1);

  if (!profile) {
    return { authorized: false, status: 404, error: 'Patient profile not found' };
  }

  // Super admin override for regulatory audit/compliance
  if (user.role === 'super_admin') {
    return { authorized: true, status: 200, isAdmin: true, profile };
  }

  // Patient account ownership check
  if (user.role === 'patient') {
    const [account] = await db
      .select()
      .from(patientAccounts)
      .where(eq(patientAccounts.id, profile.accountId))
      .limit(1);

    if (!account) {
      return { authorized: false, status: 403, error: 'Patient account not found' };
    }

    const userPhoneNorm = user.phone ? normalizeBangladeshiPhone(user.phone).e164 : '';
    const accPhoneNorm = account.phone ? normalizeBangladeshiPhone(account.phone).e164 : '';

    if (userPhoneNorm && accPhoneNorm && userPhoneNorm === accPhoneNorm) {
      return { authorized: true, status: 200, isOwner: true, profile, account };
    }

    return { authorized: false, status: 403, error: 'Forbidden: Profile does not belong to your account' };
  }

  // Doctor access check
  if (user.role === 'doctor' || (user.role as string) === 'physician') {
    if (action === 'share' || action === 'delete') {
      return { authorized: false, status: 403, error: 'Only the patient can manage report sharing or deletion' };
    }

    const now = new Date();
    const [grant] = await db
      .select()
      .from(accessGrants)
      .where(
        and(
          eq(accessGrants.profileId, profileId),
          eq(accessGrants.doctorId, user.id),
          eq(accessGrants.status, 'active'),
          or(isNull(accessGrants.expiresAt), gt(accessGrants.expiresAt, now))
        )
      )
      .limit(1);

    if (!grant) {
      return { authorized: false, status: 403, error: 'Access denied: No active consent grant from this patient' };
    }

    return { authorized: true, status: 200, isDoctor: true, profile };
  }

  return { authorized: false, status: 403, error: 'Access denied: Unauthorized role' };
}
