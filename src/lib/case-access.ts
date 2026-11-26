import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cases } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { canUse } from '@/lib/permissions';

export async function requirePhysician() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  
  // Clinical records are for treating doctors. Administrators use the audited
  // break-glass path instead of browsing patient cases.
  if (user.role !== 'doctor') {
    return NextResponse.json({ error: 'Doctors only' }, { status: 403 });
  }

  // Verify feature capability (ensures unverified or suspended doctors cannot manage cases)
  const permission = await canUse(user, 'patients.manage');
  if (!permission.allowed) {
    return NextResponse.json(
      { error: `Access denied: ${permission.reason}` },
      { status: 403 }
    );
  }

  return user;
}

export function ownedCase(id: string, doctorId: string, role?: string) {
  if (role === 'admin' || role === 'super_admin') {
    return eq(cases.id, id);
  }
  return and(eq(cases.id, id), eq(cases.doctorId, doctorId));
}

export function validCaseId(id: string) {
  return z.uuid().safeParse(id).success;
}
