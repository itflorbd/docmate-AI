import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { medicineIntakeLogs, patientSchedules } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requirePatientScope } from '@/lib/patient-scope';

const intakeSchema = z.object({
  profileId: z.uuid(),
  prescriptionItemId: z.uuid().optional().nullable(),
  scheduleId: z.string().max(120).optional().nullable(),
  slot: z.enum(['morning', 'noon', 'night']).default('morning'),
});

export async function POST(req: Request) {
  try {
    const scope = await requirePatientScope();
    if (scope instanceof NextResponse) return scope;

    const parsed = intakeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the form and try again.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { profileId, prescriptionItemId, scheduleId, slot } = parsed.data;

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }
    if (!scope.owns(profileId)) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Insert into medicine_intake_logs
    const [log] = await db
      .insert(medicineIntakeLogs)
      .values({
        profileId,
        prescriptionItemId: prescriptionItemId || null,
        slot: slot || 'morning',
        takenAt: new Date(),
      })
      .returning();

    // If scheduleId provided from patientSchedules, update it
    if (scheduleId && !scheduleId.startsWith('rx-')) {
      await db
        .update(patientSchedules)
        .set({
          takenToday: true,
          lastTakenAt: new Date(),
        })
        .where(and(eq(patientSchedules.id, scheduleId), eq(patientSchedules.profileId, profileId)));
    }

    return NextResponse.json({
      success: true,
      message: 'ওষুধ গ্রহণের রেকর্ড সংরক্ষিত হয়েছে (Dose recorded as taken)',
      intakeId: log.id,
      takenAt: log.takenAt.toISOString(),
    });
  } catch (error) {
    console.error('Medicine intake logging error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
