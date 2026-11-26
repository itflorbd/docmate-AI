import { NextResponse } from 'next/server';
import { db } from '@/db';
import { prescriptions, prescriptionItems, patients, encounters, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { assertPatientDataScope } from '@/lib/permissions';
import { requirePrescriber } from '@/lib/prescription-safety-server';
import { z } from 'zod';
import { decryptPatientPii } from '@/lib/encryption';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: rxId } = await params;

    const [rx] = await db.select().from(prescriptions).where(eq(prescriptions.id, rxId)).limit(1);
    if (!rx) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    const [patient] = await db.select().from(patients).where(eq(patients.id, rx.patientId)).limit(1);
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Check data-scope
    const scopeCheck = await assertPatientDataScope({
      user,
      caseDoctorId: rx.doctorId,
      patientId: rx.patientId,
    });
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: `Access denied: ${scopeCheck.reason}` }, { status: 403 });
    }

    const [doctor] = await db.select().from(users).where(eq(users.id, rx.doctorId)).limit(1);

    let encounter = null;
    if (rx.encounterId) {
      [encounter] = await db.select().from(encounters).where(eq(encounters.id, rx.encounterId)).limit(1);
    }

    const items = await db.query.prescriptionItems.findMany({
      where: eq(prescriptionItems.prescriptionId, rx.id),
      orderBy: [prescriptionItems.createdAt],
    });

    return NextResponse.json({
      prescription: {
        id: rx.id,
        rx_number: rx.rxNumber,
        status: rx.status,
        // Official only when finalized under an approved clinical release.
        official: rx.status === 'finalized',
        diagnosis: rx.diagnosis,
        investigations: rx.investigations,
        general_advice: rx.generalAdvice,
        follow_up_text: rx.followUpText,
        qr_hash: rx.qrHash,
        finalized_at: rx.finalizedAt,
        created_at: rx.createdAt,
        patient: {
          id: patient.id,
          patient_code: patient.patientCode,
          name: decryptPatientPii(patient.nameEncrypted),
          phone: decryptPatientPii(patient.phoneEncrypted),
          age: patient.age,
          gender: patient.gender,
          blood_group: patient.bloodGroup,
        },
        doctor: doctor
          ? {
              id: doctor.id,
              name: doctor.name,
              // Only recorded credentials; never placeholder registration or hospital details.
              bmdc_number: doctor.bmdcNumber || null,
              phone: doctor.phone || null,
            }
          : null,
        encounter: encounter
          ? {
              chief_complaint: encounter.chiefComplaint,
              symptoms: encounter.symptoms,
              vitals: encounter.vitals,
              allergies: encounter.allergies,
            }
          : null,
        items: items.map((it) => ({
          id: it.id,
          brand_name: it.brandName,
          generic_name: it.genericName,
          strength: it.strength,
          form: it.form,
          dosing_schedule: it.dosingSchedule,
          meal_timing: it.mealTiming,
          duration_days: it.durationDays,
          duration_text: it.durationText,
          instructions: it.instructions,
        })),
      },
    });
  } catch (err) {
    console.error('Error fetching prescription details:', err);
    return NextResponse.json({ error: 'Failed to fetch prescription details' }, { status: 500 });
  }
}

const draftItemSchema = z.object({
  brandName: z.string().min(1).max(100),
  genericName: z.string().min(1).max(100),
  strength: z.string().min(1).max(50),
  form: z.string().max(50).default('Tab'),
  dosingSchedule: z.string().min(1).max(50),
  mealTiming: z.string().max(50).default('খাবারের পর'),
  durationDays: z.number().int().min(1).max(365).default(7),
  durationText: z.string().max(50).default('৭ দিন'),
  instructions: z.string().max(200).optional().default(''),
});

const draftUpdateSchema = z
  .object({
    diagnosis: z.string().max(500).optional(),
    investigations: z.array(z.string().max(100)).max(50).optional(),
    generalAdvice: z.string().max(1000).optional(),
    followUpText: z.string().max(100).optional(),
    items: z.array(draftItemSchema).max(30).optional(),
  })
  .strict();

/**
 * Updates a draft. Any change bumps updated_at and changes the regimen hash,
 * so earlier safety reviews and overrides no longer apply.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePrescriber();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    const parsed = draftUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.format() }, { status: 400 });

    const updated = await db.transaction(async (tx) => {
      const [rx] = await tx.select().from(prescriptions).where(eq(prescriptions.id, id)).for('update');
      if (!rx || rx.doctorId !== user.id) return 'missing' as const;
      if (rx.status !== 'draft') return 'final' as const;
      const { items, ...fields } = parsed.data;
      const [row] = await tx.update(prescriptions).set({ ...fields, updatedAt: new Date() }).where(eq(prescriptions.id, id)).returning();
      if (items) {
        await tx.delete(prescriptionItems).where(eq(prescriptionItems.prescriptionId, id));
        if (items.length) await tx.insert(prescriptionItems).values(items.map((item) => ({ ...item, prescriptionId: id, instructions: item.instructions || '' })));
      }
      return row;
    });
    if (updated === 'missing') return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    if (updated === 'final') return NextResponse.json({ error: 'A final prescription can’t be changed.' }, { status: 409 });
    return NextResponse.json({ prescription: { id: updated.id, status: updated.status, updated_at: updated.updatedAt } });
  } catch (err) {
    console.error('Error updating prescription draft:', err);
    return NextResponse.json({ error: 'Failed to update prescription' }, { status: 500 });
  }
}
