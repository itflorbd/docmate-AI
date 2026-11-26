import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import {
  patientAccounts,
  patientProfiles,
  profileHealthSummary,
  accessGrants,
  accessLogs,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { canUse } from '@/lib/permissions';
import { normalizeBangladeshiPhone } from '@/lib/phone';
import { encryptPatientPii, decryptPatientPii } from '@/lib/encryption';
import { withIdempotency } from '@/lib/idempotency';
import { createAuditLogEntry } from '@/lib/audit';

const createProfileSchema = z.object({
  phone: z.string().min(8).max(30),
  name: z.string().min(2).max(100),
  age: z.number().int().min(0).max(130),
  gender: z.enum(['male', 'female', 'other']),
  relation: z.enum(['self', 'child', 'spouse', 'parent', 'other']).default('self'),
  bloodGroup: z.string().max(10).optional().default(''),
  emergencyContact: z.string().max(200).optional().default(''),
  consentObtained: z.boolean().refine((val) => val === true, {
    message: 'Patient data consent is mandatory',
  }),
  allergies: z.array(z.string().max(100)).optional().default([]),
  chronicConditions: z.array(z.string().max(100)).optional().default([]),
  currentMedicines: z.array(z.any()).optional().default([]),
  confirmDuplicate: z.boolean().optional().default(false),
  idempotencyKey: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'doctor' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Doctor access required' }, { status: 403 });
    }

    const permission = await canUse(user, 'patients.manage');
    if (!permission.allowed && user.role !== 'super_admin') {
      return NextResponse.json({ error: `Access denied: ${permission.reason}` }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const norm = normalizeBangladeshiPhone(data.phone);
    if (!norm.isValid) {
      return NextResponse.json(
        { error: norm.error || 'সঠিক ফোন নম্বর প্রদান করুন (Invalid phone number)' },
        { status: 400 }
      );
    }

    const phoneE164 = norm.e164;

    // Use idempotency wrapper
    return await withIdempotency(data.idempotencyKey, '/api/patient/profile', async () => {
      // 1. Locate or create patient_account
      let accountId: string;
      const [existingAcc] = await db
        .select({ id: patientAccounts.id })
        .from(patientAccounts)
        .where(eq(patientAccounts.phone, phoneE164))
        .limit(1);

      if (existingAcc) {
        accountId = existingAcc.id;

        // 2. Check for duplicate profiles under this account
        if (!data.confirmDuplicate) {
          const profilesUnderAcc = await db
            .select()
            .from(patientProfiles)
            .where(eq(patientProfiles.accountId, accountId));

          const cleanNewName = data.name.trim().toLowerCase();
          for (const existingProf of profilesUnderAcc) {
            let plainExisting = existingProf.name;
            if (!plainExisting && existingProf.nameEncrypted) {
              try {
                plainExisting = decryptPatientPii(existingProf.nameEncrypted);
              } catch {
                plainExisting = '';
              }
            }

            const cleanExistingName = (plainExisting || '').trim().toLowerCase();
            const ageDiff = Math.abs((existingProf.age || 0) - data.age);

            // If same name or close name and age within 2 years, trigger duplicate warning
            if (
              (cleanNewName === cleanExistingName ||
                cleanNewName.includes(cleanExistingName) ||
                cleanExistingName.includes(cleanNewName)) &&
              ageDiff <= 2
            ) {
              return NextResponse.json(
                {
                  duplicateWarning: true,
                  message: `এই ফোন নম্বরে একই বা কাছাকাছি নামের রোগী (${plainExisting}, বয়স: ${existingProf.age}) আগে থেকেই রয়েছে। আপনি কি নিশ্চিত যে এটি নতুন কোনো রোগী?`,
                  existingProfile: {
                    id: existingProf.id,
                    name: plainExisting,
                    age: existingProf.age,
                    gender: existingProf.gender || existingProf.sex,
                    relation: existingProf.relation,
                  },
                },
                { status: 409 }
              );
            }
          }
        }
      } else {
        const [newAcc] = await db
          .insert(patientAccounts)
          .values({
            phone: phoneE164,
            phoneNormalized: phoneE164,
          })
          .returning({ id: patientAccounts.id });
        accountId = newAcc.id;
      }

      // 3. Insert patient profile
      const [newProfile] = await db
        .insert(patientProfiles)
        .values({
          accountId,
          relation: data.relation,
          name: data.name.trim(),
          nameEncrypted: encryptPatientPii(data.name.trim()),
          age: data.age,
          gender: data.gender,
          sex: data.gender,
          bloodGroup: data.bloodGroup || null,
          createdBy: user.id,
          claimed: false,
        })
        .returning();

      // 4. Create initial profile health summary (version 1)
      await db.insert(profileHealthSummary).values({
        profileId: newProfile.id,
        version: 1,
        allergies: data.allergies,
        chronicConditions: data.chronicConditions,
        currentMedicines: data.currentMedicines,
        bloodGroup: data.bloodGroup || null,
        updatedBy: user.id,
        changeReason: 'Initial patient profile creation by physician',
      });

      // 5. Create automatic access grant for authoring doctor
      await db.insert(accessGrants).values({
        profileId: newProfile.id,
        doctorId: user.id,
        scope: 'this_doctor_only',
        status: 'active',
        grantedVia: 'created_profile',
      });

      // 6. Audit logs
      await createAuditLogEntry({
        userId: user.id,
        event: 'PATIENT_PROFILE_CREATED',
        payload: {
          profileId: newProfile.id,
          phone: phoneE164,
          name: data.name.trim(),
          age: data.age,
          gender: data.gender,
        },
      });

      await db.insert(accessLogs).values({
        userId: user.id,
        profileId: newProfile.id,
        userRole: user.role,
        action: 'PROFILE_CREATED',
        recordType: 'patient_profile',
        recordId: newProfile.id,
        reason: 'Physician created patient profile and received author grant',
      });

      return NextResponse.json(
        {
          success: true,
          profile: {
            id: newProfile.id,
            accountId,
            name: newProfile.name,
            age: newProfile.age,
            gender: newProfile.gender,
            bloodGroup: newProfile.bloodGroup,
            relation: newProfile.relation,
          },
        },
        { status: 201 }
      );
    });
  } catch (error) {
    console.error('Error creating patient profile:', error);
    return NextResponse.json({ error: 'Failed to create patient profile' }, { status: 500 });
  }
}
