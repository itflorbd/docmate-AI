# ANALYSIS_VOICE.md — Voice Assistant & Cartoon Character Architecture

**DocMate AI — Principal Engineer & Product Designer Specification**  
*Date: 2026-11-22 | Status: Approved for Implementation*

---

## 1. Executive Summary

DocMate AI is adding an intelligent, evidence-grounded **Voice Assistant** powered by a friendly, animated cartoon doctor character (**DocMate / ডকমেট**). The voice assistant operates as a dual-modality enhancement to the existing clinical workstation, maintaining strict adherence to DocMate AI's core clinical safety principles:
1. **Closed Medical Library Only**: The assistant possesses zero outside knowledge. It never answers clinical questions from ungrounded LLM hallucinations.
2. **Deterministic & Verified Speech**: Spoken clinical output is generated *exclusively* from already-verified backend structures (via `makeSpeakable()`). If evidence is insufficient, it explicitly abstains.
3. **Doctor Decides, AI Suggests**: The assistant introduces itself once per session as an AI assistant (*"আমি একটি এআই সহকারী। চূড়ান্ত সিদ্ধান্ত আপনার।"*), never claims to be a doctor, and cannot execute critical clinical actions (signing prescriptions, altering doses, modifying allergies, or changing patient access) by voice.
4. **Push-to-Talk & Privacy by Default**: No wake word, no continuous ambient listening, zero audio storage. Private mode is ON by default (masking patient names, phones, and addresses in speech).
5. **Universal Accessibility & Responsiveness**: Voice is entirely optional. Every capability remains accessible via touch and keyboard.

---

## 2. Existing Codebase Analysis & Reusability Map

The voice assistant will directly reuse and plug into the following battle-tested components and pipelines:

### 2.1 Chat & Clinical Retrieval Pipeline
- **`src/app/api/ask/route.ts` & `src/lib/retrieval.ts`**: High-performance closed-library search (`searchLibraryText`), producing verbatim citations via `libraryExcerpts()`.
- **`src/app/api/cases/[id]/turns/route.ts`**: Clinical turn management, handling both conversational observations and structured follow-up answers (`question_answer`).
- **`src/app/api/cases/[id]/analyze/route.ts` & `src/lib/analysis-policy.ts`**: The core diagnostic reasoning engine and abstention policy (`abstain()`, generating structured `insufficient_evidence` outputs with targeted `missing_information`).
- **`src/lib/citation/index.ts` & `src/lib/citation-verifier.ts`**: Deterministic whitespace-normalized quotation verifier ensuring claims match chunk texts verbatim.

### 2.2 Clinical Fact Extraction & De-Identification
- **`src/lib/clinical-extractor.ts` (`extractClinicalFacts`)**: Extracts structured vitals, temperatures (°C / °F), blood pressures, symptoms, and lab findings from natural language text.
- **`src/lib/deidentify.ts` (`deidentifyClinicalText`)**: Pre-LLM de-identification engine stripping Bangladeshi phone numbers, NID, emails, BMDC numbers, and patient names. Voice transcripts will pass through this before LLM intent extraction.

### 2.3 Formulary & Prescription Data
- **`src/db/schema.ts` (`medicineBrands`, `drugs`, `prescriptions`, `prescriptionItems`)**: DGDA-approved Bangladeshi brand and generic medicines, standard dosage schedules (`1+0+1`, `1+1+1`), and meal timings (`খাবারের পর`, `খাবারের আগে`).
- **Deterministic Dose Table**: Pure TypeScript converter that transforms structured prescription codes into natural Bangla and English speech without LLM dependency.

### 2.4 Feature Access & Governance
- **`src/lib/permissions.ts` (`canUse`, `DEFAULT_ROLE_PERMISSIONS`)**: Dynamic access control engine with cached evaluation, global kill-switches in `system_settings`, and user-level overrides.
- **`docs/ACCESS.md`**: Formal access matrix governing the 6 roles (`super_admin`, `doctor`, `student`, `researcher`, `patient`, `medicine_controller`).

### 2.5 UI & Overlay Architecture (AGENTS.md Compliance)
- **`src/components/shared/AppShell.tsx`**: Host for the floating character button, global overlay providers, and persistent clinical disclaimer.
- **`src/components/ui/drawer.tsx` (Vaul)**: Mobile drawer (<768px) for voice panel.
- **Docked Side Panel**: Desktop (>=768px) right-side collapsible panel (~380px–420px).
- **`src/components/shared/EvidenceSheet.tsx`**: Opened automatically or on command when the doctor asks to view cited proof.

---

## 3. Where Voice Plugs In (Screens & Entry Points)

| Screen / View | Role | Voice Entry Point | Capability Enabled |
| :--- | :--- | :--- | :--- |
| **All Doctor Screens** (`/dashboard`, `/cases`, `/patients`, `/library`, etc.) | `doctor`, `super_admin` | Floating character avatar button (bottom-right desktop, bottom-right above bar mobile) | Full voice assistant panel (Q&A, navigation, settings, state) |
| **Case Workspace Chat** (`/cases/[id]?tab=conversation`) | `doctor` | Microphone icon in chat textarea (`CaseConversationTab`) | Speak clinical observation; auto-inserts transcript into input |
| **Missing Information Cards** (`/cases/[id]?tab=missing_info`) | `doctor` | *"বলে উত্তর দিন"* (Answer by Voice) button on question cards | Reads question aloud, accepts short spoken answer ("হ্যাঁ", "না", number), maps to follow-up |
| **New Patient Intake** (`/patients/new`) | `doctor` | *"মুখে বলুন"* (Dictate Intake) button on intake form | Speaks natural patient intake; structured extractor fills draft fields with read-back confirmation |
| **Patient Portal** (`/portal`) | `patient` | *"শুনুন"* (Listen) button on medication schedule cards and active prescriptions | Pure read-aloud of prescription items and dosing directions (no AI chat) |
| **Study & Research Workspaces** (`/study`, `/research`) | `student`, `researcher` | Floating character avatar | Library questions only with cited answers; zero patient data access |
| **Admin Voice Control** (`/admin/voice` & `/admin/access`) | `super_admin` | Global settings page & feature matrix | Provider configuration, daily limits, persona settings, metrics, kill switch |

---

## 4. Key Risks, Clinical Safety & Mitigations

### 4.1 Mishearing of Medical Terms & Numbers
- **Risk**: A doctor says "amoxicillin 500mg" or "বিপি ১২০/৮০", and speech recognition outputs a misspelled brand or incorrect digit.
- **Mitigation**:
  1. **Strict Read-Back & Confirmation**: The assistant repeats back what it heard and highlights low-confidence tokens in amber on screen. It requires explicit doctor confirmation ("ঠিক আছে" or screen tap) before saving.
  2. **Deterministic Number Parser**: Dedicated parsing module for Bangla and English numbers and words ("দুই", "তিন", "পাঁচশো", "101.5", "one twenty over eighty"). The LLM is never allowed to guess numbers.
  3. **Fuzzy Formulary Matching**: Heard medicine names are matched using Levenshtein distance and phonetic matching against the DGDA `medicine_brands` table. If ambiguous, the top 2–3 matches are shown on screen for doctor selection.

### 4.2 Privacy, Confidentiality & Compliance
- **Risk**: Accidental eavesdropping in clinic rooms, PHI transmission to external clouds.
- **Mitigation**:
  1. **Zero Audio Storage**: Audio buffers are processed strictly in RAM and immediately garbage-collected after transcription.
  2. **Default Private Mode**: In speech output, patient names, phone numbers, and addresses are *never* vocalized. The assistant refers to the subject simply as *"রোগী"* (Patient) and instructs *"বিস্তারিত স্ক্রিনে দেখুন"* (See details on screen).
  3. **Pre-LLM De-Identification**: All transcripts undergo scrubbing via `deidentifyClinicalText` before any model reasoning.
  4. **Transparent Consent**: First-use privacy dialog explaining microphone usage and zero data retention.

### 4.3 Latency & Interaction Flow
- **Risk**: Doctor waits 8+ seconds for an answer, breaking conversational clinical flow.
- **Mitigation**:
  1. **5-Second Latency Budget**: STT (1.2s) -> Retrieval & Verification (1.5s) -> Summarization (0.8s) -> First TTS Chunk (1.0s).
  2. **Spoken Filler**: If retrieval takes more than 1.5 seconds, the avatar tilts its head, blinks, and utters a single calm filler: *"একটু দেখছি..."* (Checking...).
  3. **Instant Barge-In**: Tapping the avatar or pressing `Esc` immediately cancels audio playback and speech synthesis.

### 4.4 Cost & Token Control
- **Risk**: Unconstrained paid TTS/STT API costs.
- **Mitigation**:
  1. **Tiered Provider Architecture**: Free Browser Web Speech API (`webkitSpeechRecognition` & `speechSynthesis`) default for demo/local use; OpenAI Whisper & TTS available via admin configuration.
  2. **Role-Based Daily Quotas**: Daily minutes tracked in `voice_sessions`. When depleted, the assistant politely notifies: *"আজকের ভয়েস সীমা শেষ। টাইপ করে চালিয়ে যান।"*
  3. **Phrase Caching**: Common greetings and standard clinical prompts are hashed (SHA-256) and cached.

### 4.5 Mixed Bangla & English Medical Accents
- **Risk**: Doctors commonly speak "Banglish" (Bangla syntax with English medical terms: *"রোগীর dry cough আর high fever আছে"*).
- **Mitigation**:
  1. STT provider hints populated with common clinical terms, DGDA generic drug names, and anatomy terms.
  2. Speech grammar tolerant to bilingual code-switching.
  3. Continuous accuracy tracking with `npm run eval:voice` over a 50-sentence clinical benchmark.

---

## 5. System Architecture & Component Design

```
+-----------------------------------------------------------------------------------+
|                                  DOCTOR SCREEN                                    |
|                                                                                   |
|  [ Floating Avatar Button ]  <--- Tap / Hold Space / Ctrl+Space                   |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        VOICE ASSISTANT OVERLAY CONTAINER                          |
|  (Desktop: Docked Right Panel ~400px | Mobile: Bottom Drawer with Vaul)           |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | [DocMateAvatar]: Idle | Listening | Transcribing | Thinking | Speaking      |  |
|  | Status: "শুনছি..." | Live Audio Waveform | Barge-in on Tap/Esc              |  |
|  +-----------------------------------------------------------------------------+  |
|  | Conversation Bubble Stream (Doctor Speech & Assistant Reply with Citations) |  |
|  +-----------------------------------------------------------------------------+  |
|  | Editable Heard Transcript Preview (Amber highlights on low confidence)      |  |
|  +-----------------------------------------------------------------------------+  |
|  | Large Push-To-Talk Mic Button (>=64px) / Optional Tap-to-Talk Toggle       |  |
|  +-----------------------------------------------------------------------------+  |
|  | Quick Action Chips: [নতুন রোগী] [লাইব্রেরিতে খুঁজুন] [আরও তথ্য কী লাগবে?]   |  |
|  +-----------------------------------------------------------------------------+  |
|  | Controls Bar: Private Mode Toggle | Speed (0.8x-1.2x) | Voice | Settings    |  |
+----------------------------------------+------------------------------------------+
                                         |
                       Audio Streams / Text Transcripts
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        VOICE CORE ENGINE & PROVIDERS                              |
|                                                                                   |
|  [SttProvider Interface]              [TtsProvider Interface]                     |
|   ├── BrowserWebSpeechSTT (Default)    ├── BrowserSpeechSynthesis (Default)       |
|   ├── OpenAiWhisperSTT                 ├── OpenAiTTS                              |
|   └── CustomSttStub                    └── AzureBanglaTTSStub                     |
|                                                                                   |
|  [Voice Router & Intent Classifier]                                               |
|   ├── ask_library       --> searchLibraryText -> libraryExcerpts -> makeSpeakable |
|   ├── dictate_intake    --> extractClinicalFacts -> Draft Confirmation Card       |
|   ├── answer_followup   --> map to Question ID -> updateCase -> reAnalyze         |
|   ├── navigate          --> /patients/new, /patients, /cases, EvidenceSheet       |
|   ├── read_aloud        --> deterministicDoseToSpeech (Prescriptions/Schedule)    |
|   └── blocked_action    --> "এটি স্ক্রিনে নিশ্চিত করুন।" (Safety Gate)            |
+-----------------------------------------------------------------------------------+
```

---

## 6. Cartoon Character Design (`DocMateAvatar`)

- **Visual Style**: Clean, modern, warm, friendly doctor in a clinical teal/blue coat with stethoscope and approachable smile. Inline SVG designed from scratch (no external fonts, 0 proprietary copyright infringement).
- **File Asset Architecture**:
  - `src/components/voice/DocMateAvatar.tsx` (Component controller)
  - `public/avatar/docmate-idle.svg`, `docmate-listening.svg`, `docmate-thinking.svg`, `docmate-speaking.svg`, `docmate-alert.svg`, `docmate-happy.svg`, `docmate-confused.svg`.
- **States & Micro-Interactions**:
  1. `idle`: Gentle breath animation, blinks every 3.5 seconds.
  2. `listening`: Focused expression, subtle glowing teal pulse ring around stethoscope.
  3. `transcribing`: Attentive tilt, processing wave indicator.
  4. `thinking`: Pondering head tilt, hand on chin, floating lightbulb/cog dots.
  5. `speaking`: Animated mouth aperture scaling with audio `amplitude` (0.0 to 1.0) or rhythmic phonetic modulation; eyes expressive.
  6. `alert`: Serious posture, alert badge, warm amber highlight.
  7. `happy`: Approving nod and smile upon successful confirmation.
  8. `confused`: Curious eyebrow raise when asking the doctor to repeat.
- **Accessibility & Performance**:
  - `prefers-reduced-motion`: Replaces animations with crisp static vector poses accompanied by text badges.
  - Scales cleanly at `sm` (40px icon), `md` (80px panel header), `lg` (180px–240px main panel hero).
  - Lightweight payload: Entire SVG asset suite < 35 KB total.

---

## 7. Data Models & Database Migrations

### Migration `migrations/0005_phase7_voice_assistant.sql`:
1. **`voice_sessions` Table**:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - `case_id UUID REFERENCES cases(id) ON DELETE SET NULL`
   - `stt_seconds NUMERIC(8,2) DEFAULT 0 NOT NULL`
   - `tts_chars INTEGER DEFAULT 0 NOT NULL`
   - `stt_provider VARCHAR(50) DEFAULT 'browser' NOT NULL`
   - `tts_provider VARCHAR(50) DEFAULT 'browser' NOT NULL`
   - `estimated_cost NUMERIC(8,4) DEFAULT 0 NOT NULL`
   - `started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`
   - `ended_at TIMESTAMPTZ`
2. **`voice_turns` Table**:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE`
   - `intent VARCHAR(50) NOT NULL` (`ask_library`, `dictate`, `answer_followup`, `navigate`, `read_aloud`, `blocked_action`)
   - `status VARCHAR(50) NOT NULL` (`ok`, `low_confidence`, `failed`, `blocked`)
   - `latency_ms INTEGER DEFAULT 0 NOT NULL`
   - `error_code VARCHAR(50)`
   - `created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`
   *(Zero raw transcript or audio storage)*
3. **Features & Role Permissions Registration**:
   - `voice.assistant`: Talk to DocMate voice assistant
   - `voice.dictation`: Dictate clinical intake and case notes
   - `voice.avatar`: Render animated cartoon avatar
   - `voice.readaloud`: Read prescription and schedule aloud
   - Default limits and feature toggles seeded across the 6 roles.

---

## 8. Phased Implementation Roadmap

- [ ] **Phase 0: Architecture & Foundation**
  - Read repository pipelines and AGENTS.md requirements.
  - Write `ANALYSIS_VOICE.md` (this document).
- [ ] **Phase 1: Providers, State Machine, DB Migrations & Feature Access**
  - Implement `SttProvider` & `TtsProvider` interfaces with Browser Web Speech adapters.
  - Create database migration `migrations/0005_phase7_voice_assistant.sql` and runner `scripts/migrate-voice-schema.ts`.
  - Add feature keys to `src/types/index.ts`, `src/lib/permissions.ts`, and `docs/ACCESS.md`.
  - Build `VoiceContext` state machine (`idle` -> `listening` -> `transcribing` -> `thinking` -> `speaking`).
- [ ] **Phase 2: Animated Cartoon Doctor Avatar (`DocMateAvatar`)**
  - Create vector SVG assets in `public/avatar/` for all 7 states.
  - Build `DocMateAvatar` component with amplitude mouth movement and `prefers-reduced-motion` support.
  - Test rendering across light/dark themes and sizes (`sm`, `md`, `lg`).
- [ ] **Phase 3: Voice Panel UI, Push-to-Talk, Captions & Library Voice Q&A**
  - Build responsive voice panel (Desktop docked panel, Mobile bottom drawer with Vaul).
  - Implement Push-to-Talk, Tap-to-Talk, keyboard shortcuts (Space/Ctrl+Space), and barge-in (Esc/Tap).
  - Implement `makeSpeakable(verifiedResult, locale)` and connect voice questions to `/api/ask`.
  - Floating character trigger button in `AppShell`.
- [ ] **Phase 4: Clinical Dictation & Follow-up Answering**
  - Build deterministic Bangla/English number parser and dose-to-speech converter.
  - Build clinical intake voice dictation with read-back card and confirmation.
  - Build voice answering for case missing-information follow-up questions.
  - Integrate fuzzy formulary medicine matcher.
- [ ] **Phase 5: Super Admin Governance, Paid Provider Adapters & Patient Read-Aloud**
  - Build `/admin/voice` control page with provider switches, limits, persona, and metrics.
  - Implement OpenAI Whisper STT and OpenAI TTS adapters.
  - Build `npm run eval:voice` benchmark runner over 50 test sentences.
  - Add "শুনুন" (Listen) read-aloud button to patient portal medication schedule and prescriptions.
- [ ] **Phase 6: Hardening, Test Suites, Compliance Docs & Multi-Device Verification**
  - Comprehensive Vitest unit tests (state machine, dose converter, number parser, `makeSpeakable`, access gates).
  - E2E Playwright tests with mocked STT/TTS.
  - Write `docs/VOICE_TESTING.md` and update `docs/COMPLIANCE.md`.
  - Visual verification at 390px (mobile), 768px (tablet), and 1280px (desktop) in Bangla and English.
