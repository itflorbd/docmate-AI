-- Migration 0008: Phase 10 - Patient Identity, Profiles, Access Grants, and Logs

-- 1. Patient Accounts Table (Phone-authenticated patient identity)
CREATE TABLE IF NOT EXISTS patient_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(30) NOT NULL UNIQUE,
  phone_normalized VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patient_accounts_phone ON patient_accounts (phone_normalized);

-- 2. Patient Profiles Table (Multi-profile per account: self, child, spouse, parent, etc.)
CREATE TABLE IF NOT EXISTS patient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  relation VARCHAR(30) DEFAULT 'self' NOT NULL,
  name TEXT NOT NULL,
  name_encrypted TEXT,
  date_of_birth TIMESTAMPTZ,
  age INTEGER NOT NULL,
  gender VARCHAR(20) NOT NULL,
  sex VARCHAR(20),
  blood_group VARCHAR(10),
  address_encrypted TEXT,
  nid_encrypted TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_account_id ON patient_profiles (account_id);

-- 3. Profile Health Summary Table
CREATE TABLE IF NOT EXISTS profile_health_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1 NOT NULL,
  allergies JSONB DEFAULT '[]'::jsonb NOT NULL,
  chronic_conditions JSONB DEFAULT '[]'::jsonb NOT NULL,
  current_medicines JSONB DEFAULT '[]'::jsonb NOT NULL,
  blood_group VARCHAR(10),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  change_reason TEXT,
  CONSTRAINT profile_health_summary_profile_version_key UNIQUE (profile_id, version)
);
CREATE INDEX IF NOT EXISTS idx_profile_health_summary_profile ON profile_health_summary (profile_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_health_summary_profile_version_key'
  ) THEN
    ALTER TABLE profile_health_summary ADD CONSTRAINT profile_health_summary_profile_version_key UNIQUE (profile_id, version);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_health_summary_profile_version ON profile_health_summary (profile_id, version);
END $$;

-- 4. Access Grants Table
CREATE TABLE IF NOT EXISTS access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope VARCHAR(30) DEFAULT 'this_doctor_only' NOT NULL,
  status VARCHAR(30) DEFAULT 'active' NOT NULL,
  granted_via VARCHAR(30) DEFAULT 'created_profile' NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_access_grants_profile ON access_grants (profile_id);
CREATE INDEX IF NOT EXISTS idx_access_grants_doctor ON access_grants (doctor_id);

-- 5. OTP Requests Table
CREATE TABLE IF NOT EXISTS otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(30) NOT NULL,
  purpose VARCHAR(30) DEFAULT 'login' NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0 NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_requests_phone ON otp_requests (phone);

-- 6. Access Logs Table
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  user_role VARCHAR(50),
  action VARCHAR(50) NOT NULL,
  record_type VARCHAR(50),
  record_id UUID,
  reason TEXT,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_access_logs_profile ON access_logs (profile_id);

-- 7. Medicine Intake Logs Table
CREATE TABLE IF NOT EXISTS medicine_intake_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_item_id UUID REFERENCES prescription_items(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  slot VARCHAR(20),
  taken_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_medicine_intake_logs_profile ON medicine_intake_logs (profile_id);

-- 8. Idempotency Keys Table
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(100) PRIMARY KEY,
  route VARCHAR(200) NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. Link Profile IDs across related clinical tables
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES patient_profiles(id) ON DELETE SET NULL;

ALTER TABLE encounters
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES patient_profiles(id) ON DELETE SET NULL;

ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES patient_profiles(id) ON DELETE SET NULL;

ALTER TABLE patient_schedules
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES patient_profiles(id) ON DELETE CASCADE;

ALTER TABLE patient_reports
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES patient_profiles(id) ON DELETE CASCADE;

ALTER TABLE patient_pre_visits
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES patient_profiles(id) ON DELETE CASCADE;

ALTER TABLE patient_consent_logs
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES patient_profiles(id) ON DELETE CASCADE;
