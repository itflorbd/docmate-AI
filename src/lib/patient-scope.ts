import { eq, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { patientAccounts, patientProfiles } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { normalizeBangladeshiPhone } from '@/lib/phone';

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export interface PatientScope {
  user: User;
  account: typeof patientAccounts.$inferSelect;
  profiles: (typeof patientProfiles.$inferSelect)[];
  /** True when the profile belongs to this patient's account. */
  owns: (profileId: unknown) => boolean;
}

/**
 * The signed-in patient and only their own account and profiles, matched by
 * the verified phone number. Never falls back to another patient's account.
 */
export async function requirePatientScope(): Promise<PatientScope | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (user.role !== 'patient') return NextResponse.json({ error: 'Patients only.' }, { status: 403 });
  if (!user.phone) return NextResponse.json({ error: 'No patient account for this login.' }, { status: 404 });

  // Match the stored phone in any of its saved forms (raw, E.164 or normalized).
  const e164 = normalizeBangladeshiPhone(user.phone).e164;
  const [account] = await db
    .select()
    .from(patientAccounts)
    .where(or(eq(patientAccounts.phone, user.phone), eq(patientAccounts.phone, e164), eq(patientAccounts.phoneNormalized, e164)))
    .limit(1);
  if (!account) return NextResponse.json({ error: 'No patient account for this login.' }, { status: 404 });
  const profiles = await db.select().from(patientProfiles).where(eq(patientProfiles.accountId, account.id));
  const ids = new Set(profiles.map((profile) => profile.id));
  return { user, account, profiles, owns: (profileId) => typeof profileId === 'string' && ids.has(profileId) };
}
