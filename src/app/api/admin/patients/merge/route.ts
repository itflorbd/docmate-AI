import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  patientProfiles,
  profileHealthSummary,
  cases,
  prescriptions,
  patientReports,
  patientSchedules,
  accessGrants,
  medicineIntakeLogs,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { recordAccessLog } from '@/lib/access-log';

const mergeSchema = z.object({ canonicalProfileId: z.uuid(), duplicateProfileId: z.uuid(), justification: z.string().trim().min(5).max(2000) });

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const parsed = mergeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the form and try again.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { canonicalProfileId, duplicateProfileId, justification } = parsed.data;

    if (!canonicalProfileId || !duplicateProfileId || !justification || justification.trim().length < 5) {
      return NextResponse.json(
        { error: 'canonicalProfileId, duplicateProfileId, and written justification (min 5 chars) are required' },
        { status: 400 }
      );
    }

    if (canonicalProfileId === duplicateProfileId) {
      return NextResponse.json({ error: 'Cannot merge a profile into itself' }, { status: 400 });
    }

    // 1. Verify both profiles exist
    const [canonical] = await db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.id, canonicalProfileId))
      .limit(1);

    const [duplicate] = await db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.id, duplicateProfileId))
      .limit(1);

    if (!canonical || !duplicate) {
      return NextResponse.json({ error: 'One or both patient profiles not found' }, { status: 404 });
    }

    // 2. Reassign clinical records from duplicate to canonical (NON-DESTRUCTIVE)
    await db
      .update(cases)
      .set({ profileId: canonicalProfileId })
      .where(eq(cases.profileId, duplicateProfileId));

    await db
      .update(prescriptions)
      .set({ profileId: canonicalProfileId })
      .where(eq(prescriptions.profileId, duplicateProfileId));

    await db
      .update(patientReports)
      .set({ profileId: canonicalProfileId })
      .where(eq(patientReports.profileId, duplicateProfileId));

    await db
      .update(patientSchedules)
      .set({ profileId: canonicalProfileId })
      .where(eq(patientSchedules.profileId, duplicateProfileId));

    await db
      .update(accessGrants)
      .set({ profileId: canonicalProfileId })
      .where(eq(accessGrants.profileId, duplicateProfileId));

    await db
      .update(medicineIntakeLogs)
      .set({ profileId: canonicalProfileId })
      .where(eq(medicineIntakeLogs.profileId, duplicateProfileId));

    // 3. Union Health Summaries into canonical profile
    const [canonicalSummary] = await db
      .select()
      .from(profileHealthSummary)
      .where(eq(profileHealthSummary.profileId, canonicalProfileId))
      .orderBy(desc(profileHealthSummary.version))
      .limit(1);

    const [duplicateSummary] = await db
      .select()
      .from(profileHealthSummary)
      .where(eq(profileHealthSummary.profileId, duplicateProfileId))
      .orderBy(desc(profileHealthSummary.version))
      .limit(1);

    const canonicalAllergies = (canonicalSummary?.allergies as string[]) || [];
    const duplicateAllergies = (duplicateSummary?.allergies as string[]) || [];
    const mergedAllergies = Array.from(new Set([...canonicalAllergies, ...duplicateAllergies]));

    const canonicalConditions = (canonicalSummary?.chronicConditions as string[]) || [];
    const duplicateConditions = (duplicateSummary?.chronicConditions as string[]) || [];
    const mergedConditions = Array.from(new Set([...canonicalConditions, ...duplicateConditions]));

    const canonicalMeds = (canonicalSummary?.currentMedicines as Array<{ brand: string; generic: string; dose?: string }>) || [];
    const duplicateMeds = (duplicateSummary?.currentMedicines as Array<{ brand: string; generic: string; dose?: string }>) || [];
    const mergedMeds = [...canonicalMeds];
    for (const dm of duplicateMeds) {
      if (!mergedMeds.some((cm) => cm.brand.toLowerCase() === dm.brand.toLowerCase())) {
        mergedMeds.push(dm);
      }
    }

    const nextVersion = (canonicalSummary?.version || 0) + 1;
    await db.insert(profileHealthSummary).values({
      profileId: canonicalProfileId,
      version: nextVersion,
      allergies: mergedAllergies,
      chronicConditions: mergedConditions,
      currentMedicines: mergedMeds,
      bloodGroup: canonicalSummary?.bloodGroup || duplicateSummary?.bloodGroup || canonical.bloodGroup || duplicate.bloodGroup,
      updatedBy: user.id,
      changeReason: `Merged records from duplicate profile ${duplicateProfileId}: ${justification.trim()}`,
    });

    // 4. Mark duplicate profile as merged (never delete)
    await db
      .update(patientProfiles)
      .set({
        relation: 'merged',
        claimed: false,
        updatedAt: new Date(),
      })
      .where(eq(patientProfiles.id, duplicateProfileId));

    // 5. Audit log
    await recordAuditLog({
      userId: user.id,
      event: 'patient_profile_merged',
      payload: {
        canonicalProfileId,
        duplicateProfileId,
        justification: justification.trim(),
      },
    });

    await recordAccessLog({
      userId: user.id,
      profileId: canonicalProfileId,
      userRole: 'super_admin',
      action: 'profile_merge',
      recordType: 'patient_profile',
      recordId: duplicateProfileId,
      reason: `Merged duplicate profile into canonical profile: ${justification.trim()}`,
    });

    return NextResponse.json({
      success: true,
      message: 'প্রোফাইল দুটি সফলভাবে মার্জ (একত্রিত) করা হয়েছে (Profiles merged successfully)',
      canonicalProfileId,
      duplicateProfileId,
    });
  } catch (error) {
    console.error('Patient profile merge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
