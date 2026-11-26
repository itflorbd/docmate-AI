// Patient portal: real report upload, file access, sharing and access revocation.
//   DATABASE_URL=... DOCMATE_QA_BASE_URL=http://127.0.0.1:3140 npx playwright test e2e/patient-portal.spec.ts
// Synthetic demo accounts and files only.

import { expect, request, test } from '@playwright/test';
import { Pool } from 'pg';

const BASE = process.env.DOCMATE_QA_BASE_URL || 'http://localhost:3000';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function signIn(email: string) {
  const context = await request.newContext({ baseURL: BASE });
  expect((await context.post('/api/auth/login', { data: { email, password: 'demo123' } })).ok()).toBeTruthy();
  return context;
}

test('patient uploads a real file, only allowed people can open it, and revocation is audited', async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const patient = await signIn('patient@docmate.ai');
  const doctor = await signIn('doctor@docmate.ai');
  const student = await signIn('student@docmate.ai');

  const portal = await (await patient.get('/api/patient/portal')).json();
  const profileId: string = portal.profiles[0].id;

  // Wrong file type is refused by content, not by name.
  const fake = await patient.post('/api/patient/reports', {
    multipart: { profileId, title: 'Fake', file: { name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') } },
  });
  expect(fake.status()).toBe(415);

  const upload = await patient.post('/api/patient/reports', {
    multipart: { profileId, title: 'Synthetic CBC', reportType: 'lab_test', file: { name: 'cbc.pdf', mimeType: 'application/pdf', buffer: PDF } },
  });
  expect(upload.status()).toBe(201);
  const report = (await upload.json()).report;
  expect(report.isShared).toBe(false);

  const own = await patient.get(report.fileUrl);
  expect(own.status()).toBe(200);
  expect(own.headers()['content-type']).toBe('application/pdf');
  expect((await own.body()).subarray(0, 4).toString()).toBe('%PDF');

  // Private report: no doctor, student or anonymous access.
  expect((await doctor.get(report.fileUrl)).status()).toBe(404);
  expect((await student.get(report.fileUrl)).status()).toBe(404);
  expect((await (await request.newContext({ baseURL: BASE })).get(report.fileUrl)).status()).toBe(401);

  // Another role cannot change sharing, and a foreign profile is rejected.
  expect((await doctor.post('/api/patient/reports/toggle-share', { data: { reportId: report.id, isShared: true } })).status()).toBe(403);
  expect(
    (await patient.post('/api/patient/reports', {
      multipart: { profileId: '00000000-0000-4000-8000-000000000000', title: 'x', file: { name: 'a.pdf', mimeType: 'application/pdf', buffer: PDF } },
    })).status(),
  ).toBe(404);

  // Revocation: create an active grant for the demo doctor, then revoke it.
  const { rows: doctorRows } = await pool.query(`SELECT id FROM users WHERE email = 'doctor@docmate.ai'`);
  const { rows: grantRows } = await pool.query(
    `INSERT INTO access_grants (profile_id, doctor_id, scope, status, granted_via) VALUES ($1, $2, 'full_history', 'active', 'patient_portal') RETURNING id`,
    [profileId, doctorRows[0].id],
  );
  const grantId = grantRows[0].id;
  expect((await student.post('/api/patient/grants/revoke', { data: { grantId, profileId } })).status()).toBe(403);
  const revoke = await patient.post('/api/patient/grants/revoke', { data: { grantId, profileId } });
  expect(revoke.status()).toBe(200);
  const { rows: grantAfter } = await pool.query(`SELECT status FROM access_grants WHERE id = $1`, [grantId]);
  expect(grantAfter[0].status).toBe('revoked');
  const { rows: logs } = await pool.query(`SELECT count(*)::int AS n FROM patient_consent_logs WHERE profile_id = $1 AND action = 'revoked'`, [profileId]);
  expect(logs[0].n).toBeGreaterThan(0);
  expect((await patient.post('/api/patient/grants/revoke', { data: { grantId, profileId } })).status()).toBe(404);

  await pool.end();
});
