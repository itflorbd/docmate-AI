import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db } from '@/db';
import { prescriptions, prescriptionItems, patients, encounters, cases } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { canUse, assertPatientDataScope } from '@/lib/permissions';
import { decryptPatientPii } from '@/lib/encryption';
import { createAuditLogEntry } from '@/lib/audit';
import { requirePrescriber } from '@/lib/prescription-safety-server';

const itemSchema = z.object({
  brandName: z.string().min(1).max(100),
  genericName: z.string().min(1).max(100),
  strength: z.string().min(1).max(50),
  form: z.string().max(50).default('Tab'),
  dosingSchedule: z.string().min(1).max(50),
  mealTiming: z.string().max(50).default('খাবারের পর'),
  durationDays: z.number().int().min(1).default(7),
  durationText: z.string().max(50).default('৭ দিন'),
  instructions: z.string().max(200).optional().default(''),
});

const prescriptionCreateSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  diagnosis: z.string().max(500).optional().default(''),
  investigations: z.array(z.string().max(100)).optional().default([]),
  generalAdvice: z.string().max(1000).optional().default(''),
  followUpText: z.string().max(100).optional().default(''),
  items: z.array(itemSchema).optional().default([]),
  // Prescriptions are saved as drafts. Finalizing goes through
  // POST /api/prescriptions/:id/finalize, which runs the safety decision.
  status: z.literal('draft').default('draft'),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const permission = await canUse(user, 'prescription.create');
    if (!permission.allowed && user.role !== 'patient' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Access denied: prescription.create required' }, { status: 403 });
    }

    const rxList = await db.query.prescriptions.findMany({
      // Patients only ever receive finalized prescriptions.
      where: user.role === 'patient'
        ? and(eq(prescriptions.patientId, user.id), eq(prescriptions.status, 'finalized'))
        : eq(prescriptions.doctorId, user.id),
      orderBy: [desc(prescriptions.createdAt)],
    });

    const enriched = await Promise.all(
      rxList.map(async (rx) => {
        const [patient] = await db
          .select()
          .from(patients)
          .where(eq(patients.id, rx.patientId))
          .limit(1);

        const items = await db.query.prescriptionItems.findMany({
          where: eq(prescriptionItems.prescriptionId, rx.id),
        });

        return {
          id: rx.id,
          rx_number: rx.rxNumber,
          diagnosis: rx.diagnosis,
          investigations: rx.investigations,
          general_advice: rx.generalAdvice,
          follow_up_text: rx.followUpText,
          status: rx.status,
          qr_hash: rx.qrHash,
          finalized_at: rx.finalizedAt,
          created_at: rx.createdAt,
          patient: patient
            ? {
                id: patient.id,
                patient_code: patient.patientCode,
                name: decryptPatientPii(patient.nameEncrypted),
                age: patient.age,
                gender: patient.gender,
              }
            : null,
          items_count: items.length,
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
        };
      })
    );

    return NextResponse.json({ prescriptions: enriched });
  } catch (err) {
    console.error('Error fetching prescriptions:', err);
    return NextResponse.json({ error: 'Failed to fetch prescriptions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePrescriber();
    if (user instanceof NextResponse) return user;

    const body = await request.json().catch(() => null);
    if (body?.status === 'finalized') {
      return NextResponse.json(
        { error: 'Save the prescription as a draft, then run the safety check and finalize it.', code: 'finalize_via_safety_check' },
        { status: 422 },
      );
    }
    const parsed = prescriptionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.format() }, { status: 400 });
    }

    const { patientId, encounterId, caseId, diagnosis, investigations, generalAdvice, followUpText, items, status } =
      parsed.data;

    const [patient] = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const scopeCheck = await assertPatientDataScope({
      user,
      caseDoctorId: patient.doctorId,
      patientId: patient.id,
    });
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: `Data scope violation: ${scopeCheck.reason}` }, { status: 403 });
    }

    // The encounter supplies allergies and current medicines for the safety
    // check, so it must belong to this patient.
    if (encounterId) {
      const [encounter] = await db.select({ patientId: encounters.patientId }).from(encounters).where(eq(encounters.id, encounterId)).limit(1);
      if (!encounter || encounter.patientId !== patientId) {
        return NextResponse.json({ error: 'Visit not found for this patient' }, { status: 404 });
      }
    }

    if (caseId) {
      const [linkedCase] = await db
        .select({ id: cases.id, doctorId: cases.doctorId })
        .from(cases)
        .where(eq(cases.id, caseId))
        .limit(1);
      if (!linkedCase || (linkedCase.doctorId !== user.id && user.role !== 'super_admin')) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }
    }

    // Random suffix: a per-doctor counter collides under concurrent saves.
    const rxNumber = `RX-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Generate cryptographic verification hash for QR code
    const qrSeed = `${rxNumber}-${patientId}-${user.id}-${Date.now()}`;
    const qrHash = crypto.createHash('sha256').update(qrSeed).digest('hex');

    const [newRx] = await db
      .insert(prescriptions)
      .values({
        patientId,
        encounterId: encounterId || null,
        caseId: caseId || null,
        doctorId: user.id,
        rxNumber,
        diagnosis,
        investigations,
        generalAdvice,
        followUpText,
        status,
        qrHash,
        finalizedAt: null,
      })
      .returning();

    // Insert prescription items
    if (items.length > 0) {
      await db.insert(prescriptionItems).values(
        items.map((it) => ({
          prescriptionId: newRx.id,
          brandName: it.brandName,
          genericName: it.genericName,
          strength: it.strength,
          form: it.form,
          dosingSchedule: it.dosingSchedule,
          mealTiming: it.mealTiming,
          durationDays: it.durationDays,
          durationText: it.durationText,
          instructions: it.instructions || '',
        }))
      );
    }

    await createAuditLogEntry({
      userId: user.id,
      event: 'PRESCRIPTION_DRAFT_SAVED',
      payload: {
        prescriptionId: newRx.id,
        rxNumber: newRx.rxNumber,
        patientId,
        itemsCount: items.length,
      },
    });

    return NextResponse.json(
      {
        prescription: {
          id: newRx.id,
          rx_number: newRx.rxNumber,
          status: newRx.status,
          qr_hash: newRx.qrHash,
          diagnosis: newRx.diagnosis,
          created_at: newRx.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating prescription:', err);
    return NextResponse.json({ error: 'Failed to create prescription' }, { status: 500 });
  }
}
