import { describe, it, expect, beforeAll } from 'vitest';
import proxy, { getRoleDefaultPath, isRouteAllowedForRole } from '@/proxy';
import { createSessionToken, COOKIE_NAME } from '@/lib/session';
import { NextRequest } from 'next/server';

beforeAll(() => {
  process.env.AUTH_SECRET = 'a_very_secure_secret_for_tests_that_is_long_enough_1234567890';
});

describe('Role-Wise Panel Redirection & Middleware RBAC Enforcement', () => {
  describe('1. Role Default Panel Resolution (getRoleDefaultPath)', () => {
    it('resolves super_admin / admin to /admin control plane', () => {
      expect(getRoleDefaultPath('super_admin')).toBe('/admin');
      expect(getRoleDefaultPath('admin')).toBe('/admin');
    });

    it('resolves doctor to /dashboard', () => {
      expect(getRoleDefaultPath('doctor')).toBe('/dashboard');
    });

    it('resolves student to /study (trainee learning workspace)', () => {
      expect(getRoleDefaultPath('student')).toBe('/study');
    });

    it('resolves researcher to /research and medicine_controller to /controller', () => {
      expect(getRoleDefaultPath('researcher')).toBe('/research');
      expect(getRoleDefaultPath('medicine_controller')).toBe('/controller');
    });

    it('resolves patient to /portal (patient health portal)', () => {
      expect(getRoleDefaultPath('patient')).toBe('/portal');
    });

    it('falls back safely to /dashboard for unknown roles', () => {
      expect(getRoleDefaultPath('unknown')).toBe('/dashboard');
    });
  });

  describe('2. Route Permissions per Role (isRouteAllowedForRole)', () => {
    it('grants super_admin the control plane but not clinical or patient workspaces', () => {
      for (const route of ['admin', 'admin/users', 'controller', 'library', 'ask', 'settings']) {
        expect(isRouteAllowedForRole(route, 'super_admin')).toBe(true);
      }
      for (const route of ['dashboard', 'patients', 'prescriptions/new', 'cases', 'portal', 'study', 'research']) {
        expect(isRouteAllowedForRole(route, 'super_admin')).toBe(false);
      }
    });

    it('grants doctor clinical routes but blocks /admin control plane', () => {
      expect(isRouteAllowedForRole('dashboard', 'doctor')).toBe(true);
      expect(isRouteAllowedForRole('patients', 'doctor')).toBe(true);
      expect(isRouteAllowedForRole('patients/new', 'doctor')).toBe(true);
      expect(isRouteAllowedForRole('prescriptions', 'doctor')).toBe(true);
      expect(isRouteAllowedForRole('cases', 'doctor')).toBe(true);
      expect(isRouteAllowedForRole('library', 'doctor')).toBe(true);
      expect(isRouteAllowedForRole('ask', 'doctor')).toBe(true);
      expect(isRouteAllowedForRole('settings', 'doctor')).toBe(true);
      // Other roles' workspaces load data the doctor may not read.
      expect(isRouteAllowedForRole('study', 'doctor')).toBe(false);
      expect(isRouteAllowedForRole('research', 'doctor')).toBe(false);
      expect(isRouteAllowedForRole('portal', 'doctor')).toBe(false);
      expect(isRouteAllowedForRole('controller', 'doctor')).toBe(false);

      // Blocked
      expect(isRouteAllowedForRole('admin', 'doctor')).toBe(false);
      expect(isRouteAllowedForRole('admin/users', 'doctor')).toBe(false);
    });

    it('strictly isolates student to learning (blocks all patient & clinical data)', () => {
      expect(isRouteAllowedForRole('study', 'student')).toBe(true);
      expect(isRouteAllowedForRole('ask', 'student')).toBe(true);
      expect(isRouteAllowedForRole('library', 'student')).toBe(true);
      expect(isRouteAllowedForRole('settings', 'student')).toBe(true);

      // Forbidden
      expect(isRouteAllowedForRole('dashboard', 'student')).toBe(false);
      expect(isRouteAllowedForRole('patients', 'student')).toBe(false);
      expect(isRouteAllowedForRole('patients/new', 'student')).toBe(false);
      expect(isRouteAllowedForRole('prescriptions', 'student')).toBe(false);
      expect(isRouteAllowedForRole('cases', 'student')).toBe(false);
      expect(isRouteAllowedForRole('portal', 'student')).toBe(false);
      expect(isRouteAllowedForRole('admin', 'student')).toBe(false);
    });

    it('strictly isolates researcher and controller from patient data while allowing appropriate workspaces', () => {
      // Researcher
      expect(isRouteAllowedForRole('research', 'researcher')).toBe(true);
      expect(isRouteAllowedForRole('library', 'researcher')).toBe(true);
      expect(isRouteAllowedForRole('ask', 'researcher')).toBe(true);
      expect(isRouteAllowedForRole('settings', 'researcher')).toBe(true);
      expect(isRouteAllowedForRole('controller', 'researcher')).toBe(false);
      expect(isRouteAllowedForRole('dashboard', 'researcher')).toBe(false);
      expect(isRouteAllowedForRole('patients', 'researcher')).toBe(false);
      expect(isRouteAllowedForRole('prescriptions', 'researcher')).toBe(false);
      expect(isRouteAllowedForRole('portal', 'researcher')).toBe(false);

      // Medicine Controller
      expect(isRouteAllowedForRole('controller', 'medicine_controller')).toBe(true);
      expect(isRouteAllowedForRole('library', 'medicine_controller')).toBe(true);
      expect(isRouteAllowedForRole('ask', 'medicine_controller')).toBe(true);
      expect(isRouteAllowedForRole('settings', 'medicine_controller')).toBe(true);
      expect(isRouteAllowedForRole('dashboard', 'medicine_controller')).toBe(false);
      expect(isRouteAllowedForRole('patients', 'medicine_controller')).toBe(false);
      expect(isRouteAllowedForRole('prescriptions', 'medicine_controller')).toBe(false);
      expect(isRouteAllowedForRole('portal', 'medicine_controller')).toBe(false);
      expect(isRouteAllowedForRole('admin', 'medicine_controller')).toBe(false);
    });

    it('isolates patient to the portal and settings', () => {
      expect(isRouteAllowedForRole('portal', 'patient')).toBe(true);
      expect(isRouteAllowedForRole('settings', 'patient')).toBe(true);
      // Patients see prescriptions inside the portal; the editor is for doctors.
      expect(isRouteAllowedForRole('prescriptions', 'patient')).toBe(false);
      expect(isRouteAllowedForRole('prescriptions/new', 'patient')).toBe(false);

      expect(isRouteAllowedForRole('dashboard', 'patient')).toBe(false);
      expect(isRouteAllowedForRole('patients', 'patient')).toBe(false);
      expect(isRouteAllowedForRole('cases', 'patient')).toBe(false);
      expect(isRouteAllowedForRole('library', 'patient')).toBe(false);
      expect(isRouteAllowedForRole('ask', 'patient')).toBe(false);
      expect(isRouteAllowedForRole('study', 'patient')).toBe(false);
      expect(isRouteAllowedForRole('research', 'patient')).toBe(false);
      expect(isRouteAllowedForRole('admin', 'patient')).toBe(false);
    });
  });

  describe('3. Next.js 16 Proxy Execution & HTTP Redirection', () => {
    it('redirects unauthenticated users to /login with callbackUrl on protected routes', async () => {
      const protectedUrls = [
        'http://localhost:3000/en/admin',
        'http://localhost:3000/en/dashboard',
        'http://localhost:3000/en/patients',
        'http://localhost:3000/en/prescriptions',
      ];

      for (const urlStr of protectedUrls) {
        const req = new NextRequest(new URL(urlStr));
        const res = await proxy(req);

        expect(res.status).toBeGreaterThanOrEqual(300);
        expect(res.status).toBeLessThan(400);

        const location = res.headers.get('location') || '';
        expect(location).toContain('/login');
        expect(location).toContain('callbackUrl');
      }
    });

    it('redirects already logged-in users away from /login to their designated role panel', async () => {
      const testCases = [
        { role: 'super_admin', expectedTarget: '/en/admin' },
        { role: 'doctor', expectedTarget: '/en/dashboard' },
        { role: 'student', expectedTarget: '/en/study' },
        { role: 'researcher', expectedTarget: '/en/research' },
        { role: 'patient', expectedTarget: '/en/portal' },
      ];

      for (const tc of testCases) {
        const token = await createSessionToken({
          id: '11111111-1111-4111-8111-111111111111',
          email: `${tc.role}@docmate.ai`,
          role: tc.role as 'super_admin' | 'doctor' | 'student' | 'researcher' | 'patient',
          name: 'Test User',
        });

        const req = new NextRequest(new URL('http://localhost:3000/en/login'), {
          headers: {
            cookie: `${COOKIE_NAME}=${token}`,
          },
        });

        const res = await proxy(req);
        expect(res.status).toBeGreaterThanOrEqual(300);
        expect(res.status).toBeLessThan(400);

        const location = res.headers.get('location') || '';
        expect(location).toBe(`http://localhost:3000${tc.expectedTarget}`);
      }
    });

    it('redirects unauthorized roles accessing restricted panels to their primary panel', async () => {
      // 1. Student attempting to access /en/dashboard -> redirected to /en/study
      const studentToken = await createSessionToken({
        id: '22222222-2222-4222-8222-222222222222',
        email: 'student@docmate.ai',
        role: 'student',
        name: 'Student User',
      });
      const reqStudent = new NextRequest(new URL('http://localhost:3000/en/dashboard'), {
        headers: { cookie: `${COOKIE_NAME}=${studentToken}` },
      });
      const resStudent = await proxy(reqStudent);
      expect(resStudent.status).toBeGreaterThanOrEqual(300);
      expect(resStudent.headers.get('location')).toBe('http://localhost:3000/en/study');

      // 2. Doctor attempting to access /en/admin -> redirected to /en/dashboard
      const doctorToken = await createSessionToken({
        id: '33333333-3333-4333-8333-333333333333',
        email: 'doctor@docmate.ai',
        role: 'doctor',
        name: 'Doctor User',
      });
      const reqDoctor = new NextRequest(new URL('http://localhost:3000/en/admin'), {
        headers: { cookie: `${COOKIE_NAME}=${doctorToken}` },
      });
      const resDoctor = await proxy(reqDoctor);
      expect(resDoctor.status).toBeGreaterThanOrEqual(300);
      expect(resDoctor.headers.get('location')).toBe('http://localhost:3000/en/dashboard');

      // 3. Patient attempting to access /en/patients -> redirected to /en/portal
      const patientToken = await createSessionToken({
        id: '44444444-4444-4444-8444-444444444444',
        email: 'patient@docmate.ai',
        role: 'patient',
        name: 'Patient User',
      });
      const reqPatient = new NextRequest(new URL('http://localhost:3000/en/patients'), {
        headers: { cookie: `${COOKIE_NAME}=${patientToken}` },
      });
      const resPatient = await proxy(reqPatient);
      expect(resPatient.status).toBeGreaterThanOrEqual(300);
      expect(resPatient.headers.get('location')).toBe('http://localhost:3000/en/portal');
    });

    it('allows authorized users through to their respective panels without redirection', async () => {
      // Super admin on /en/admin
      const adminToken = await createSessionToken({
        id: '55555555-5555-4555-8555-555555555555',
        email: 'admin@docmate.ai',
        role: 'super_admin',
        name: 'Admin User',
      });
      const reqAdmin = new NextRequest(new URL('http://localhost:3000/en/admin'), {
        headers: { cookie: `${COOKIE_NAME}=${adminToken}` },
      });
      const resAdmin = await proxy(reqAdmin);
      expect(resAdmin.status).toBeLessThan(300);

      // Doctor on /en/dashboard
      const doctorToken = await createSessionToken({
        id: '66666666-6666-4666-8666-666666666666',
        email: 'doctor@docmate.ai',
        role: 'doctor',
        name: 'Doctor User',
      });
      const reqDoctor = new NextRequest(new URL('http://localhost:3000/en/dashboard'), {
        headers: { cookie: `${COOKIE_NAME}=${doctorToken}` },
      });
      const resDoctor = await proxy(reqDoctor);
      expect(resDoctor.status).toBeLessThan(300);

      // Student on /en/ask
      const studentToken = await createSessionToken({
        id: '77777777-7777-4777-8777-777777777777',
        email: 'student@docmate.ai',
        role: 'student',
        name: 'Student User',
      });
      const reqStudent = new NextRequest(new URL('http://localhost:3000/en/ask'), {
        headers: { cookie: `${COOKIE_NAME}=${studentToken}` },
      });
      const resStudent = await proxy(reqStudent);
      expect(resStudent.status).toBeLessThan(300);
    });
  });
});
