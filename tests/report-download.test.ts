import { beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { User } from '@/types';

let mockUser: User | null = null;
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => mockUser),
}));

const dbUrl = process.env.DATABASE_URL ?? '';
describe.runIf(/docmate_(integration|judges|treatment|test|gaps)/.test(dbUrl))('Task 7: Single report-download route /api/patient/reports/[id]/file', async () => {
  const { db } = await import('@/db');
  const schema = await import('@/db/schema');
  const { getStorageDriver } = await import('@/lib/storage');
  const { GET } = await import('@/app/api/patient/reports/[id]/file/route');

  const stamp = `${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  const phoneDigits = String(Date.now()).slice(-8);
  const ownerPhone = `+88019${phoneDigits}`;
  let doctorWithGrantId = '';
  let doctorWithoutGrantId = '';
  let patientUserId = '';
  let profileId = '';
  let sharedReportId = '';
  let privateReportId = '';

  beforeAll(async () => {
    const [docA] = await db
      .insert(schema.users)
      .values({ email: `rpt-doc-a-${stamp}@test.local`, passwordHash: 'x', role: 'doctor', name: 'Dr. Report A' })
      .returning();
    const [docB] = await db
      .insert(schema.users)
      .values({ email: `rpt-doc-b-${stamp}@test.local`, passwordHash: 'x', role: 'doctor', name: 'Dr. Report B' })
      .returning();
    const [patUser] = await db
      .insert(schema.users)
      .values({ email: `rpt-pat-${stamp}@test.local`, passwordHash: 'x', role: 'patient', name: 'Patient Report Owner', phone: ownerPhone })
      .returning();
    doctorWithGrantId = docA.id;
    doctorWithoutGrantId = docB.id;
    patientUserId = patUser.id;

    const [account] = await db
      .insert(schema.patientAccounts)
      .values({ phone: ownerPhone, phoneNormalized: ownerPhone })
      .returning();
    const [profile] = await db
      .insert(schema.patientProfiles)
      .values({ accountId: account.id, name: 'Synthetic Report Owner', age: 40, gender: 'female' })
      .returning();
    profileId = profile.id;

    await db.insert(schema.accessGrants).values({
      profileId,
      doctorId: doctorWithGrantId,
      scope: 'this_doctor_only',
      status: 'active',
    });

    const storage = getStorageDriver();
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

    sharedReportId = crypto.randomUUID();
    await storage.save(`patient-reports/${profileId}/${sharedReportId}.pdf`, pdfBytes, 'application/pdf');
    await db.insert(schema.patientReports).values({
      id: sharedReportId,
      profileId,
      title: 'Shared Lab Report',
      reportType: 'lab_test',
      fileName: 'shared-report.pdf',
      fileUrl: `/api/patient/reports/${sharedReportId}/file`,
      isShared: true,
    });

    privateReportId = crypto.randomUUID();
    await storage.save(`patient-reports/${profileId}/${privateReportId}.pdf`, pdfBytes, 'application/pdf');
    await db.insert(schema.patientReports).values({
      id: privateReportId,
      profileId,
      title: 'Private Lab Report',
      reportType: 'lab_test',
      fileName: 'private-report.pdf',
      fileUrl: `/api/patient/reports/${privateReportId}/file`,
      isShared: false,
    });
  });

  const makeUser = (overrides: Partial<User>): User => ({
    id: crypto.randomUUID(),
    email: 'test@test.local',
    role: 'student',
    name: 'Test User',
    status: 'active',
    created_at: new Date().toISOString(),
    ...overrides,
  });

  const callFile = (id: string) => GET(new Request(`http://localhost/api/patient/reports/${id}/file`), { params: Promise.resolve({ id }) });

  it('patient owner gets 200 for both private and shared reports and writes access_logs', async () => {
    mockUser = makeUser({ id: patientUserId, role: 'patient', phone: ownerPhone });
    const resPrivate = await callFile(privateReportId);
    expect(resPrivate.status).toBe(200);
    expect(resPrivate.headers.get('Content-Type')).toBe('application/pdf');

    const resShared = await callFile(sharedReportId);
    expect(resShared.status).toBe(200);

    const logs = await db
      .select()
      .from(schema.accessLogs)
      .where(and(eq(schema.accessLogs.recordId, sharedReportId), eq(schema.accessLogs.userId, patientUserId)));
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it('doctor with an active grant gets 200 for a shared report, and 404 for a private report', async () => {
    mockUser = makeUser({ id: doctorWithGrantId, role: 'doctor' });
    const resShared = await callFile(sharedReportId);
    expect(resShared.status).toBe(200);
    expect(resShared.headers.get('Content-Type')).toBe('application/pdf');

    const logs = await db
      .select()
      .from(schema.accessLogs)
      .where(and(eq(schema.accessLogs.recordId, sharedReportId), eq(schema.accessLogs.userId, doctorWithGrantId)));
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const resPrivate = await callFile(privateReportId);
    expect(resPrivate.status).toBe(404);
  });

  it('doctor without an active grant gets 404 even for a shared report', async () => {
    mockUser = makeUser({ id: doctorWithoutGrantId, role: 'doctor' });
    const res = await callFile(sharedReportId);
    expect(res.status).toBe(404);
  });

  it('every other role (student, researcher, medicine_controller, super_admin, other patient) gets 404', async () => {
    for (const role of ['student', 'researcher', 'medicine_controller', 'super_admin'] as const) {
      mockUser = makeUser({ role });
      const res = await callFile(sharedReportId);
      expect(res.status, `role ${role} must get 404`).toBe(404);
    }
    mockUser = makeUser({ role: 'patient', phone: '+8801700009999' });
    expect((await callFile(sharedReportId)).status).toBe(404);
  });
});
