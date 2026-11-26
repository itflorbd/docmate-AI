-- Phase 4: DGDA Formulary Safety, Medicine Controller Portal, and Two-Person Review

CREATE TABLE IF NOT EXISTS medicine_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name VARCHAR(150) NOT NULL,
  generic_name VARCHAR(150) NOT NULL,
  manufacturer VARCHAR(150) NOT NULL,
  form VARCHAR(50) NOT NULL DEFAULT 'Tab',
  strength VARCHAR(50) NOT NULL,
  pack_size VARCHAR(50) DEFAULT '10x10',
  price_bdt NUMERIC(10, 2) DEFAULT 0.00,
  dgda_reg_num VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'approved', -- 'pending' | 'partially_approved' | 'approved' | 'rejected'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicine_brands_generic ON medicine_brands(generic_name);
CREATE INDEX IF NOT EXISTS idx_medicine_brands_brand ON medicine_brands(brand_name);
CREATE INDEX IF NOT EXISTS idx_medicine_brands_status ON medicine_brands(status);
CREATE INDEX IF NOT EXISTS idx_medicine_brands_manufacturer ON medicine_brands(manufacturer);

CREATE TABLE IF NOT EXISTS medicine_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES medicine_brands(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  changes_json JSONB NOT NULL,
  reviewed_by_1 UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at_1 TIMESTAMPTZ,
  reviewed_by_2 UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at_2 TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending' | 'partially_approved' | 'approved' | 'rejected'
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicine_versions_medicine_id ON medicine_versions(medicine_id);
CREATE INDEX IF NOT EXISTS idx_medicine_versions_status ON medicine_versions(status);

CREATE TABLE IF NOT EXISTS medicine_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  severity VARCHAR(30) NOT NULL DEFAULT 'info', -- 'info' | 'warning' | 'critical_recall'
  body TEXT NOT NULL,
  affected_batches JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicine_notices_severity ON medicine_notices(severity);
CREATE INDEX IF NOT EXISTS idx_medicine_notices_published_at ON medicine_notices(published_at DESC);

-- Ensure two_person_review_enabled is present in system_settings
INSERT INTO system_settings (key, value)
VALUES ('two_person_review_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
