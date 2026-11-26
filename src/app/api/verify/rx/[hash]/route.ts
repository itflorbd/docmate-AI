import { NextResponse } from 'next/server';
import { db } from '@/db';
import { prescriptions, prescriptionItems, patients, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    if (!hash || hash.length !== 64) {
      return NextResponse.json({ error: 'Invalid prescription verification hash' }, { status: 400 });
    }

    const [rx] = await db.select().from(prescriptions).where(eq(prescriptions.qrHash, hash)).limit(1);
    if (!rx) {
      return NextResponse.json(
        { error: 'Prescription not found or invalid QR code', verified: false },
        { status: 404 }
      );
    }

    // Drafts were never issued. Reveal nothing about them.
    if (rx.status !== 'finalized') {
      return NextResponse.json({ verified: false, verification_status: 'NOT_ISSUED' }, { status: 404 });
    }

    const [doctor] = await db.select().from(users).where(eq(users.id, rx.doctorId)).limit(1);
    const [patient] = await db.select().from(patients).where(eq(patients.id, rx.patientId)).limit(1);
    const items = await db.query.prescriptionItems.findMany({
      where: eq(prescriptionItems.prescriptionId, rx.id),
      orderBy: [prescriptionItems.createdAt],
    });

    return NextResponse.json({
      verified: true,
      verification_status: 'AUTHENTIC_FINALIZED',
      rx_number: rx.rxNumber,
      issued_at: rx.finalizedAt || rx.createdAt,
      doctor: doctor
        ? {
            name: doctor.name,
            // Only recorded credentials; never a placeholder.
            bmdc_number: doctor.bmdcNumber || null,
          }
        : null,
      patient_summary: patient
        ? {
            patient_code: patient.patientCode,
            age: patient.age,
            gender: patient.gender,
          }
        : null,
      diagnosis: rx.diagnosis,
      items: items.map((it) => ({
        brand_name: it.brandName,
        generic_name: it.genericName,
        strength: it.strength,
        form: it.form,
        dosing_schedule: it.dosingSchedule,
        duration_text: it.durationText,
      })),
      verified_by: 'DocMate AI Clinical Decision Support Verification Gateway',
    });
  } catch (err) {
    console.error('Error verifying prescription hash:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
