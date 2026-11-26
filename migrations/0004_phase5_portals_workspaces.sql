-- Migration 0004: Phase 5 - Patient Portal, Student & Researcher Workspaces

CREATE TABLE IF NOT EXISTS patient_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  prescription_item_id UUID REFERENCES prescription_items(id) ON DELETE SET NULL,
  medicine_name VARCHAR(150) NOT NULL,
  dosage VARCHAR(50) NOT NULL,
  slot VARCHAR(20) NOT NULL, -- 'morning' | 'noon' | 'night'
  meal_relation VARCHAR(50) NOT NULL DEFAULT 'খাবারের পর',
  taken_today BOOLEAN NOT NULL DEFAULT FALSE,
  last_taken_at TIMESTAMPTZ,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  report_type VARCHAR(50) NOT NULL DEFAULT 'lab_test',
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_pre_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  chief_complaint TEXT NOT NULL,
  symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration VARCHAR(50) NOT NULL DEFAULT '১-২ দিন',
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending' | 'reviewed'
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  action VARCHAR(30) NOT NULL, -- 'granted' | 'revoked'
  reason TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  difficulty VARCHAR(20) NOT NULL DEFAULT 'intermediate', -- 'beginner' | 'intermediate' | 'advanced'
  vignette TEXT NOT NULL,
  vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_option TEXT NOT NULL,
  clinical_explanation TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  topic VARCHAR(100) NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer VARCHAR(10) NOT NULL,
  explanation TEXT NOT NULL,
  citation_chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS researcher_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
