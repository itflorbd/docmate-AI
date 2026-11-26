-- Migration 0010: Patient Safety and Privacy
-- Fixes missing columns, drops legacy NOT NULL constraints on patient_id for profile-centric records, and adds performance indexes.

-- 1. Ensure patients.sex exists
ALTER TABLE patients ADD COLUMN IF NOT EXISTS sex VARCHAR(20);

-- 2. Ensure patient_reports.is_shared exists
ALTER TABLE patient_reports ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Make legacy patient_id nullable on profile-based tables
ALTER TABLE patient_consent_logs ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE patient_reports ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE patient_pre_visits ALTER COLUMN patient_id DROP NOT NULL;

-- 4. Performance indexes for workflow queries
CREATE INDEX IF NOT EXISTS idx_patients_sex ON patients (sex);
CREATE INDEX IF NOT EXISTS idx_access_grants_profile_status ON access_grants (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_patient_reports_profile_shared ON patient_reports (profile_id, is_shared);
CREATE INDEX IF NOT EXISTS idx_patient_consent_logs_profile_id ON patient_consent_logs (profile_id);
CREATE INDEX IF NOT EXISTS idx_patient_pre_visits_profile_id ON patient_pre_visits (profile_id);
