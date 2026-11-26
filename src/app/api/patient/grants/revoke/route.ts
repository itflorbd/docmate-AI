import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { accessGrants, accessLogs, patientConsentLogs } from '@/db/schema';
import { requirePatientScope } from '@/lib/patient-scope';

const bodySchema = z.object({ grantId: z.uuid(), profileId: z.uuid() });

/**
 * The patient revokes a doctor's access to one of their own profiles. The
 * revocation and its consent and access log entries are written together.
 */
export async function POST(req: Request) {
  try {
    const scope = await requirePatientScope();
    if (scope instanceof NextResponse) return scope;
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: 'grantId and profileId are required' }, { status: 400 });
    const { grantId, profileId } = body.data;
    if (!scope.owns(profileId)) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    const updated = await db.transaction(async (tx) => {
      const [grant] = await tx
        .update(accessGrants)
        .set({ status: 'revoked', revokedAt: new Date() })
        .where(and(eq(accessGrants.id, grantId), eq(accessGrants.profileId, profileId), eq(accessGrants.status, 'active')))
        .returning();
      if (!grant) return null;
      await tx.insert(patientConsentLogs).values({ profileId, action: 'revoked', reason: 'Patient revoked access via Patient Portal' });
      await tx.insert(accessLogs).values({
        userId: scope.user.id,
        profileId,
        userRole: 'patient',
        action: 'grant_revoked',
        recordType: 'access_grant',
        recordId: grantId,
        reason: 'Patient revoked a doctor’s access',
      });
      return grant;
    });
    if (!updated) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    return NextResponse.json({ success: true, message: 'অনুমতি বাতিল করা হয়েছে (Access revoked)' });
  } catch (error) {
    console.error('Revoke grant error:', error);
    return NextResponse.json({ error: 'Could not revoke. Try again.' }, { status: 500 });
  }
}
