<div align="center">

# 🩺 DocMate AI (ডকমেট এআই)

**Bilingual Clinical Decision Support Assistant with Verbatim Citation Verification & Deterministic Drug Safety**

[![Next.js](https://img.shields.io/badge/Next.js-16.4-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_+_pgvector-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-Base_UI-18181B?style=for-the-badge)](https://ui.shadcn.com/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-Unit_Tests-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)

[Live Demo (Render)](https://docmate-ai-powered-doctor-assistant-6lld.onrender.com) · [Features](#-core-capabilities) · [Screenshots](#-screenshots) · [Demo Accounts](#-demo-accounts) · [Architecture](#-system-architecture) · [Project Structure](#-project-structure) · [Quickstart](#-local-quickstart)

</div>

---

> [!IMPORTANT]
> **Clinical Decision Support Only. Not a substitute for professional judgement.**
> *(শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।)*
>
> **Demo Scope & Safety Gates:** DocMate AI is a **synthetic-data demonstration**. Clinical assessment abstains (`insufficient_evidence`) and surfaces follow-up questions when vitals or clinical data are missing. Automated treatment, prescription finalization (`HTTP 409` safety stop), and official prescription printing remain **disabled** pending clinical trial validation. See [QA_REPORT.md](QA_REPORT.md) and [Patient_Workflow_Readiness.md](output/patient-qa/Patient_Workflow_Readiness.md).

---

## 🏆 Competition Track & Declared Challenges

| Field | Submission Declaration |
| :--- | :--- |
| **Selected Track** | **World Problem Solver Track** — Healthcare safety, clinical decision support, and patient-controlled medical records in Bangla & English |
| **Challenge 1 (`A02`)** | **Intelligent Decisions & Optimization** — Closed-library RAG with deterministic whitespace-normalized quote verification, deterministic drug safety rules (allergies, DDI, dose bounds), and automatic `insufficient_evidence` abstention when vitals or library evidence are missing |
| **Challenge 2 (`A03`)** | **Advanced Security & Access Control** — 6-role RBAC + dynamic feature permission matrix, profile-level report authorization (`authorizePatientProfileAccess`), AES PII encryption, prompt-injection & SSRF guards, atomic `db.transaction()` grant revocation, and immutable audit logs |

---

## 🌐 Project Demo Links

| Environment | URL | Notes |
| :--- | :--- | :--- |
| **Live Hosted Demo (Render)** | https://docmate-ai-powered-doctor-assistant-6lld.onrender.com | Default locale redirects to `/bn` |
| **English Portal (Render)** | https://docmate-ai-powered-doctor-assistant-6lld.onrender.com/en/login | Quick demo login buttons available |
| **Bangla Portal (Render)** | https://docmate-ai-powered-doctor-assistant-6lld.onrender.com/bn/login | Full Bangla UI & clinical terminology |
| **Local Development** | `http://localhost:3000` | Runs with `pnpm run dev` or `pnpm start` |

### Key Application Routes

| Role / Workspace | Route (`en` / `bn`) | Purpose |
| :--- | :--- | :--- |
| **Landing Page** | `/en` · `/bn` | Overview, safety pillars, and role entry |
| **Unified Login** | `/en/login` · `/bn/login` | Staff email login & Patient Mobile OTP login |
| **Doctor Dashboard** | `/en/dashboard` | Quick actions, KPIs, active/completed cases, blinking top-bar danger alerts |
| **Patient Cases** | `/en/cases` | Fixed-viewport, searchable, filterable case table |
| **Case Workspace** | `/en/cases/[id]` | Conversational assistant, differentials, missing info, safety checks, draft report |
| **New Patient Intake** | `/en/patients/new` | Phone lookup, family profiles, unpreset vitals, affirmative consent |
| **Ask Medical Library** | `/en/ask` | Closed-library Q&A with clickable verbatim `EvidenceSheet` proofs |
| **Medical Library** | `/en/library` | Browse approved guidelines & inspect indexed chunks |
| **Patient Portal** | `/en/portal` | Family profiles, daily meds tracker, prescriptions, report upload, consent & audit logs |
| **Student Workspace** | `/en/study` | Practice clinical vignettes, quizzes, and study notes |
| **Research Suite** | `/en/research` | Cross-evidence search, collections, and citation exports |
| **Medicine Controller** | `/en/controller` | DGDA formulary management, pricing, and safety notices |
| **Admin Control Plane** | `/en/admin` | Users, verifications, access matrix, library ingestion queue, voice/AI settings, audit log |

---

## 🔑 Demo Accounts

All demo accounts are pre-seeded via `pnpm run seed` and available as one-click shortcuts on `/en/login` and `/bn/login`.

### Staff & Clinical Roles (Email + Password)

| Role | Email | Password | Default Workspace | Key Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Doctor (Clinical Lead)** | `doctor@docmate.ai` | `demo123` | `/en/dashboard` | Patient lookup & intake, case workspace, follow-up turns, draft safety review |
| **Student (Medical Trainee)** | `student@docmate.ai` | `demo123` | `/en/study` | Virtual clinical cases, quizzes, study notes, cited library Q&A |
| **Researcher** | `researcher@docmate.ai` | `demo123` | `/en/research` | Guideline search, research collections, structured exports |
| **Medicine Controller (DGDA)** | `controller@docmate.ai` | `demo123` | `/en/controller` | Formulary review, brand pricing, interaction rules, safety recall notices |
| **Super Admin (Security)** | `admin@docmate.ai` | `demo123` | `/en/admin` | Role access matrix, user verification, library ingestion pipeline, audit ledger |

### Patient Portal Accounts (Mobile Phone + Demo OTP)

| Account | Mobile Number | Demo OTP | Profiles Included |
| :--- | :--- | :--- | :--- |
| **Kamal Hossain** | `01700000001` | `123456` | Self profile, medication tracker, reports & consent logs |
| **Rafiqul & Family** | `01700000002` | `123456` | Multi-profile family account switcher |
| **Fatema Begum** | `01700000003` | `123456` | Self profile, prescriptions & access grants |

### Seeded Synthetic Patient Fixtures
- `P-101` — Fever and cough
- `P-102` — Chest pain
- `P-103` — Vague malaise without recorded vitals (triggers `insufficient_evidence` + follow-up questions)

---

## 📸 Screenshots

### Doctor & Clinical Workspaces
<table>
  <tr>
    <td width="50%" align="center">
      <strong>Doctor Portal Dashboard (Desktop)</strong><br/><br/>
      <img src="output/ux-rbac/doctor-dashboard-en-1280.png" alt="Doctor Dashboard" width="100%"/>
    </td>
    <td width="50%" align="center">
      <strong>Patient Intake — Unpreset Vitals Review</strong><br/><br/>
      <img src="output/patient-qa/evidence/01_doctor_intake_review_missing_vitals.png" alt="Intake Review Missing Vitals" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <strong>Case Workspace — Missing Info State</strong><br/><br/>
      <img src="output/patient-qa/evidence/02_doctor_case_missing_info.png" alt="Case Missing Info" width="100%"/>
    </td>
    <td width="50%" align="center">
      <strong>Admin Control Plane (Desktop)</strong><br/><br/>
      <img src="output/ux-rbac/admin-admin-en-1280.png" alt="Admin Dashboard" width="100%"/>
    </td>
  </tr>
</table>

### Patient Portal & Mobile Responsiveness
<table>
  <tr>
    <td width="50%" align="center">
      <strong>Patient Portal — Today's Medications</strong><br/><br/>
      <img src="output/patient-qa/evidence/04_patient_portal_today_tab.png" alt="Patient Portal Today Tab" width="100%"/>
    </td>
    <td width="50%" align="center">
      <strong>Patient Portal — Secure Report Upload</strong><br/><br/>
      <img src="output/patient-qa/evidence/05_patient_reports_uploaded.png" alt="Patient Report Upload" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <strong>Student Workspace (Desktop)</strong><br/><br/>
      <img src="output/ux-rbac/student-study-en-1280.png" alt="Student Workspace" width="100%"/>
    </td>
    <td width="50%" align="center">
      <strong>Bangla Patient Portal (390px Mobile)</strong><br/><br/>
      <img src="output/patient-qa/evidence/viewport_mobile_390px_portal_tabs_bn.png" alt="Mobile Patient Portal Bangla" width="55%"/>
    </td>
  </tr>
</table>

---

## ✨ Core Capabilities

- **Closed-Library RAG with Verbatim Verification**: Every clinical claim cites a specific `chunk_id` and exact verbatim quote. Backend verification normalizes whitespace and drops any unverified claim before rendering.
- **Abstention by Design**: Missing vitals or low retrieval confidence return `insufficient_evidence` with actionable `missing_information` questions—never guessed values or fallback measurements.
- **Top-Bar Blinking Danger Alerts**: Doctors see a pulsing header alert indicator for critical drug recalls, red-flag cases, and incomplete cases, opening a modal where each alert navigates directly to the affected case or notice.
- **Deterministic Drug Safety Engine**: Doses, frequencies, allergies, contraindications, and drug-drug interactions are evaluated by pure TypeScript rules against structured database tables—never free-form LLM text.
- **Patient-Controlled Privacy & Atomic Revocation**: Patients can upload private lab/imaging reports (stored privately on disk with MIME/size validation), toggle sharing per report, view audit logs, and atomically revoke doctor access in a single database transaction.
- **Full Bilingual Support (`bn` Default & `en`)**: Complete UI and clinical terminology parity across Bangla and English (`tests/i18n-parity.test.ts`), including Banglish phonetic canonicalization and optional local/cloud voice synthesis.
- **Document Ingestion Pipeline**: Supports PDF (with Tesseract OCR fallback), DOCX, HTML, Markdown, TXT, JSON, and ZIP archives with SHA-256 deduplication, SimHash-64 fingerprinting, prompt-injection scanning, and budget governance.

---

## 🏗 System Architecture

```mermaid
flowchart LR
    UI["Next.js 16 App Router UI<br/>(Doctor · Patient · Student · Researcher · Controller · Admin)"]
    Auth["Auth & RBAC Middleware<br/>(Signed Session Cookie · Role Matrix · Rate Limit)"]
    API["REST API Routes (/api/*)"]
    RAG["Closed-Library Engine<br/>(Hybrid TSV + pgvector · Verbatim Quote Verifier)"]
    Safety["Deterministic Safety Engine<br/>(Allergies · DDI · Dose Bounds · 409 Finalize Gate)"]
    Ingest["Ingestion Worker & Pipeline<br/>(PDF/DOCX/OCR · Chunker · Safety Scanner)"]
    DB[("PostgreSQL 16 + pgvector<br/>(Drizzle ORM · AES PII Encryption)")]
    Storage[("Private File Storage<br/>(data/storage/patient-reports & sources)")]

    UI --> Auth --> API
    API --> RAG --> DB
    API --> Safety --> DB
    API --> Ingest --> DB
    Ingest --> Storage
    API --> Storage
```

---

## 📁 Project Structure

```text
docmate-AI/
├── messages/                       # Bilingual i18n dictionaries (bn.json, en.json)
├── migrations/                     # Sequential PostgreSQL SQL migrations (0000..0014)
├── public/                         # Static assets & voice sample clips
├── scripts/                        # DB migrate, seed, ingestion CLI, eval & Playwright verification
├── tests/                          # Vitest unit, security, privacy, and i18n parity suites
├── e2e/                            # Playwright end-to-end specs
├── docs/                           # Architecture, RBAC, and deployment guides
├── output/                         # QA reports, benchmarks, and Playwright screenshot evidence
├── src/
│   ├── app/
│   │   ├── [locale]/               # Localized App Router pages (en / bn)
│   │   │   ├── admin/              # Admin control plane (users, library, access, ai, voice, audit)
│   │   │   ├── ask/                # Closed-library Q&A interface
│   │   │   ├── cases/              # Cases table & [id] clinical workspace
│   │   │   ├── controller/         # DGDA medicine controller portal
│   │   │   ├── dashboard/          # Doctor dashboard
│   │   │   ├── library/            # Browseable medical library
│   │   │   ├── login/              # Unified staff & patient OTP login
│   │   │   ├── patients/           # Patient directory, profile & intake wizard
│   │   │   ├── portal/             # Patient personal & family portal
│   │   │   ├── prescriptions/      # Draft prescriptions & safety checks
│   │   │   ├── research/           # Research suite & collections
│   │   │   ├── settings/           # User, AI credential, voice & language settings
│   │   │   ├── study/              # Student practice workspace
│   │   │   └── verify/rx/          # Prescription QR verification view
│   │   └── api/                    # Backend Route Handlers (auth, cases, patient, library, admin, voice)
│   ├── components/
│   │   ├── admin/                  # Admin tour & controls
│   │   ├── case-chat/              # Clinical chat, composer, follow-up cards & safety alerts
│   │   ├── settings/               # AI credentials & assistant config cards
│   │   ├── shared/                 # AppShell, DoctorDangerAlerts, EvidenceSheet, ConsentSheet, etc.
│   │   ├── ui/                     # shadcn/ui + Base UI primitives (Sheet, Dialog, AlertDialog, Drawer...)
│   │   └── voice/                  # DocMateAvatar, VoicePanel & VoiceFloatingButton
│   ├── context/                    # VoiceContext & client state providers
│   ├── db/                         # Drizzle schema & pooled PostgreSQL connection
│   ├── i18n/                       # next-intl routing & request config
│   ├── lib/
│   │   ├── assistant/              # Closed-library prompt, engine & quote verification
│   │   ├── clinical/               # Deterministic drug safety, red flags & extractor
│   │   ├── ingestion/              # Extractors (PDF/DOCX/HTML/JSON/TXT), OCR, chunker, dedup
│   │   ├── language/               # Bangla/English/Banglish normalization
│   │   ├── persona/                # Clinical communication style & phrasebank
│   │   ├── queue/                  # PostgreSQL-backed ingestion job queue
│   │   ├── storage/                # Local private storage driver
│   │   └── voice/                  # Edge TTS, local Maya 2 bridge & dose speech formatting
│   ├── workers/                    # Background ingestion worker
│   └── proxy.ts                    # Next.js 16 locale & RBAC session proxy
├── Dockerfile                      # Production multi-stage Docker image
├── docker-compose.yml              # Local PostgreSQL + pgvector service
├── render.yaml                     # 1-click Render Blueprint
└── package.json                    # Scripts & dependencies
```

---

## 🚀 Local Quickstart

### Prerequisites
- **Node.js** `>= 20.18.0` (20.x series recommended)
- **pnpm** `>= 9.0.0` (or `npm`)
- **PostgreSQL 16** with `pgvector` (Docker Compose included)

### 1. Environment & Database Setup

```bash
cp .env.example .env
# Generate a 32-byte hex secret and set AUTH_SECRET in .env
openssl rand -hex 32

# Start PostgreSQL with pgvector
docker compose up -d postgres

# Install dependencies
pnpm install --frozen-lockfile
```

### 2. Migrate, Ingest & Seed

```bash
export DATABASE_URL='postgresql://docmate:docmate_dev_password@localhost:5432/docmate'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS vector'

pnpm run migrate
pnpm run ingest
pnpm run seed
```

### 3. Run the Application

```bash
# Development (with hot reload)
pnpm run dev

# Or Production Build & Start
pnpm run build
pnpm start -p 3000
```

Open **`http://localhost:3000`** (defaults to `/bn`; switch to `/en` anytime via the header language toggle).

### Cloud Deployment
- **Render Blueprint**: 1-click setup via `render.yaml` — see [docs/RENDER_AND_VERCEL_DEPLOYMENT.md](docs/RENDER_AND_VERCEL_DEPLOYMENT.md).
- **Docker / VPS**: Full production operations guide in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 🧪 Testing & Quality Checks

| Check | Command | Coverage |
| :--- | :--- | :--- |
| **Unit & Security Suite** | `pnpm test` | Citation verification, vitals fallback regression, report authorization, atomic consent revocation, login security, i18n key parity |
| **TypeScript Check** | `pnpm run typecheck` | Full strict TypeScript check (`tsc --noEmit`) |
| **ESLint** | `pnpm run lint` | Next.js + TypeScript lint rules |
| **Playwright E2E** | `pnpm run test:e2e` | End-to-end synthetic doctor, patient, library, and responsive viewport tests |
| **Workflow Profiler** | `node --env-file-if-exists=.env --import tsx scripts/profile-workflow.ts` | Production endpoint latency benchmarks |

---

## 📚 Additional Documentation

- [Patient-Centred Architecture & Workflows](docs/PATIENT_FLOW.md)
- [Access Control & Dynamic Feature Matrix](docs/ACCESS.md)
- [Patient Workflow Readiness & E2E Evidence](output/patient-qa/Patient_Workflow_Readiness.md)
- [QA Release Assessment](QA_REPORT.md)
- [Render & Vercel Deployment Guide](docs/RENDER_AND_VERCEL_DEPLOYMENT.md)

---

## 📄 License & Standards
Built for hackathon demonstration using **synthetic patient data only** (`P-101`, `P-102`, `P-103`). Real clinical and commercial deployment remain out of scope pending prospective clinical validation.
