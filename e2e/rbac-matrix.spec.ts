// Role access matrix for sensitive pages and APIs.
//   DOCMATE_QA_BASE_URL=http://127.0.0.1:3140 npx playwright test e2e/rbac-matrix.spec.ts
// Uses the seeded synthetic demo accounts.

import { expect, request, test } from '@playwright/test';

const BASE = process.env.DOCMATE_QA_BASE_URL || 'http://localhost:3000';
const ACCOUNTS = {
  doctor: 'doctor@docmate.ai',
  patient: 'patient@docmate.ai',
  student: 'student@docmate.ai',
  researcher: 'researcher@docmate.ai',
  controller: 'controller@docmate.ai',
  admin: 'admin@docmate.ai',
} as const;
type Role = keyof typeof ACCOUNTS;

// API GET routes and the roles that may read them. Everyone else must get 401/403.
const API: Record<string, Role[]> = {
  '/api/cases': ['doctor'],
  '/api/patients': ['doctor'],
  '/api/patient/portal': ['patient'],
  '/api/patient/prescriptions': ['patient'],
  '/api/patient/reports': ['patient'],
  '/api/research/search': ['researcher'],
  '/api/research/collections': ['researcher'],
  '/api/study/cases': ['student'],
  '/api/study/notes': ['student'],
  '/api/library/sources': ['doctor', 'student', 'researcher', 'controller', 'admin'],
  '/api/medicines/search': ['doctor', 'student', 'researcher', 'controller', 'admin'],
  '/api/controller/medicines': ['controller', 'admin'],
  '/api/admin/users': ['admin'],
  '/api/admin/audit': ['admin'],
};

// Pages and the roles that may open them. Others are redirected.
const PAGES: Record<string, Role[]> = {
  dashboard: ['doctor'],
  cases: ['doctor'],
  patients: ['doctor'],
  'prescriptions/new': ['doctor'],
  portal: ['patient'],
  study: ['student'],
  research: ['researcher'],
  controller: ['controller', 'admin'],
  admin: ['admin'],
  library: ['doctor', 'student', 'researcher', 'controller', 'admin'],
  settings: ['doctor', 'patient', 'student', 'researcher', 'controller', 'admin'],
};

for (const role of Object.keys(ACCOUNTS) as Role[]) {
  test(`role matrix: ${role}`, async () => {
    const context = await request.newContext({ baseURL: BASE });
    const login = await context.post('/api/auth/login', { data: { email: ACCOUNTS[role], password: 'demo123' } });
    expect(login.ok()).toBeTruthy();

    const problems: string[] = [];
    for (const [url, allowed] of Object.entries(API)) {
      const status = (await context.get(url)).status();
      const ok = allowed.includes(role) ? status === 200 : status === 401 || status === 403;
      if (!ok) problems.push(`${url} -> ${status}`);
    }
    for (const [page, allowed] of Object.entries(PAGES)) {
      const res = await context.get(`/en/${page}`, { maxRedirects: 0 });
      const ok = allowed.includes(role) ? res.status() === 200 : res.status() === 307;
      if (!ok) problems.push(`/en/${page} -> ${res.status()}`);
    }
    expect(problems).toEqual([]);
    await context.dispose();
  });
}

test('signed-out visitors get 401 from APIs and are sent to login', async () => {
  const context = await request.newContext({ baseURL: BASE });
  for (const url of Object.keys(API)) expect([401, 403]).toContain((await context.get(url)).status());
  const res = await context.get('/en/dashboard', { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain('/login');
  await context.dispose();
});
