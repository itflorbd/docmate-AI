import crypto from 'node:crypto';
import { desc, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { patientReports } from '@/db/schema';
import { recordAuditLog } from '@/lib/audit';
import { requirePatientScope } from '@/lib/patient-scope';
import { getStorageDriver } from '@/lib/storage';

const MAX_BYTES = 10 * 1024 * 1024;
// Accepted files, identified by their first bytes, not by the name the browser sends.
const FILE_TYPES = [
  { ext: 'pdf', mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  { ext: 'png', mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'jpg', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
] as const;

const fieldsSchema = z.object({
  profileId: z.uuid(),
  title: z.string().trim().min(1).max(150),
  reportType: z.enum(['lab_test', 'imaging', 'prior_prescription', 'other']).default('lab_test'),
  notes: z.string().trim().max(1000).optional(),
});

/** The signed-in patient's reports, for one of their profiles or all of them. */
export async function GET(req: Request) {
  const scope = await requirePatientScope();
  if (scope instanceof NextResponse) return scope;
  const profileId = new URL(req.url).searchParams.get('profileId');
  if (profileId && !scope.owns(profileId)) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const ids = profileId ? [profileId] : scope.profiles.map((profile) => profile.id);
  if (ids.length === 0) return NextResponse.json({ reports: [] });
  const reports = await db
    .select()
    .from(patientReports)
    .where(inArray(patientReports.profileId, ids))
    .orderBy(desc(patientReports.uploadedAt));
  return NextResponse.json({ reports });
}

/** Uploads one report file (PDF, JPG or PNG, up to 10 MB) to the patient's own profile. Private by default. */
export async function POST(req: Request) {
  try {
    const scope = await requirePatientScope();
    if (scope instanceof NextResponse) return scope;

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
    const fields = fieldsSchema.safeParse({
      profileId: form.get('profileId'),
      title: form.get('title'),
      reportType: form.get('reportType') || undefined,
      notes: form.get('notes') || undefined,
    });
    if (!fields.success) {
      return NextResponse.json({ error: 'Please check the form and try again.', details: fields.error.flatten().fieldErrors }, { status: 400 });
    }
    if (!scope.owns(fields.data.profileId)) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'The file is larger than 10 MB.' }, { status: 413 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const type = FILE_TYPES.find((candidate) => candidate.magic.every((byte, index) => buffer[index] === byte));
    if (!type) return NextResponse.json({ error: 'Upload a PDF, JPG or PNG file.' }, { status: 415 });

    const id = crypto.randomUUID();
    const key = `patient-reports/${fields.data.profileId}/${id}.${type.ext}`;
    const storage = getStorageDriver();
    await storage.save(key, buffer, type.mime);

    try {
      const [report] = await db
        .insert(patientReports)
        .values({
          id,
          profileId: fields.data.profileId,
          title: fields.data.title,
          reportType: fields.data.reportType,
          fileUrl: `/api/patient/reports/${id}/file`,
          fileName: file.name.slice(0, 200) || `report.${type.ext}`,
          notes: fields.data.notes ?? null,
          // Shared with doctors only when the patient turns sharing on.
          isShared: false,
        })
        .returning();
      await recordAuditLog({ userId: scope.user.id, event: 'PATIENT_REPORT_UPLOADED', payload: { report_id: id, profile_id: fields.data.profileId, bytes: file.size, type: type.ext } });
      return NextResponse.json({ success: true, report }, { status: 201 });
    } catch (err) {
      // No record without a file, and no file without a record.
      await storage.delete(key).catch(() => undefined);
      throw err;
    }
  } catch (error) {
    console.error('Patient report upload error:', error);
    return NextResponse.json({ error: 'Upload failed. Try again.' }, { status: 500 });
  }
}

