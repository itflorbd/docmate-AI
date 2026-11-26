import { db } from '@/db';
import { patientAccounts, patientProfiles, users } from '@/db/schema';
import { hashPassword } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import type { UserRole, UserStatus } from '@/types';

export interface DemoUserDef {
  email: string;
  name: string;
  role: UserRole;
  password: string;
  status: UserStatus;
  bmdcNumber?: string;
  phone?: string;
}

// 6 Persona demo accounts for DocMate AI
export const DEMO_USERS: DemoUserDef[] = [
  {
    email: 'admin@docmate.ai',
    name: 'Super Admin (DocMate Security)',
    role: 'super_admin',
    password: 'demo123',
    status: 'active',
  },
  {
    email: 'doctor@docmate.ai',
    name: 'Dr. Farhana Rahman (MBBS, FCPS)',
    role: 'doctor',
    password: 'demo123',
    status: 'active',
    bmdcNumber: 'A-12345',
  },
  {
    email: 'student@docmate.ai',
    name: 'Tanvir Ahmed (DMC Trainee)',
    role: 'student',
    password: 'demo123',
    status: 'active',
  },
  {
    email: 'researcher@docmate.ai',
    name: 'Dr. Shamim Hossain (Epidemiology Researcher)',
    role: 'researcher',
    password: 'demo123',
    status: 'active',
  },
  {
    email: 'patient@docmate.ai',
    name: 'Abdur Rahim (Patient)',
    role: 'patient',
    password: 'demo123',
    status: 'active',
    phone: '+8801712345678',
  },
  {
    email: 'controller@docmate.ai',
    name: 'DGDA Medicine Controller',
    role: 'medicine_controller',
    password: 'demo123',
    status: 'active',
  },
];

export async function seedDemoUsers() {
  let doctorId: string | undefined;

  for (const demo of DEMO_USERS) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, demo.email),
    });

    let id = existing?.id;
    const passwordHash = await hashPassword(demo.password);

    if (!existing) {
      const [created] = await db
        .insert(users)
        .values({
          email: demo.email,
          name: demo.name,
          role: demo.role,
          status: demo.status,
          passwordHash,
          bmdcNumber: demo.bmdcNumber || null,
          phone: demo.phone || null,
        })
        .returning({ id: users.id });
      id = created.id;
    } else {
      // Update existing user with updated role, status and attributes
      await db
        .update(users)
        .set({
          name: demo.name,
          role: demo.role,
          status: demo.status,
          bmdcNumber: demo.bmdcNumber ?? existing.bmdcNumber,
          phone: demo.phone ?? existing.phone,
          passwordHash,
        })
        .where(eq(users.id, existing.id));
    }

    if (demo.role === 'doctor') {
      doctorId = id;
    }

    // The demo patient gets their own synthetic account and self profile, so the
    // portal never needs to fall back to another patient's account.
    if (demo.role === 'patient' && demo.phone) {
      const [account] = await db
        .insert(patientAccounts)
        .values({ phone: demo.phone, phoneNormalized: demo.phone })
        .onConflictDoUpdate({ target: patientAccounts.phone, set: { updatedAt: new Date() } })
        .returning({ id: patientAccounts.id });
      const self = await db.query.patientProfiles.findFirst({ where: eq(patientProfiles.accountId, account.id) });
      if (!self) {
        await db.insert(patientProfiles).values({ accountId: account.id, relation: 'self', name: demo.name, age: 45, gender: 'male', claimed: true });
      }
    }
  }

  if (!doctorId) {
    throw new Error('Cannot assign fixtures to a demo physician.');
  }

  return doctorId;
}
