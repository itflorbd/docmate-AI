-- migrations/0006_phase8_language_layer.sql
-- DocMate AI - Multilingual Language Layer (Bangla, English, Banglish, Mixed)

-- 1. Term Aliases Table (Safe, editable clinical term canonicalization)
CREATE TABLE IF NOT EXISTS term_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_en VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'symptom' | 'sign' | 'disease' | 'medicine_generic' | 'medicine_brand' | 'body_part' | 'unit' | 'duration' | 'number' | 'negation'
    variants JSONB NOT NULL DEFAULT '{"bn":[],"banglish":[],"en":[],"bn_translit_en":[]}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'pending'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_term_aliases_canonical_category ON term_aliases(canonical_en, category);
CREATE INDEX IF NOT EXISTS idx_term_aliases_canonical ON term_aliases(canonical_en);
CREATE INDEX IF NOT EXISTS idx_term_aliases_category ON term_aliases(category);
CREATE INDEX IF NOT EXISTS idx_term_aliases_status ON term_aliases(status);
CREATE INDEX IF NOT EXISTS idx_term_aliases_variants_gin ON term_aliases USING GIN (variants);

-- 2. Unmatched Terms Review Queue (De-identified terms collected for admin review)
CREATE TABLE IF NOT EXISTS unmatched_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term VARCHAR(150) NOT NULL,
    language VARCHAR(20) NOT NULL DEFAULT 'unknown', -- 'bn' | 'banglish' | 'en' | 'mixed' | 'unknown'
    count INTEGER DEFAULT 1 NOT NULL,
    first_seen TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_seen TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL -- 'pending' | 'reviewed' | 'added' | 'ignored'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unmatched_terms_term_unique ON unmatched_terms(LOWER(term));
CREATE INDEX IF NOT EXISTS idx_unmatched_terms_status ON unmatched_terms(status);
CREATE INDEX IF NOT EXISTS idx_unmatched_terms_count ON unmatched_terms(count DESC);

-- 3. User Language Preferences Table
CREATE TABLE IF NOT EXISTS user_language_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    reply_language VARCHAR(20) DEFAULT 'auto' NOT NULL, -- 'auto' | 'bn' | 'en'
    banglish_reply BOOLEAN DEFAULT FALSE NOT NULL,
    stt_mode VARCHAR(20) DEFAULT 'auto' NOT NULL, -- 'auto' | 'bn' | 'en'
    show_understanding BOOLEAN DEFAULT TRUE NOT NULL,
    phonetic_typing BOOLEAN DEFAULT FALSE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_language_prefs_user ON user_language_prefs(user_id);

-- 4. Language Evaluation Runs (Historical eval metrics and thresholds)
CREATE TABLE IF NOT EXISTS language_eval_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_language_eval_runs_date ON language_eval_runs(date DESC);

-- 5. Register Language Layer Feature Keys
INSERT INTO features (key, description, category, created_at)
VALUES
    ('language.prefs', 'Manage personal multilingual preferences and reply modes', 'admin', NOW()),
    ('language.aliases.manage', 'Review and curate clinical term aliases and Banglish vocabulary', 'admin', NOW()),
    ('language.phonetic_typing', 'Enable client-side phonetic Bangla typing in input fields', 'admin', NOW())
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- 6. Seed Role Feature Permissions
-- Super Admin
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('super_admin', 'language.prefs', TRUE, NULL, NOW(), NOW()),
    ('super_admin', 'language.aliases.manage', TRUE, NULL, NOW(), NOW()),
    ('super_admin', 'language.phonetic_typing', TRUE, NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Medicine Controller (can manage drug & formulary aliases)
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('medicine_controller', 'language.prefs', TRUE, NULL, NOW(), NOW()),
    ('medicine_controller', 'language.aliases.manage', TRUE, NULL, NOW(), NOW()),
    ('medicine_controller', 'language.phonetic_typing', TRUE, NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Doctor
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('doctor', 'language.prefs', TRUE, NULL, NOW(), NOW()),
    ('doctor', 'language.aliases.manage', FALSE, NULL, NOW(), NOW()),
    ('doctor', 'language.phonetic_typing', FALSE, NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Student
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('student', 'language.prefs', TRUE, NULL, NOW(), NOW()),
    ('student', 'language.aliases.manage', FALSE, NULL, NOW(), NOW()),
    ('student', 'language.phonetic_typing', FALSE, NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Researcher
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('researcher', 'language.prefs', TRUE, NULL, NOW(), NOW()),
    ('researcher', 'language.aliases.manage', FALSE, NULL, NOW(), NOW()),
    ('researcher', 'language.phonetic_typing', FALSE, NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Patient
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('patient', 'language.prefs', TRUE, NULL, NOW(), NOW()),
    ('patient', 'language.aliases.manage', FALSE, NULL, NOW(), NOW()),
    ('patient', 'language.phonetic_typing', FALSE, NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;
