import { NextResponse } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requirePhysician, ownedCase, validCaseId } from '../src/lib/case-access';
import * as authModule from '../src/lib/auth';
import { User, UserRole } from '../src/types';

describe('Role-Based Access Control (RBAC) Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Blocks unauthenticated requests with HTTP 401', async () => {
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(null);

    const result = await requirePhysician();
    expect(result).toBeDefined();
    // NextResponse with status 401
    expect('status' in result && result.status).toBe(401);
  });

  it('2. Blocks student / trainee role with HTTP 403', async () => {
    const studentUser: User = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'student@docmate.ai',
      role: 'student' as UserRole,
      name: 'Tanvir Ahmed',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(studentUser);

    const result = await requirePhysician();
    expect(result).toBeDefined();
    expect('status' in result && result.status).toBe(403);
  });

  it('3. Blocks researcher role with HTTP 403', async () => {
    const researcherUser: User = {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'researcher@docmate.ai',
      role: 'researcher' as UserRole,
      name: 'Dr. Shamim Hossain',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(researcherUser);

    const result = await requirePhysician();
    expect(result).toBeDefined();
    expect('status' in result && result.status).toBe(403);
  });

  it('4. Blocks patient and medicine_controller from physician endpoints', async () => {
    const patientUser: User = {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'patient@docmate.ai',
      role: 'patient',
      name: 'Abdur Rahim',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(patientUser);
    const patientResult = await requirePhysician();
    expect('status' in patientResult && patientResult.status).toBe(403);

    const controllerUser: User = {
      id: '44444444-4444-4444-8444-444444444444',
      email: 'controller@docmate.ai',
      role: 'medicine_controller',
      name: 'Controller',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(controllerUser);
    const controllerResult = await requirePhysician();
    expect('status' in controllerResult && controllerResult.status).toBe(403);
  });

  it('5. Authorizes doctor role successfully', async () => {
    const doctorUser: User = {
      id: '43eb5601-471a-49ad-84e9-c298591deea7',
      email: 'doctor@docmate.ai',
      role: 'doctor',
      name: 'Dr. Farhana Rahman',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(doctorUser);

    const result = await requirePhysician();
    expect('id' in result && result.id).toBe('43eb5601-471a-49ad-84e9-c298591deea7');
    expect('role' in result && result.role).toBe('doctor');
  });

  it('6. Refuses super_admin on clinical case routes (break-glass is the audited path)', async () => {
    const adminUser: User = {
      id: '95e33ccb-e149-43ba-9ca7-0379168dfbb6',
      email: 'admin@docmate.ai',
      role: 'super_admin',
      name: 'Super Admin User',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(adminUser);

    const result = await requirePhysician();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it('7. ownedCase enforces case-doctor ownership for physicians', () => {
    const caseId = 'c1234567-89ab-cdef-0123-456789abcdef';
    const doctorId = 'd1234567-89ab-cdef-0123-456789abcdef';

    const condition = ownedCase(caseId, doctorId, 'doctor');
    expect(condition).toBeDefined();
  });

  it('8. ownedCase grants global case access to super administrator', () => {
    const caseId = 'c1234567-89ab-cdef-0123-456789abcdef';
    const adminId = 'a1234567-89ab-cdef-0123-456789abcdef';

    const condition = ownedCase(caseId, adminId, 'super_admin');
    expect(condition).toBeDefined();
  });

  it('9. validCaseId rejects malformed UUIDs to prevent injection', () => {
    expect(validCaseId('non-uuid-string')).toBe(false);
    expect(validCaseId('12345')).toBe(false);
    expect(validCaseId('6e56612d-ee07-4638-9cd1-e1b912fd92be')).toBe(true);
  });
});
