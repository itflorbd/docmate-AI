import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { caseTurns, cases, auditLogs } from '@/db/schema';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';
import { StructuredPatientInput } from '@/types';
import { ProposedUpdate } from '@/lib/clinical-extractor';
import { eq } from 'drizzle-orm';

const confirmSchema = z.object({
  turn_id: z.string().uuid(),
  update_id: z.string(),
  action: z.enum(['confirm', 'dismiss']),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const input = confirmSchema.safeParse(await boundedJson(request));
    if (!input.success) {
      return NextResponse.json({ error: 'Invalid update confirmation request' }, { status: 400 });
    }

    const { turn_id, update_id, action } = input.data;

    const result = await db.transaction(async (tx) => {
      const [caseRecord] = await tx
        .select()
        .from(cases)
        .where(ownedCase(id, user.id))
        .for('update');

      if (!caseRecord) return null;

      const [turnRecord] = await tx
        .select()
        .from(caseTurns)
        .where(eq(caseTurns.id, turn_id));

      if (!turnRecord || turnRecord.caseId !== id) return null;

      const content = turnRecord.content as Record<string, unknown>;
      const proposedUpdates = (content.proposed_updates as ProposedUpdate[]) || [];
      const targetUpdate = proposedUpdates.find((u) => u.id === update_id);

      if (!targetUpdate) return null;

      targetUpdate.status = action === 'confirm' ? 'confirmed' : 'dismissed';

      const updatedPatientInput = { ...((caseRecord.structuredInput as object) || {}) } as StructuredPatientInput;

      if (action === 'confirm') {
        const path = targetUpdate.field_path;
        const val = targetUpdate.value;

        if (path.startsWith('vitals.')) {
          const vitalKey = path.replace('vitals.', '');
          const currentVitals = { ...(updatedPatientInput.vitals || {}) };
          if (vitalKey === 'blood_pressure' && typeof val === 'string') {
            const [sys, dia] = val.split('/').map(Number);
            currentVitals.blood_pressure_systolic = sys;
            currentVitals.blood_pressure_diastolic = dia;
          } else {
            (currentVitals as Record<string, unknown>)[vitalKey] = val;
          }
          updatedPatientInput.vitals = currentVitals;
        } else if (path === 'symptoms' && typeof val === 'string') {
          const symptoms = [...(updatedPatientInput.symptoms || [])];
          if (!symptoms.includes(val)) {
            symptoms.push(val);
          }
          updatedPatientInput.symptoms = symptoms;
        } else if (path === 'allergies' && typeof val === 'string') {
          const allergies = [...(updatedPatientInput.allergies || [])];
          if (!allergies.includes(val)) {
            allergies.push(val);
          }
          updatedPatientInput.allergies = allergies;
        } else if (path === 'examination_findings') {
          updatedPatientInput.examination_findings = String(val);
        } else if (path === 'past_medical_history') {
          const pmh = [...(updatedPatientInput.past_medical_history || [])];
          if (!pmh.includes(String(val))) pmh.push(String(val));
          updatedPatientInput.past_medical_history = pmh;
        } else if (path === 'current_medicines') {
          const meds = [...(updatedPatientInput.current_medicines || [])];
          if (!meds.includes(String(val))) meds.push(String(val));
          updatedPatientInput.current_medicines = meds;
        } else if (path === 'clinical_notes') {
          updatedPatientInput.clinical_notes = `${updatedPatientInput.clinical_notes || ''}\n${String(val)}`.trim();
        } else if (path === 'lab_values' || path.startsWith('lab_values.')) {
          const labs = [...(updatedPatientInput.lab_values || [])];
          const testName = targetUpdate.label_en || path.replace('lab_values.', '');
          const existingIdx = labs.findIndex((l) => l.name.toLowerCase() === testName.toLowerCase());
          const rawValue = typeof val === 'object' && val !== null && 'value' in val ? (val as { value?: unknown }).value : val;
          const newLabItem = {
            name: testName,
            value: typeof rawValue === 'number' ? rawValue : String(rawValue ?? ''),
            unit: typeof val === 'object' && val !== null && 'unit' in val ? String((val as { unit?: unknown }).unit ?? '') : '',
          };
          if (existingIdx >= 0) {
            labs[existingIdx] = newLabItem;
          } else {
            labs.push(newLabItem);
          }
          updatedPatientInput.lab_values = labs;
        }

        // Persist updated structured patient input
        await tx
          .update(cases)
          .set({
            structuredInput: updatedPatientInput,
            updatedAt: new Date(),
          })
          .where(ownedCase(id, user.id));

        // Insert audit log event
        await tx.insert(auditLogs).values({
          caseId: id,
          userId: user.id,
          event: 'patient_record_updated',
          payload: {
            field: targetUpdate.field_path,
            value: targetUpdate.value,
            original_wording: targetUpdate.original_wording,
          },
        });

        // Insert case event turn
        await tx.insert(caseTurns).values({
          caseId: id,
          role: 'doctor',
          content: {
            type: 'case_event',
            event: 'patient_record_updated',
            description: `Applied ${targetUpdate.label_en}: ${targetUpdate.display_value}`,
            field: targetUpdate.field_path,
            value: targetUpdate.value,
          },
        });
      }

      // Update the turn record with updated status
      await tx
        .update(caseTurns)
        .set({
          content: {
            ...content,
            proposed_updates: proposedUpdates,
          },
        })
        .where(eq(caseTurns.id, turn_id));

      const [updatedCase] = await tx
        .select()
        .from(cases)
        .where(ownedCase(id, user.id));

      const [updatedTurn] = await tx
        .select()
        .from(caseTurns)
        .where(eq(caseTurns.id, turn_id));

      return {
        case: {
          ...updatedCase,
          patient_code: updatedCase.patientCode,
          structured_input: updatedCase.structuredInput,
          confirmed_diagnosis: updatedCase.confirmedDiagnosis,
          doctor_id: updatedCase.doctorId,
          created_at: updatedCase.createdAt,
          updated_at: updatedCase.updatedAt,
        },
        turn: updatedTurn,
      };
    });

    if (!result) {
      return NextResponse.json({ error: 'Update could not be applied' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: 'Failed to confirm clinical update' }, { status: 500 });
  }
}
