-- Migration 0013: Link prescriptions to clinical cases (idempotent, nullable, no backfill)

ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_case_id
  ON prescriptions (case_id)
  WHERE case_id IS NOT NULL;
