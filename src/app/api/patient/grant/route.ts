import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { accessGrants, accessLogs, patientProfiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { canUse } from '@/lib/permissions';
import { verifyOtp } from '@/lib/otp';
import { createAuditLogEntry } from '@/lib/audit';

const grantSchema = z.object({
  phone: z.string().min(8).max(30),
  profileId: z.string().uuid(),
  code: z.string().length(6),
  durationDays: z.enum(['7', '30', '90']).default('30'),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'doctor' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Doctor access required' }, { status: 403 });
    }

    const permission = await canUse(user, 'patients.manage');
    if (!permission.allowed && user.role !== 'super_admin') {
      return NextResponse.json({ error: `Access denied: ${permission.reason}` }, { status: 403 });
    }

    const body = await req.json();
    const parsed = grantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid grant parameters', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { phone, profileId, code, durationDays } = parsed.data;

    // Verify profile exists
    const [profile] = await db
      .select({ id: patientProfiles.id, name: patientProfiles.name })
      .from(patientProfiles)
      .where(eq(patientProfiles.id, profileId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: 'Patient profile not found' }, { status: 404 });
    }

    // Verify OTP for grant_access purpose
    const verifyResult = await verifyOtp(phone, code, 'grant_access');
    if (!verifyResult.success) {
      return NextResponse.json(
        {
          error: verifyResult.error || 'ভুল ওটিপি কোড (Invalid OTP code)',
          attemptsRemaining: verifyResult.attemptsRemaining,
        },
        { status: 400 }
      );
    }

    // Calculate expiration date
    const days = parseInt(durationDays, 10) || 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Upsert access grant
    const [existingGrant] = await db
      .select({ id: accessGrants.id })
      .from(accessGrants)
      .where(
        and(
          eq(accessGrants.profileId, profileId),
          eq(accessGrants.doctorId, user.id)
        )
      )
      .limit(1);

    let grantId: string;
    if (existingGrant) {
      await db
        .update(accessGrants)
        .set({
          scope: 'full_history',
          status: 'active',
          grantedVia: 'otp',
          expiresAt,
          revokedAt: null,
        })
        .where(eq(accessGrants.id, existingGrant.id));
      grantId = existingGrant.id;
    } else {
      const [newGrant] = await db
        .insert(accessGrants)
        .values({
          profileId,
          doctorId: user.id,
          scope: 'full_history',
          status: 'active',
          grantedVia: 'otp',
          expiresAt,
        })
        .returning({ id: accessGrants.id });
      grantId = newGrant.id;
    }

    // Audit logs
    await createAuditLogEntry({
      userId: user.id,
      event: 'ACCESS_GRANT_ACTIVATED_BY_OTP',
      payload: {
        grantId,
        profileId,
        doctorId: user.id,
        durationDays: days,
        expiresAt: expiresAt.toISOString(),
      },
    });

    await db.insert(accessLogs).values({
      userId: user.id,
      profileId,
      userRole: user.role,
      action: 'GRANT_ACTIVATED_OTP',
      recordType: 'access_grant',
      recordId: grantId,
      reason: `Patient verified OTP to grant ${days}-day full history access to Dr. ${user.name}`,
    });

    return NextResponse.json({
      success: true,
      message: `অনুমতি সফলভাবে সক্রিয় হয়েছে (${days} দিন)`,
      grant: {
        id: grantId,
        scope: 'full_history',
        status: 'active',
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in /api/patient/grant:', error);
    return NextResponse.json({ error: 'Failed to activate access grant' }, { status: 500 });
  }
}
