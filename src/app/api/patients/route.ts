import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { patients, encounters, patientAccounts, patientProfiles, accessGrants } from '@/db/schema';
import { desc, eq, or } from 'drizzle-orm';
import { requirePhysician } from '@/lib/case-access';
import { encryptPatientPii, decryptPatientPii } from '@/lib/encryption';
import { createAuditLogEntry } from '@/lib/audit';
import { normalizeBangladeshiPhone } from '@/lib/phone';

const patientCreateSchema = z.object({
  name: z.string().min(2).max(100),
  age: z.number().int().min(0).max(130),
  gender: z.enum(['male', 'female', 'other']),
  phone: z.string().max(30).optional().default(''),
  bloodGroup: z.string().max(10).optional().default(''),
  emergencyContact: z.string().max(200).optional().default(''),
  consentObtained: z.boolean().refine((val) => val === true, {
    message: 'Patient data consent is strictly mandatory',
  }),
  chiefComplaint: z.string().max(500).optional().default(''),
  symptoms: z.array(z.string().max(100)).optional().default([]),
  vitals: z
    .object({
      bpSystolic: z.number().optional(),
      bpDiastolic: z.number().optional(),
      pulse: z.number().optional(),
      tempF: z.number().optional(),
      weightKg: z.number().optional(),
      spo2: z.number().optional(),
    })
    .optional()
    .default({}),
  allergies: z.array(z.string().max(100)).optional().default([]),
  currentMedications: z.array(z.any()).optional().default([]),
  pastHistory: z.string().max(1000).optional().default(''),
});

export async function GET(request: Request) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase().trim() || '';

    const list = await db.query.patients.findMany({
      where: eq(patients.doctorId, user.id),
      orderBy: [desc(patients.updatedAt)],
    });

    const decrypted = list.map((p) => {
      const name = decryptPatientPii(p.nameEncrypted);
      const phone = decryptPatientPii(p.phoneEncrypted);
      return {
        id: p.id,
        patient_code: p.patientCode,
        name,
        phone,
        age: p.age,
        gender: p.gender,
        blood_group: p.bloodGroup,
        emergency_contact: p.emergencyContact,
        consent_obtained: p.consentObtained,
        consent_obtained_at: p.consentObtainedAt,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      };
    });

    let filtered = decrypted;
    if (search) {
      filtered = decrypted.filter(
        (p) =>
          p.patient_code.toLowerCase().includes(search) ||
          p.name.toLowerCase().includes(search) ||
          p.phone.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ patients: filtered });
  } catch (err) {
    console.error('Error fetching patients:', err);
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const parsed = patientCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      name,
      age,
      gender,
      phone,
      bloodGroup,
      emergencyContact,
      consentObtained,
      chiefComplaint,
      symptoms,
      vitals,
      allergies,
      currentMedications,
      pastHistory,
    } = parsed.data;

    // Generate unique patient code
    const existingCount = await db.query.patients.findMany({
      where: eq(patients.doctorId, user.id),
      columns: { id: true },
    });
    const seq = existingCount.length + 101;
    const patientCode = `P-${new Date().getFullYear()}-${seq}`;

    const [newPatient] = await db
      .insert(patients)
      .values({
        doctorId: user.id,
        patientCode,
        nameEncrypted: encryptPatientPii(name),
        phoneEncrypted: encryptPatientPii(phone),
        age,
        gender,
        bloodGroup: bloodGroup || null,
        emergencyContact: emergencyContact || null,
        consentObtained: Boolean(consentObtained),
        consentObtainedAt: new Date(),
      })
      .returning();

    // Auto-sync into patientAccounts and patientProfiles for instant New Intake lookup
    if (phone) {
      try {
        const norm = normalizeBangladeshiPhone(phone);
        if (norm.isValid) {
          let [acc] = await db
            .select({ id: patientAccounts.id })
            .from(patientAccounts)
            .where(
              or(
                eq(patientAccounts.phone, norm.e164),
                eq(patientAccounts.phoneNormalized, norm.e164)
              )
            )
            .limit(1);

          if (!acc) {
            [acc] = await db
              .insert(patientAccounts)
              .values({
                phone: norm.e164,
                phoneNormalized: norm.e164,
              })
              .returning();
          }

          const [prof] = await db
            .insert(patientProfiles)
            .values({
              accountId: acc.id,
              relation: 'self',
              name,
              nameEncrypted: encryptPatientPii(name),
              age,
              gender,
              sex: gender,
              bloodGroup: bloodGroup || null,
              createdBy: user.id,
              claimed: false,
            })
            .returning();

          await db
            .insert(accessGrants)
            .values({
              profileId: prof.id,
              doctorId: user.id,
              scope: 'this_doctor_only',
              status: 'active',
              grantedVia: 'created_profile',
            })
            .catch(() => {});
        }
      } catch (syncErr) {
        console.error('Failed to auto-sync patient into patientProfiles:', syncErr);
      }
    }

    let newEncounter = null;
    if (chiefComplaint || symptoms.length > 0 || Object.keys(vitals).length > 0) {
      [newEncounter] = await db
        .insert(encounters)
        .values({
          patientId: newPatient.id,
          doctorId: user.id,
          chiefComplaint: chiefComplaint || 'সাধারণ পরামর্শ (General Consultation)',
          symptoms,
          vitals,
          allergies,
          currentMedications,
          pastHistory,
          status: 'in_progress',
        })
        .returning();
    }

    await createAuditLogEntry({
      userId: user.id,
      event: 'PATIENT_RECORD_CREATED',
      payload: {
        patientId: newPatient.id,
        patientCode: newPatient.patientCode,
        consentObtained: true,
        hasInitialEncounter: Boolean(newEncounter),
      },
    });

    return NextResponse.json(
      {
        patient: {
          id: newPatient.id,
          patient_code: newPatient.patientCode,
          name,
          phone,
          age: newPatient.age,
          gender: newPatient.gender,
          blood_group: newPatient.bloodGroup,
          emergency_contact: newPatient.emergencyContact,
          consent_obtained: newPatient.consentObtained,
          created_at: newPatient.createdAt,
        },
        encounter: newEncounter,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating patient:', err);
    return NextResponse.json({ error: 'Failed to create patient record' }, { status: 500 });
  }
}
