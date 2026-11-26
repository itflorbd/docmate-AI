import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { accessGrants, patientAccounts, patientProfiles, patientReports } from '@/db/schema';
import { recordAccessLog } from '@/lib/access-log';
import { getCurrentUser } from '@/lib/auth';
import { normalizeBangladeshiPhone } from '@/lib/phone';
import { getStorageDriver } from '@/lib/storage';

const MIME: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg' };

/**
 * Serves a report file to its patient, or to a doctor with an active access
 * grant on that profile when the patient has shared the report.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [report] = await db.select().from(patientReports).where(eq(patientReports.id, id)).limit(1);
  if (!report?.profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let allowed = false;
  if (user.role === 'patient' && user.phone) {
    const norm = normalizeBangladeshiPhone(user.phone);
    const phoneMatch = norm.isValid && norm.e164
      ? or(eq(patientAccounts.phone, user.phone), eq(patientAccounts.phoneNormalized, norm.e164))
      : eq(patientAccounts.phone, user.phone);
    const [owner] = await db
      .select({ id: patientProfiles.id })
      .from(patientProfiles)
      .innerJoin(patientAccounts, eq(patientAccounts.id, patientProfiles.accountId))
      .where(and(eq(patientProfiles.id, report.profileId), phoneMatch))
      .limit(1);
    allowed = Boolean(owner);
  } else if (user.role === 'doctor' && report.isShared) {
    const [grant] = await db
      .select({ id: accessGrants.id })
      .from(accessGrants)
      .where(
        and(
          eq(accessGrants.profileId, report.profileId),
          eq(accessGrants.doctorId, user.id),
          eq(accessGrants.status, 'active'),
          or(isNull(accessGrants.expiresAt), gt(accessGrants.expiresAt, new Date())),
        ),
      )
      .limit(1);
    allowed = Boolean(grant);
  }
  if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // The upload route stores the file as <id>.<type> after checking its content.
  const storage = getStorageDriver();
  let ext = '';
  let buffer: Buffer | null = null;
  for (const candidate of Object.keys(MIME)) {
    buffer = await storage.get(`patient-reports/${report.profileId}/${report.id}.${candidate}`);
    if (buffer) {
      ext = candidate;
      break;
    }
  }
  // Reports uploaded by the earlier upload route are stored under their saved key.
  if (!buffer && report.fileUrl && !report.fileUrl.startsWith('/api/')) {
    buffer = await storage.get(report.fileUrl);
    ext = report.fileUrl.split('.').pop()?.toLowerCase().replace('jpeg', 'jpg') ?? '';
  }
  if (!buffer) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  await recordAccessLog({ userId: user.id, profileId: report.profileId, userRole: user.role, action: 'report_viewed', recordType: 'patient_report', recordId: report.id, reason: 'Report file opened' });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
