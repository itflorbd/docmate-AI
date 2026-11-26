import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { patientAccounts, patientProfiles, prescriptionItems, prescriptions, users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';

/**
 * Prescriptions delivered to the signed-in patient: finalized only, and only
 * for profiles on the patient's own account (matched by verified phone).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'patient') return NextResponse.json({ error: 'Patients only' }, { status: 403 });
    if (!user.phone) return NextResponse.json({ prescriptions: [] });

    const [account] = await db.select({ id: patientAccounts.id }).from(patientAccounts).where(eq(patientAccounts.phone, user.phone)).limit(1);
    if (!account) return NextResponse.json({ prescriptions: [] });
    const profiles = await db.select({ id: patientProfiles.id }).from(patientProfiles).where(eq(patientProfiles.accountId, account.id));
    if (profiles.length === 0) return NextResponse.json({ prescriptions: [] });

    const rxList = await db
      .select({
        id: prescriptions.id,
        rxNumber: prescriptions.rxNumber,
        diagnosis: prescriptions.diagnosis,
        investigations: prescriptions.investigations,
        generalAdvice: prescriptions.generalAdvice,
        followUpText: prescriptions.followUpText,
        status: prescriptions.status,
        qrHash: prescriptions.qrHash,
        finalizedAt: prescriptions.finalizedAt,
        doctorName: users.name,
        doctorBmdc: users.bmdcNumber,
      })
      .from(prescriptions)
      .leftJoin(users, eq(prescriptions.doctorId, users.id))
      .where(and(inArray(prescriptions.profileId, profiles.map((profile) => profile.id)), eq(prescriptions.status, 'finalized')))
      .orderBy(desc(prescriptions.createdAt));

    const fullPrescriptions = await Promise.all(
      rxList.map(async (rx) => ({
        ...rx,
        items: await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, rx.id)).orderBy(prescriptionItems.createdAt),
      })),
    );
    return NextResponse.json({ prescriptions: fullPrescriptions });
  } catch (error) {
    console.error('Patient prescriptions fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
