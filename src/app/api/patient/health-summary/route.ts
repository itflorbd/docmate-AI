import { NextResponse } from 'next/server';
import { db } from '@/db';
import { profileHealthSummary, patientProfiles, accessGrants } from '@/db/schema';
import { eq, and, desc, or, isNull, gt } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { recordAccessLog } from '@/lib/access-log';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const {
      profileId,
      expectedVersion,
      allergies,
      chronicConditions,
      currentMedicines,
      bloodGroup,
      changeReason,
    } = body;

    if (!profileId || expectedVersion === undefined || expectedVersion === null) {
      return NextResponse.json(
        { error: 'profileId and expectedVersion are required for optimistic locking' },
        { status: 400 }
      );
    }

    // 1. Authorization check
    if (user.role === 'doctor') {
      const now = new Date();
      const [grant] = await db
        .select({ id: accessGrants.id })
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

      const [profile] = await db
        .select({ createdBy: patientProfiles.createdBy })
        .from(patientProfiles)
        .where(eq(patientProfiles.id, profileId))
        .limit(1);

      if (!grant && profile?.createdBy !== user.id) {
        return NextResponse.json(
          { error: 'অ্যাক্সেস অস্বীকৃত: রোগীর প্রোফাইল সম্পাদনার অনুমতি নেই' },
          { status: 403 }
        );
      }
    }

    // 2. Fetch latest version
    const [latest] = await db
      .select()
      .from(profileHealthSummary)
      .where(eq(profileHealthSummary.profileId, profileId))
      .orderBy(desc(profileHealthSummary.version))
      .limit(1);

    const currentVersion = latest?.version ?? 0;

    // 3. Optimistic lock validation
    if (latest && latest.version !== expectedVersion) {
      return NextResponse.json(
        {
          error:
            'সমকালীন পরিবর্তনজনিত সংঘাত (Concurrent modification conflict). আপনার তথ্য লোড করার পর অন্য কেউ এটি পরিবর্তন করেছেন। অনুগ্রহ করে রিফ্রেশ করে পুনরায় চেষ্টা করুন।',
          conflict: true,
          currentVersion: latest.version,
          expectedVersion,
        },
        { status: 409 }
      );
    }

    // 4. Append new version
    const nextVersion = currentVersion + 1;
    const [inserted] = await db
      .insert(profileHealthSummary)
      .values({
        profileId,
        version: nextVersion,
        allergies: allergies ?? (latest?.allergies as string[]) ?? [],
        chronicConditions: chronicConditions ?? (latest?.chronicConditions as string[]) ?? [],
        currentMedicines: currentMedicines ?? (latest?.currentMedicines as Array<{ brand: string; generic: string; dose?: string }>) ?? [],
        bloodGroup: bloodGroup !== undefined ? bloodGroup : latest?.bloodGroup,
        updatedBy: user.id,
        changeReason: changeReason || `Updated by ${user.role} (v${nextVersion})`,
      })
      .returning();

    // 5. Audit log
    await recordAccessLog({
      userId: user.id,
      profileId,
      userRole: user.role,
      action: 'health_summary_updated',
      recordType: 'profile_health_summary',
      recordId: inserted.id,
      reason: changeReason || `Health summary bumped to version ${nextVersion}`,
    });

    return NextResponse.json({
      success: true,
      message: 'স্বাস্থ্য সারসংক্ষেপ সফলভাবে সংরক্ষিত হয়েছে (Health summary saved)',
      version: nextVersion,
      summary: inserted,
    });
  } catch (error) {
    console.error('Optimistic lock health summary update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
