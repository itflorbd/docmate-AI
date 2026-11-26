-- migrations/0005_phase7_voice_assistant.sql
-- DocMate AI - Voice Assistant & Cartoon Character Data Schema

-- 1. Voice Sessions Table
CREATE TABLE IF NOT EXISTS voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    stt_seconds NUMERIC(8,2) DEFAULT 0.00 NOT NULL,
    tts_chars INTEGER DEFAULT 0 NOT NULL,
    stt_provider VARCHAR(50) DEFAULT 'browser' NOT NULL,
    tts_provider VARCHAR(50) DEFAULT 'browser' NOT NULL,
    estimated_cost NUMERIC(8,4) DEFAULT 0.0000 NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_user ON voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_started ON voice_sessions(started_at);

-- 2. Voice Turns Table (strictly metrics only, zero raw transcript or audio content)
CREATE TABLE IF NOT EXISTS voice_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
    intent VARCHAR(50) NOT NULL, -- 'ask_library' | 'dictate' | 'answer_followup' | 'navigate' | 'read_aloud' | 'blocked_action' | 'other'
    status VARCHAR(50) NOT NULL, -- 'ok' | 'low_confidence' | 'failed' | 'blocked'
    latency_ms INTEGER DEFAULT 0 NOT NULL,
    error_code VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voice_turns_session ON voice_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_turns_intent ON voice_turns(intent);

-- 3. Flag on cases indicating voice entry
ALTER TABLE cases
    ADD COLUMN IF NOT EXISTS entered_by_voice BOOLEAN DEFAULT FALSE NOT NULL;

-- 4. Register Voice Features
INSERT INTO features (key, description, category, created_at)
VALUES
    ('voice.assistant', 'Interactive voice dialogue and Q&A with DocMate AI', 'voice', NOW()),
    ('voice.dictation', 'Clinical intake, observations, and note voice dictation', 'voice', NOW()),
    ('voice.avatar', 'Render animated cartoon doctor character', 'voice', NOW()),
    ('voice.readaloud', 'Read prescription schedules and instructions aloud', 'voice', NOW())
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- 5. Seed Role Feature Permissions
-- Super Admin
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('super_admin', 'voice.assistant', TRUE, 120, NOW(), NOW()),
    ('super_admin', 'voice.dictation', TRUE, 60, NOW(), NOW()),
    ('super_admin', 'voice.avatar', TRUE, NULL, NOW(), NOW()),
    ('super_admin', 'voice.readaloud', TRUE, 120, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Doctor
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('doctor', 'voice.assistant', TRUE, 60, NOW(), NOW()),
    ('doctor', 'voice.dictation', TRUE, 60, NOW(), NOW()),
    ('doctor', 'voice.avatar', TRUE, NULL, NOW(), NOW()),
    ('doctor', 'voice.readaloud', TRUE, 60, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Student (Library Q&A voice only, zero patient data)
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('student', 'voice.assistant', TRUE, 30, NOW(), NOW()),
    ('student', 'voice.dictation', FALSE, 0, NOW(), NOW()),
    ('student', 'voice.avatar', TRUE, NULL, NOW(), NOW()),
    ('student', 'voice.readaloud', FALSE, 0, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Researcher (Library Q&A voice only, zero patient data)
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('researcher', 'voice.assistant', TRUE, 30, NOW(), NOW()),
    ('researcher', 'voice.dictation', FALSE, 0, NOW(), NOW()),
    ('researcher', 'voice.avatar', TRUE, NULL, NOW(), NOW()),
    ('researcher', 'voice.readaloud', FALSE, 0, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Patient (Read-aloud only, no AI dialogue)
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('patient', 'voice.assistant', FALSE, 0, NOW(), NOW()),
    ('patient', 'voice.dictation', FALSE, 0, NOW(), NOW()),
    ('patient', 'voice.avatar', FALSE, 0, NOW(), NOW()),
    ('patient', 'voice.readaloud', TRUE, 30, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Medicine Controller (No voice by default)
INSERT INTO role_features (role, feature_key, enabled, daily_limit, created_at, updated_at)
VALUES
    ('medicine_controller', 'voice.assistant', FALSE, 0, NOW(), NOW()),
    ('medicine_controller', 'voice.dictation', FALSE, 0, NOW(), NOW()),
    ('medicine_controller', 'voice.avatar', FALSE, 0, NOW(), NOW()),
    ('medicine_controller', 'voice.readaloud', FALSE, 0, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 6. Initialize Global Voice Settings in system_settings
INSERT INTO system_settings (key, value, updated_at)
VALUES
    ('voice:config', '{
        "enabled": true,
        "kill_switch": false,
        "stt_provider": "browser",
        "tts_provider": "browser",
        "persona_name": "ডকমেট (DocMate)",
        "persona_greeting_bn": "স্বাগতম, ডাক্তার। বলুন, কীভাবে সাহায্য করতে পারি?",
        "persona_greeting_en": "Welcome, Doctor. How can I assist you today?",
        "intro_disclaimer_bn": "আমি একটি এআই সহকারী। চূড়ান্ত সিদ্ধান্ত আপনার।",
        "intro_disclaimer_en": "I am an AI assistant. The final decision is yours.",
        "default_voice_gender": "female",
        "default_speed": 1.0,
        "private_mode_default": true,
        "avatar_enabled_default": true
    }'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
