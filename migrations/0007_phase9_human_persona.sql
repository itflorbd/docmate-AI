-- Migration: 0007_phase9_human_persona.sql
-- Human-Centric Persona, Phrase Bank & Quality Feedback Schema

CREATE TABLE IF NOT EXISTS user_assistant_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    address_style VARCHAR(50) NOT NULL DEFAULT 'doctor', -- 'doctor', 'doctor_sahib', 'doctor_madam', 'name'
    tone_preset VARCHAR(50) NOT NULL DEFAULT 'friendly', -- 'reserved', 'friendly'
    verbosity VARCHAR(50) NOT NULL DEFAULT 'normal', -- 'brief', 'normal', 'detailed'
    sounds_enabled BOOLEAN NOT NULL DEFAULT true,
    hints_enabled BOOLEAN NOT NULL DEFAULT true,
    avatar_enabled BOOLEAN NOT NULL DEFAULT true,
    speech_rate REAL NOT NULL DEFAULT 1.0,
    voice_id VARCHAR(100) DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS phrasebank_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL, -- greeting, acknowledge, thinking, etc.
    locale VARCHAR(10) NOT NULL DEFAULT 'bn', -- 'bn' or 'en'
    preset VARCHAR(50) NOT NULL DEFAULT 'friendly', -- 'reserved', 'friendly', 'all'
    text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'live', -- 'draft', 'reviewed', 'live'
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phrasebank_lookup ON phrasebank_entries(category, locale, preset, status);

CREATE TABLE IF NOT EXISTS assistant_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rating VARCHAR(20) NOT NULL, -- 'helpful', 'unhelpful'
    reason VARCHAR(100), -- 'too_long', 'too_formal', 'did_not_understand', 'wrong_tone', 'other'
    preset VARCHAR(50) NOT NULL DEFAULT 'friendly',
    locale VARCHAR(10) NOT NULL DEFAULT 'bn',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assistant_feedback_metrics ON assistant_feedback(rating, reason, preset, locale, created_at);
