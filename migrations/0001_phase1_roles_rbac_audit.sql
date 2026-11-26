-- Migration 0001: Phase 1 Roles, Feature RBAC, Security, and Audit Hash Chain

-- 1. Migrate existing 'admin' role to 'super_admin'
UPDATE users SET role = 'super_admin' WHERE role = 'admin';

-- 2. Add security and verification columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bmdc_number VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id UUID;

-- 3. Features Table
CREATE TABLE IF NOT EXISTS features (
  key VARCHAR(100) PRIMARY KEY,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Role Features Table
CREATE TABLE IF NOT EXISTS role_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  feature_key VARCHAR(100) NOT NULL REFERENCES features(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_limit INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_role_feature UNIQUE (role, feature_key)
);

-- Ensure unique constraint exists even if table pre-existed without it
DELETE FROM role_features a USING role_features b
WHERE a.id < b.id AND a.role = b.role AND a.feature_key = b.feature_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_role_feature'
  ) THEN
    ALTER TABLE role_features ADD CONSTRAINT uq_role_feature UNIQUE (role, feature_key);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_role_features_role_key ON role_features (role, feature_key);
END $$;

-- 5. User Feature Overrides Table
CREATE TABLE IF NOT EXISTS user_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL REFERENCES features(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  daily_limit INTEGER,
  expires_at TIMESTAMP,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_feature_override UNIQUE (user_id, feature_key)
);

-- Ensure unique constraint exists even if table pre-existed without it
DELETE FROM user_feature_overrides a USING user_feature_overrides b
WHERE a.id < b.id AND a.user_id = b.user_id AND a.feature_key = b.feature_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_feature_override'
  ) THEN
    ALTER TABLE user_feature_overrides ADD CONSTRAINT uq_user_feature_override UNIQUE (user_id, feature_key);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_feature_overrides_user_key ON user_feature_overrides (user_id, feature_key);
END $$;

-- 6. Verification Tables
CREATE TABLE IF NOT EXISTS doctor_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bmdc_number VARCHAR(50) NOT NULL,
  document_url TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  institute_name TEXT NOT NULL,
  student_id_number VARCHAR(50) NOT NULL,
  institute_email VARCHAR(255),
  document_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS researcher_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  researcher_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  institute_name TEXT NOT NULL,
  orcid VARCHAR(50),
  institute_email VARCHAR(255),
  document_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. Audit Log Hash Chaining Columns
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS hash VARCHAR(64);

-- 8. User Sessions (for device management & remote revocation)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address VARCHAR(64),
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. Seed Feature Keys
INSERT INTO features (key, description, category) VALUES
  ('patients.manage', 'Create, update, and manage patient profiles and visits', 'clinical'),
  ('ai.analyze', 'AI-assisted differential diagnosis and missing evidence questions', 'clinical'),
  ('ai.treatment', 'AI-guided clinical treatment and guideline-backed medicine recommendations', 'clinical'),
  ('prescription.create', 'Generate, finalize, print, and export patient prescriptions', 'clinical'),
  ('library.ask', 'Ask questions and receive cited answers over the medical library', 'library'),
  ('library.browse', 'Browse textbooks, clinical guidelines, and research papers', 'library'),
  ('library.manage', 'Add, review, approve, publish, and retire medical sources', 'library'),
  ('medicine.search', 'Search generic drugs and Bangladeshi brand formulations', 'medicine'),
  ('medicine.interactions', 'Multi-drug interaction and contraindication screening', 'medicine'),
  ('medicine.manage', 'Manage medicine catalog, brands, dose rules, and DGDA status', 'medicine'),
  ('medicine.notices', 'Publish and receive regulatory drug safety notices and recalls', 'medicine'),
  ('study.tools', 'Practice virtual clinical cases, flashcards, chapter quizzes, notes', 'study'),
  ('research.tools', 'Compare guideline evidence, manage collections, export citations', 'research'),
  ('patient.portal', 'Patient self-service portal: view shared prescriptions, schedule, upload reports', 'patient'),
  ('feedback.send', 'Submit feedback and report clinical errors or data gaps', 'feedback'),
  ('feedback.review', 'Review submitted clinical and drug feedback', 'feedback'),
  ('users.manage', 'Manage users, approvals, verifications, suspensions, sessions', 'admin'),
  ('access.manage', 'Configure role features, user overrides, and access matrices', 'admin'),
  ('plans.billing', 'Manage subscription plans, manual activations, payment gateways', 'admin'),
  ('ai.settings', 'Configure AI models, chunk parameters, prompt versions, kill switches', 'admin'),
  ('audit.read', 'Inspect tamper-evident cryptographic audit logs', 'admin'),
  ('system.manage', 'System health, backups, announcements, and maintenance mode', 'admin')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- 11. Seed Default Role Features Matrix
-- super_admin
INSERT INTO role_features (role, feature_key, enabled, daily_limit) VALUES
  ('super_admin', 'patients.manage', FALSE, NULL), -- Break-glass only
  ('super_admin', 'ai.analyze', FALSE, NULL),
  ('super_admin', 'ai.treatment', FALSE, NULL),
  ('super_admin', 'prescription.create', FALSE, NULL),
  ('super_admin', 'library.ask', TRUE, NULL),
  ('super_admin', 'library.browse', TRUE, NULL),
  ('super_admin', 'library.manage', TRUE, NULL),
  ('super_admin', 'medicine.search', TRUE, NULL),
  ('super_admin', 'medicine.interactions', TRUE, NULL),
  ('super_admin', 'medicine.manage', TRUE, NULL),
  ('super_admin', 'medicine.notices', TRUE, NULL),
  ('super_admin', 'study.tools', FALSE, NULL),
  ('super_admin', 'research.tools', FALSE, NULL),
  ('super_admin', 'patient.portal', FALSE, NULL),
  ('super_admin', 'feedback.send', TRUE, NULL),
  ('super_admin', 'feedback.review', TRUE, NULL),
  ('super_admin', 'users.manage', TRUE, NULL),
  ('super_admin', 'access.manage', TRUE, NULL),
  ('super_admin', 'plans.billing', TRUE, NULL),
  ('super_admin', 'ai.settings', TRUE, NULL),
  ('super_admin', 'audit.read', TRUE, NULL),
  ('super_admin', 'system.manage', TRUE, NULL)
ON CONFLICT (role, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;

-- doctor
INSERT INTO role_features (role, feature_key, enabled, daily_limit) VALUES
  ('doctor', 'patients.manage', TRUE, NULL),
  ('doctor', 'ai.analyze', TRUE, 100),
  ('doctor', 'ai.treatment', TRUE, 100),
  ('doctor', 'prescription.create', TRUE, NULL),
  ('doctor', 'library.ask', TRUE, 200),
  ('doctor', 'library.browse', TRUE, NULL),
  ('doctor', 'library.manage', FALSE, NULL),
  ('doctor', 'medicine.search', TRUE, NULL),
  ('doctor', 'medicine.interactions', TRUE, NULL),
  ('doctor', 'medicine.manage', FALSE, NULL),
  ('doctor', 'medicine.notices', TRUE, NULL),
  ('doctor', 'study.tools', FALSE, NULL),
  ('doctor', 'research.tools', FALSE, NULL),
  ('doctor', 'patient.portal', FALSE, NULL),
  ('doctor', 'feedback.send', TRUE, NULL),
  ('doctor', 'feedback.review', FALSE, NULL),
  ('doctor', 'users.manage', FALSE, NULL),
  ('doctor', 'access.manage', FALSE, NULL),
  ('doctor', 'plans.billing', TRUE, NULL), -- view only
  ('doctor', 'ai.settings', TRUE, NULL), -- view only
  ('doctor', 'audit.read', FALSE, NULL),
  ('doctor', 'system.manage', FALSE, NULL)
ON CONFLICT (role, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;

-- student
INSERT INTO role_features (role, feature_key, enabled, daily_limit) VALUES
  ('student', 'patients.manage', FALSE, NULL),
  ('student', 'ai.analyze', FALSE, NULL),
  ('student', 'ai.treatment', FALSE, NULL),
  ('student', 'prescription.create', FALSE, NULL),
  ('student', 'library.ask', TRUE, 100),
  ('student', 'library.browse', TRUE, NULL),
  ('student', 'library.manage', FALSE, NULL),
  ('student', 'medicine.search', TRUE, NULL),
  ('student', 'medicine.interactions', TRUE, NULL),
  ('student', 'medicine.manage', FALSE, NULL),
  ('student', 'medicine.notices', TRUE, NULL),
  ('student', 'study.tools', TRUE, NULL),
  ('student', 'research.tools', FALSE, NULL),
  ('student', 'patient.portal', FALSE, NULL),
  ('student', 'feedback.send', TRUE, NULL),
  ('student', 'feedback.review', FALSE, NULL),
  ('student', 'users.manage', FALSE, NULL),
  ('student', 'access.manage', FALSE, NULL),
  ('student', 'plans.billing', TRUE, NULL),
  ('student', 'ai.settings', TRUE, NULL),
  ('student', 'audit.read', FALSE, NULL),
  ('student', 'system.manage', FALSE, NULL)
ON CONFLICT (role, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;

-- researcher
INSERT INTO role_features (role, feature_key, enabled, daily_limit) VALUES
  ('researcher', 'patients.manage', FALSE, NULL),
  ('researcher', 'ai.analyze', FALSE, NULL),
  ('researcher', 'ai.treatment', FALSE, NULL),
  ('researcher', 'prescription.create', FALSE, NULL),
  ('researcher', 'library.ask', TRUE, 300),
  ('researcher', 'library.browse', TRUE, NULL),
  ('researcher', 'library.manage', FALSE, NULL),
  ('researcher', 'medicine.search', TRUE, NULL),
  ('researcher', 'medicine.interactions', TRUE, NULL),
  ('researcher', 'medicine.manage', FALSE, NULL),
  ('researcher', 'medicine.notices', TRUE, NULL),
  ('researcher', 'study.tools', FALSE, NULL),
  ('researcher', 'research.tools', TRUE, NULL),
  ('researcher', 'patient.portal', FALSE, NULL),
  ('researcher', 'feedback.send', TRUE, NULL),
  ('researcher', 'feedback.review', FALSE, NULL),
  ('researcher', 'users.manage', FALSE, NULL),
  ('researcher', 'access.manage', FALSE, NULL),
  ('researcher', 'plans.billing', TRUE, NULL),
  ('researcher', 'ai.settings', TRUE, NULL),
  ('researcher', 'audit.read', FALSE, NULL),
  ('researcher', 'system.manage', FALSE, NULL)
ON CONFLICT (role, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;

-- patient
INSERT INTO role_features (role, feature_key, enabled, daily_limit) VALUES
  ('patient', 'patients.manage', FALSE, NULL),
  ('patient', 'ai.analyze', FALSE, NULL),
  ('patient', 'ai.treatment', FALSE, NULL),
  ('patient', 'prescription.create', FALSE, NULL),
  ('patient', 'library.ask', FALSE, NULL),
  ('patient', 'library.browse', FALSE, NULL),
  ('patient', 'library.manage', FALSE, NULL),
  ('patient', 'medicine.search', FALSE, NULL),
  ('patient', 'medicine.interactions', FALSE, NULL),
  ('patient', 'medicine.manage', FALSE, NULL),
  ('patient', 'medicine.notices', TRUE, NULL), -- own prescribed drug notices
  ('patient', 'study.tools', FALSE, NULL),
  ('patient', 'research.tools', FALSE, NULL),
  ('patient', 'patient.portal', TRUE, NULL),
  ('patient', 'feedback.send', TRUE, NULL),
  ('patient', 'feedback.review', FALSE, NULL),
  ('patient', 'users.manage', FALSE, NULL),
  ('patient', 'access.manage', FALSE, NULL),
  ('patient', 'plans.billing', FALSE, NULL),
  ('patient', 'ai.settings', FALSE, NULL),
  ('patient', 'audit.read', FALSE, NULL),
  ('patient', 'system.manage', FALSE, NULL)
ON CONFLICT (role, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;

-- medicine_controller
INSERT INTO role_features (role, feature_key, enabled, daily_limit) VALUES
  ('medicine_controller', 'patients.manage', FALSE, NULL),
  ('medicine_controller', 'ai.analyze', FALSE, NULL),
  ('medicine_controller', 'ai.treatment', FALSE, NULL),
  ('medicine_controller', 'prescription.create', FALSE, NULL),
  ('medicine_controller', 'library.ask', TRUE, NULL),
  ('medicine_controller', 'library.browse', TRUE, NULL),
  ('medicine_controller', 'library.manage', FALSE, NULL),
  ('medicine_controller', 'medicine.search', TRUE, NULL),
  ('medicine_controller', 'medicine.interactions', TRUE, NULL),
  ('medicine_controller', 'medicine.manage', TRUE, NULL),
  ('medicine_controller', 'medicine.notices', TRUE, NULL),
  ('medicine_controller', 'study.tools', FALSE, NULL),
  ('medicine_controller', 'research.tools', FALSE, NULL),
  ('medicine_controller', 'patient.portal', FALSE, NULL),
  ('medicine_controller', 'feedback.send', TRUE, NULL),
  ('medicine_controller', 'feedback.review', TRUE, NULL), -- drug feedback only
  ('medicine_controller', 'users.manage', FALSE, NULL),
  ('medicine_controller', 'access.manage', FALSE, NULL),
  ('medicine_controller', 'plans.billing', FALSE, NULL),
  ('medicine_controller', 'ai.settings', FALSE, NULL),
  ('medicine_controller', 'audit.read', FALSE, NULL),
  ('medicine_controller', 'system.manage', FALSE, NULL)
ON CONFLICT (role, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;
