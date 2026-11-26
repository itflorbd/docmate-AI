# DocMate AI (ডকমেট এআই) — Official Project Documentation

**Competition:** Code-ArenaX · Hack the Vibe 2026 (Solo Vibe Coding Championship)  
**Selected Track:** World Problem Solver Track  
**Declared Advanced Challenges:** `A02` (Intelligent Decisions & Optimization) · `A03` (Advanced Security & Access Control)  
**Repository:** https://github.com/itflorbd/docmate-AI  
**Live Deployment:** https://docmate-ai-powered-doctor-assistant-6lld.onrender.com  

> **Clinical Safety Notice:**  
> *Clinical decision support only. Not a substitute for professional judgement.*  
> *(শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।)*

---

## 1. Project Overview

**DocMate AI** is a bilingual (**Bangla & English**) clinical decision support platform built to assist physicians, medical trainees, researchers, drug regulators, and patients using **closed-library retrieval**, **verbatim citation verification**, and **deterministic medication safety checks**.

Unlike open-ended generative chatbots that can hallucinate clinical facts or fabricate references, DocMate AI restricts every clinical answer to an approved internal library of medical guidelines and textbooks. Every clinical claim is linked to a specific `chunk_id` and verified against the stored passage using deterministic whitespace-normalized matching. When vital signs or library evidence are missing, the system abstains (`insufficient_evidence`) and surfaces structured follow-up questions instead of guessing.

---

## 2. Selected Problem-Solving Track

**Track:** **World Problem Solver Track**  
**Domain:** Public Health Access, Clinical Safety, and Patient-Controlled Medical Records

Healthcare providers in high-volume clinics face fragmented patient histories, language barriers between Bangla-speaking patients and English clinical literature, and medication safety risks (allergies, drug–drug interactions, and dosing errors). DocMate AI addresses this real-world problem by combining verified bilingual clinical reference retrieval with deterministic safety checks and patient-owned consent controls.

---

## 3. Problem Statement & Intended Users

### Problem Statement
1. **Unverified AI Hallucinations in Healthcare:** General-purpose AI tools can invent diagnoses, doses, or citations without grounding in approved medical guidelines.
2. **Assumed Measurements & Missing Clinical Context:** Intake forms that pre-fill "normal" vital signs mask missing physical exam data and mislead downstream clinical reasoning.
3. **Fragmented Patient Records & Consent Gaps:** Patients often lack visibility or control over who accesses their lab reports and clinical history.
4. **Language Barriers:** Clinicians and patients in Bangladesh need seamless Bangla (`bn`) and English (`en`) workflows, including Banglish phonetic query support.

### Intended Users (6 Role-Based Personas)
| Role | Primary Needs & Workflows |
| :--- | :--- |
| **Doctor (Physician)** | Fast patient phone lookup, unpreset clinical intake, multi-turn case workspace, follow-up tracking, drug safety review, and top-bar danger alerts. |
| **Patient** | Mobile OTP sign-in, multi-profile family management, daily medication schedule tracking, private report uploads, and granular doctor access revocation. |
| **Medical Student** | Practice clinical vignettes, diagnostic quizzes, study notes, and guideline Q&A with exact source citations. |
| **Medical Researcher** | Cross-evidence literature search, structured research collections, and citation exports. |
| **Medicine Controller (DGDA)** | Formulary governance, generic/brand pricing management, interaction rules, and critical drug recall notices. |
| **Super Admin** | User verification, dynamic role-feature access matrix, library document ingestion pipeline, AI/voice routing, and immutable audit ledger. |

---

## 4. Implemented Features

### A. Doctor Clinical Workspace
- **Doctor Dashboard (`/dashboard`):** Quick clinical action cards (New Intake, Ask Library, All Cases), live KPI metrics (Patients, Active Cases, Completed Cases, Prescriptions), responsive mobile case cards, and desktop tables.
- **Top-Bar Blinking Danger Alerts (`DoctorDangerAlerts`):** Pulsing danger indicator in the global header whenever critical drug recall notices, `red_flag` cases, or `insufficient_evidence` cases exist; opens a modal where each alert acts as a direct navigation button to the affected case or notice page.
- **Patient Cases (`/cases`):** Compact narrow header/filter bar with a fixed-viewport table and sticky column headers where only rows scroll internally.
- **4-Step Patient Intake (`/patients/new`):** Phone search across family profiles, affirmative storage consent checkbox (unchecked by default), and vital signs inputs with **zero hardcoded presets or fallbacks**—unrecorded fields are preserved as `Not recorded` / `রেকর্ড করা হয়নি`.
- **Case Workspace (`/cases/[id]`):** Unified header bar, conversational follow-up turns, ranked differentials, missing information alerts, deterministic treatment/safety checks, `PatientDetailSheet`, `ConfirmDiagnosisDialog`, and draft visit report.

### B. Closed-Library Q&A & Document Ingestion
- **Ask Medical Library (`/ask`):** Accepts English, Bangla, and Banglish queries; returns answers strictly grounded in indexed library chunks with clickable `CitationChip` badges opening `EvidenceSheet` (showing source title, page, section, verbatim quote, and full passage). Out-of-domain queries abstain cleanly.
- **Multi-Format Ingestion Pipeline (`/admin/library`):** Supports PDF (with Tesseract.js OCR fallback for scanned documents), DOCX (`mammoth`), HTML (`@mozilla/readability`), Markdown, TXT, JSON, and ZIP archives. Includes SHA-256 deduplication, SimHash-64 fingerprinting, prompt-injection scanning, and budget governance.

### C. Patient Portal & Privacy Controls (`/portal`)
- **Multi-Profile Family Switcher:** Manage self and dependent family member profiles (`Sheet` drawer).
- **Hero Health Overview & 4-Tile Summary:** Displays blood group, allergies, chronic conditions, and live counts for Today's Meds, Prescriptions, Reports, and Active Doctor Access.
- **Real File Upload & Private Storage:** Native file picker with server-side MIME/size validation (≤ 10 MB), private disk storage (`data/storage/patient-reports/`), authorized streaming downloads, and per-report doctor sharing toggle (`is_shared`).
- **Consent & Audit Transparency:** `AlertDialog`-confirmed doctor access revocation executed atomically in a PostgreSQL transaction alongside a chronological *"Who Viewed My Records"* audit log.

---

## 5. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework & Language** | Next.js 16.4 (App Router + Turbopack), React 19.3, TypeScript 5 |
| **UI & Styling** | Tailwind CSS v4, shadcn/ui + Base UI (`Sheet`, `Dialog`, `AlertDialog`, `Drawer`, `Tabs`), Lucide Icons, Sonner |
| **Internationalization** | `next-intl` 4.15 (`bn` default & `en` with strict key parity) |
| **Database & ORM** | PostgreSQL 16 + `pgvector` extension, Drizzle ORM 0.45, `pg` connection pool |
| **Security & Crypto** | Argon2id / Scrypt password hashing, HMAC-SHA256 `httpOnly` sessions, AES PII encryption, Zod 4 validation |
| **Document Processing** | `pdf-parse`, `mammoth` (DOCX), `tesseract.js` (OCR), `adm-zip`, `@mozilla/readability` |
| **Voice & Accessibility** | Web Speech API, `msedge-tts`, optional local Maya 2 neural voice bridge |
| **Testing & Quality** | Vitest 5, Playwright 1.65 (Chromium E2E), ESLint 9, TypeScript strict check |

---

## 6. System Architecture & Main Workflows

```text
[Next.js 16 App Router UI (Doctor · Patient · Student · Researcher · Controller · Admin)]
                                      │
                                      ▼
[Proxy & RBAC Layer (Signed Session Cookie · Role-Feature Matrix · Rate Limiting)]
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
[Closed-Library Engine]     [Deterministic Safety]      [Ingestion Worker]
• Hybrid TSV + pgvector     • Allergies & DDI rules     • PDF/DOCX/OCR extraction
• Verbatim Quote Verifier   • Dose bounds check         • Chunker & SimHash-64
• Abstention on gaps        • HTTP 409 Finalize Gate    • Prompt-injection scan
         │                            │                            │
         └────────────────────────────┼────────────────────────────┘
                                      ▼
       [PostgreSQL 16 + pgvector (Drizzle ORM · AES PII Encryption)]
                                      +
       [Private Disk Storage (data/storage/patient-reports & sources)]
```

### Main End-to-End Workflows
1. **Doctor Clinical Workflow:** Sign in → Search patient by phone or create profile with affirmative consent → Record symptoms & optional vitals (absent vitals stay unrecorded) → Review `insufficient_evidence` + follow-up questions in Case Workspace → Submit follow-up turns → Confirm working diagnosis & inspect draft report.
2. **Patient Privacy Workflow:** Sign in via Mobile OTP → Switch between family profiles → Track daily medication doses → Upload a lab/imaging PDF/image report → Toggle doctor sharing visibility → Revoke doctor access atomically and verify audit log entry.
3. **Closed-Library Workflow:** Admin uploads PDF/DOCX guideline → 15-stage pipeline extracts, cleans, chunks, scans for prompt injection, and indexes → Clinician/Student queries `/ask` → System retrieves excerpts and verifies verbatim quotes before displaying `EvidenceSheet`.

---

## 7. Selected Advanced Challenges (Declared: `A02` & `A03`)

### Challenge 1: `A02` — Intelligent Decisions & Optimization
- **Implementation Details:**
  - **Closed-Library Grounding & Quote Verification (`src/lib/assistant/verify.ts`):** Every clinical claim must reference a retrieved `chunk_id` and exact substring. Deterministic backend code normalizes whitespace and drops any claim whose quote cannot be verified in the cited chunk.
  - **Abstention by Design (`src/app/api/cases/[id]/analyze/route.ts`):** When vital signs are unrecorded (`hasRecordedVitals === false`) or library evidence is insufficient, the engine returns `insufficient_evidence` with structured `missing_information` prompts rather than fabricating clinical recommendations.
  - **Deterministic Drug Safety (`src/lib/clinical/`):** Medication dosing, allergies, and drug–drug interactions are computed deterministically from structured formulary tables rather than free-form LLM generation.
  - **Query & Latency Optimization:** Parallelized 8 independent SQL queries in `/api/patient/portal` via `Promise.all()` (reducing median portal load latency from 1,105 ms to 399 ms, a 63.9% improvement) and bypassed full-table PII decryption scans in `/api/patient/search` when an account profile already exists.
- **Boundary & Edge-Case Handling:** Out-of-domain queries (e.g., non-medical trivia) return `found: false` with zero hallucinated claims; untouched or cleared vital sign inputs remain `null`/`undefined` and render as `Not recorded`.

### Challenge 2: `A03` — Advanced Security & Access Control
- **Implementation Details:**
  - **Fine-Grained RBAC & Resource Isolation (`src/lib/permissions.ts`, `src/lib/patient-authorization.ts`):** Enforces 6 distinct roles plus a dynamic feature-permission matrix (`canUse()`). Patient report listing, uploading, downloading, and sharing enforce `authorizePatientProfileAccess()`, restricting access strictly to the owning patient account or doctors holding an active, non-expired `access_grants` record (with `is_shared = true` filtering for doctors).
  - **Atomic Consent Revocation (`src/app/api/patient/grants/revoke/route.ts`):** Verifies profile ownership and wraps grant revocation (`access_grants`), consent history (`patient_consent_logs`), and access audit (`access_logs`) inside a single `db.transaction()`. Any audit-write failure rolls back the grant update.
  - **Defense-in-Depth Controls:** AES encryption for patient PII, `method="POST"` on staff login forms to prevent credential leakage in URL query strings during delayed hydration, SSRF URL guard (`ssrf-guard.ts`), prompt-injection scanning on ingested documents (`safety-scanner.ts`), private disk storage with rollback cleanup on DB insert failure, and `HTTP 409` safety stop on prescription finalization.
- **Boundary & Edge-Case Handling:** Cross-account access tests verify that Patient Account A cannot list, download, or toggle sharing on Patient Account B's reports (`HTTP 403`), and revoked doctors immediately lose access.

---

## 8. Setup & Deployment Information

*(Note: All secrets, passwords, and API keys are excluded from documentation and configured exclusively via environment variables.)*

### Prerequisites
- Node.js `>= 20.18.0` (20.x recommended)
- `pnpm >= 9.0.0` (or `npm`)
- PostgreSQL 16 with `pgvector` (Docker Compose configuration provided)

### Local Setup
```bash
# 1. Copy environment template and configure AUTH_SECRET, PATIENT_ENCRYPTION_KEY, and DATABASE_URL
cp .env.example .env

# 2. Start PostgreSQL with pgvector
docker compose up -d postgres

# 3. Install dependencies
pnpm install --frozen-lockfile

# 4. Enable pgvector, apply migrations, ingest demo library, and seed synthetic fixtures
pnpm run migrate
pnpm run ingest
pnpm run seed

# 5. Build and start
pnpm run build
pnpm start -p 3000
```

### Cloud Deployment (Render Blueprint)
- Defined in `render.yaml` (`docmate-ai` Docker web service + `docmate-db` PostgreSQL 16 managed database).
- Full step-by-step deployment instructions are documented in `docs/RENDER_AND_VERCEL_DEPLOYMENT.md` and `DEPLOYMENT.md`.
- Synthetic demo accounts for judge testing are provided privately in the submission portal.

---

## 9. Testing & Edge Cases

### Automated Unit & Regression Suites (`Vitest`)
- `tests/vitals-fallback-regression.test.ts` (4/4 passed): Verifies untouched, cleared, and explicitly entered vital signs never fall back to presets.
- `tests/patient-reports-auth.test.ts` (8/8 passed): Verifies two-account isolation, upload MIME/size validation, private storage, and cleanup on DB error.
- `tests/consent-revocation-tx.test.ts` (3/3 passed): Verifies atomic grant revocation and rollback when audit logging fails.
- `tests/login-form-security.test.ts` (3/3 passed): Verifies `method="POST"` prevents credential exposure in URLs under delayed hydration.
- `tests/i18n-parity.test.ts` (6/6 passed): Verifies 100% key parity between `messages/en.json` and `messages/bn.json`.
- `tests/ingestion-system.test.ts` (27/27 passed): Verifies magic-number validation, Bengali danda chunking, SimHash-64, SSRF guard, and prompt-injection detection.

### End-to-End Browser Verification (`Playwright`)
Executed via `scripts/verify-e2e-readiness.ts` against a production build (`next start`): **16/16 checks passed** covering:
- Doctor intake without vitals → `Not recorded` review → `insufficient_evidence` assessment.
- Patient OTP login → real PDF upload → authorized download stream → share toggle → atomic grant revocation.
- Ask Library queries in English, Bangla, Banglish, and out-of-domain abstention.
- Responsive viewports at `390px`, `768px`, and `1280px` with zero horizontal overflow.
- Clinical safety gate check confirming `POST /api/prescriptions/[id]/finalize` returns `HTTP 409`.

---

## 10. Known Limitations & Incomplete / Gated Features

In strict compliance with clinical safety rules, the following features are **intentionally gated or limited to synthetic demonstration**:

1. **Prescription Finalization & Official Printing (Intentionally Disabled):** `POST /api/prescriptions/[id]/finalize` returns `HTTP 409 Conflict` (`prescription_finalization_disabled`) and official prescription printing is disabled pending prospective clinical validation and verified clinician signing.
2. **Automated Clinical Assessment Abstention:** Automated treatment drafting and diagnosis confirmation remain physician-driven; clinical assessment abstains (`insufficient_evidence`) whenever required measurements or verified guideline excerpts are absent.
3. **Simulated Mobile OTP Delivery:** Patient login uses a deterministic demo OTP flow unless a live Bangladeshi telecom SMS gateway (`BD_SMS_GATEWAY_API_KEY`) is configured.
4. **Synthetic Data Only:** All patient records (`P-101`, `P-102`, `P-103`) and sample guidelines are synthetic fixtures for demonstration; the system is **not** cleared for real patient care (PHI).
5. **Ephemeral Container Storage:** On starter cloud containers without a persistent disk mount, uploaded files under `data/storage/` reset on container rebuilds unless backed by persistent disk or S3-compatible object storage.
6. **External Voice & Embedding Providers:** Optional cloud TTS and OpenAI embeddings require external API keys; without them, the system falls back gracefully to local PostgreSQL full-text search and device/Edge TTS voices.
