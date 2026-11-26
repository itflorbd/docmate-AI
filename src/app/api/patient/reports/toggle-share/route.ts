import { NextResponse } from 'next/server';
import { db } from '@/db';
import { patientReports } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { recordAccessLog } from '@/lib/access-log';
import { requirePatientScope } from '@/lib/patient-scope';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Only the patient who owns the report's profile may change its sharing.
    const scope = await requirePatientScope();
    if (scope instanceof NextResponse) return scope;

    const body = await req.json();
    const { reportId, isShared } = body;

    if (!reportId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) {
      return NextResponse.json({ error: 'Valid reportId is required' }, { status: 400 });
    }

    const [report] = await db.select({ id: patientReports.id, profileId: patientReports.profileId }).from(patientReports).where(eq(patientReports.id, reportId)).limit(1);
    if (!report || !report.profileId || !scope.owns(report.profileId)) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    const { user } = scope;
    const nextShared = Boolean(isShared);

    const [updated] = await db
      .update(patientReports)
      .set({ isShared: nextShared })
      .where(eq(patientReports.id, reportId))
      .returning();

    await recordAccessLog({
      userId: user.id,
      profileId: report.profileId,
      userRole: user.role,
      action: nextShared ? 'report_shared_with_physicians' : 'report_made_private',
      recordType: 'patient_report',
      recordId: report.id,
      reason: nextShared ? 'Patient enabled doctor sharing' : 'Patient made report private',
    });

    return NextResponse.json({
      success: true,
      isShared: updated.isShared,
      message: updated.isShared
        ? 'রিপোর্টটি এখন ডাক্তারের সাথে শেয়ার করা হচ্ছে'
        : 'রিপোর্টটি ব্যক্তিগত (গোপনীয়) রাখা হয়েছে',
    });
  } catch (error) {
    console.error('[API /api/patient/reports/toggle-share POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
