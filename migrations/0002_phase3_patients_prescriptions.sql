-- Phase 3: Doctor Workflow & Bangladeshi Prescription Suite
-- Tables: patients, encounters, prescriptions, prescription_items

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  patient_code VARCHAR(50) NOT NULL,
  name_encrypted TEXT NOT NULL,
  phone_encrypted TEXT,
  age INTEGER NOT NULL,
  gender VARCHAR(20) NOT NULL,
  blood_group VARCHAR(10),
  emergency_contact TEXT,
  consent_obtained BOOLEAN NOT NULL DEFAULT true,
  consent_obtained_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  visit_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  chief_complaint TEXT NOT NULL,
  symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
  allergies JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  past_history TEXT,
  clinical_notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rx_number VARCHAR(50) NOT NULL UNIQUE,
  diagnosis TEXT,
  investigations JSONB NOT NULL DEFAULT '[]'::jsonb,
  general_advice TEXT,
  follow_up_text VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  qr_hash VARCHAR(64) NOT NULL UNIQUE,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  brand_name VARCHAR(100) NOT NULL,
  generic_name VARCHAR(100) NOT NULL,
  strength VARCHAR(50) NOT NULL,
  form VARCHAR(50) NOT NULL DEFAULT 'Tab',
  dosing_schedule VARCHAR(50) NOT NULL,
  meal_timing VARCHAR(50) NOT NULL DEFAULT 'খাবারের পর',
  duration_days INTEGER NOT NULL DEFAULT 7,
  duration_text VARCHAR(50) NOT NULL DEFAULT '৭ দিন',
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance and Access-control Indexes
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_patient_code ON patients(patient_code);
CREATE INDEX IF NOT EXISTS idx_encounters_patient_id ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_doctor_id ON encounters(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_qr_hash ON prescriptions(qr_hash);
CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription_id ON prescription_items(prescription_id);
