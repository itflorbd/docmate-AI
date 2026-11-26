-- Migration 0000: Phase 0 Baseline Schema (Extensions, Users, Sources, Chunks, Cases, Drugs, Audit)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Try enabling pgvector if available
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "vector";
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension could not be enabled automatically: %', SQLERRM;
END $$;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'doctor',
  name TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Sources
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  authors JSONB NOT NULL DEFAULT '[]'::jsonb,
  type VARCHAR(50) NOT NULL,
  year INTEGER NOT NULL,
  license TEXT NOT NULL DEFAULT 'Open Access / Academic Demo',
  url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Chunks
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  page INTEGER DEFAULT 1,
  section TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding vector(1536),
  tsv tsvector,
  evidence_level VARCHAR(10) NOT NULL DEFAULT 'Ia',
  hash TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chunks_source_id ON chunks (source_id);

-- 4. Cases
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  patient_code VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  structured_input JSONB NOT NULL,
  confirmed_diagnosis TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cases_doctor_id ON cases (doctor_id);
CREATE INDEX IF NOT EXISTS idx_cases_patient_code ON cases (patient_code);

-- 5. Case Turns
CREATE TABLE IF NOT EXISTS case_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_turns_case_id ON case_turns (case_id);

-- 6. Analyses
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  output JSONB NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analyses_case_id ON analyses (case_id);

-- 7. Drugs
CREATE TABLE IF NOT EXISTS drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name TEXT NOT NULL UNIQUE,
  drug_class TEXT NOT NULL,
  indications JSONB NOT NULL,
  dose_rules JSONB NOT NULL,
  contraindications JSONB NOT NULL,
  pregnancy_category VARCHAR(5) NOT NULL DEFAULT 'C',
  renal_adjustment JSONB,
  source_chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 8. Drug Interactions
CREATE TABLE IF NOT EXISTS drug_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a TEXT NOT NULL,
  drug_b TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL,
  note TEXT NOT NULL,
  source_chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  prev_hash VARCHAR(64),
  hash VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_case_id ON audit_logs (case_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
