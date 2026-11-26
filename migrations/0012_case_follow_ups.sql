-- Follow-up visits: a new case linked to the prior visit it continues.
-- The prior case is never changed. What was carried forward, and how the
-- doctor reconciled it, is stored here and audited.

CREATE TABLE IF NOT EXISTS case_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
  previous_case_id uuid NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  profile_id uuid REFERENCES patient_profiles(id) ON DELETE SET NULL,
  doctor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  -- One key per "Start follow-up" action; a repeated submission returns the same visit.
  request_key varchar(64) NOT NULL,
  carried jsonb NOT NULL,
  reconciliation jsonb,
  status varchar(30) NOT NULL DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT now(),
  reconciled_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS case_follow_ups_request_unique ON case_follow_ups (previous_case_id, doctor_id, request_key);
CREATE INDEX IF NOT EXISTS case_follow_ups_previous_idx ON case_follow_ups (previous_case_id);
