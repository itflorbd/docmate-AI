-- Align a clean database with src/db/schema.ts.
-- Found by bootstrapping a fresh database: these columns were used by the app
-- but never created, and consent logs required a legacy patient row.

ALTER TABLE patients ADD COLUMN IF NOT EXISTS sex varchar(20);
ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS sex varchar(20);
ALTER TABLE patient_reports ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;
-- Reports stay private until the patient shares them.
ALTER TABLE patient_reports ALTER COLUMN is_shared SET DEFAULT false;

-- Profile-based consent events (grants, revocations) have no legacy patient row.
ALTER TABLE patient_consent_logs ALTER COLUMN patient_id DROP NOT NULL;

-- Reports uploaded from the portal belong to a profile and may have no legacy patient row.
ALTER TABLE patient_reports ALTER COLUMN patient_id DROP NOT NULL;
