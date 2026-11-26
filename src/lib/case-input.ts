import { z } from 'zod';

const shortText = z.string().trim().min(1).max(250);
const note = z.string().trim().max(4000);
const list = z.array(shortText).max(40);
const vital = z.number().finite().nonnegative().max(350).optional();

export const caseInput = z.object({
  patient_code: z.string().trim().regex(/^P-(?:[0-9]+-)*[0-9]+$/),
  profile_id: z.string().trim().max(100).nullable().optional(),
  idempotency_key: z.string().trim().max(100).nullable().optional(),
  structured_input: z.object({
    age: z.number().int().min(0).max(130),
    gender: z.enum(['male', 'female', 'other']),
    weight_kg: z.number().positive().max(1000).optional(),
    chief_complaint: z.string().trim().min(1).max(500),
    symptoms: list.optional().default([]),
    past_medical_history: list.optional().default([]),
    current_medicines: list.optional().default([]),
    allergies: list.optional().default([]),
    history_of_present_illness: note.optional(),
    clinical_notes: note.optional(),
    vitals: z.object({
      blood_pressure_systolic: vital, blood_pressure_diastolic: vital,
      heart_rate: vital, respiratory_rate: vital, temperature_celsius: vital,
      spo2_percent: z.number().min(0).max(100).optional(),
    }).optional().default({}),
    lab_values: z.array(z.object({
      name: shortText,
      unit: z.string().max(50).optional().default(''),
      value: z.union([shortText, z.number()]),
      reference_range: z.string().trim().max(250).optional().nullable().transform((v) => (v && v.length > 0 ? v : undefined)),
    })).max(50).optional().default([]),
    is_pregnant: z.boolean().optional(),
    pregnancy_trimester: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    egfr: vital,
    care_setting: z.enum(['outpatient', 'inpatient', 'intensive_care']).optional(),
  }),
});
