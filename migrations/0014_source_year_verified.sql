-- Migration 0014: Track whether a source's publication year was explicitly verified at ingestion (idempotent)

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS year_verified BOOLEAN DEFAULT TRUE NOT NULL;
