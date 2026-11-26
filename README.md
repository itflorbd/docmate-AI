# DocMate AI (ডকমেট এআই)
### Clinical Decision Support Assistant with Verbatim Citation Verification & Deterministic Drug Safety

> **Important Clinical Disclaimer**:
> **Clinical decision support only. Not a substitute for professional judgement.**
> *(শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।)*

---

## 1. Demo scope

DocMate AI is a synthetic-data demonstration. The clinical assessment endpoint currently abstains and exposes follow-up questions for physician review. Ask searches indexed text and shows exact source excerpts. Automated treatment, prescription finalization and prescription printing are disabled pending verification of the clinical evidence and authorization workflow. See [QA_REPORT.md](QA_REPORT.md) for the release assessment.

## 2. Quickstart

Use Node.js 20.19 or newer in the 20.x series, pnpm 9 or newer, and PostgreSQL with pgvector. Docker Compose can provide the documented local database.

```bash
cp .env.example .env
openssl rand -hex 32
docker compose up -d postgres
pnpm install --frozen-lockfile
```

Set `AUTH_SECRET` in `.env` to the generated value. The example enables demo logins for this local synthetic environment. Keep the embedding API key empty for offline ingestion. Copy the database URL from your local configuration if it differs from the Docker Compose default.

```bash
export DATABASE_URL='postgresql://docmate:docmate_dev_password@localhost:5432/docmate'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS vector'
pnpm exec drizzle-kit push
pnpm run ingest
pnpm run seed
pnpm run build
pnpm start -p 3000
```

Open `http://localhost:3000`. In a fresh session the default locale is Bangla. For hot reload, run `pnpm run dev --webpack` in place of the production build and start commands.

> **Cloud & Production Deployment**:
> - **Render & Vercel Guide**: Step-by-step instructions with 1-click Blueprint and screenshots in **[docs/RENDER_AND_VERCEL_DEPLOYMENT.md](docs/RENDER_AND_VERCEL_DEPLOYMENT.md)**.
> - **General Production Guide**: Bare-metal VPS (Nginx + PM2), Docker Compose, and operations in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## 3. Seeded Demo Accounts

You can sign in with any of the pre-seeded clinical personas:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Doctor (Physician)** | `doctor@docmate.ai` | `demo123` | Patient intake, clinical history, case workspace, prescribing |
| **Student** | `student@docmate.ai` | `demo123` | Study practice, virtual patient cases, cited library Q&A |
| **Researcher** | `researcher@docmate.ai` | `demo123` | Guideline search, cross-evidence comparison, citation exports |
| **Medicine Controller** | `controller@docmate.ai`| `demo123` | DGDA medicine formulary, brand pricing, interaction checks |
| **Admin** | `admin@docmate.ai` | `demo123` | Access matrix, patient governance, duplicate merges, audit ledger |
| **Patient (Phone + OTP)**| Phone: `01700000001` | OTP: `123456` | Multi-profile portal, daily medicine routine, access control |

For detailed workflow documentation:
- **[Patient-Centred Architecture & Workflows (PATIENT_FLOW.md)](docs/PATIENT_FLOW.md)**
- **[Access Control & Dynamic Feature Matrix (ACCESS.md)](docs/ACCESS.md)**
- **[Upgrade Analysis & Data Migration (ANALYSIS_PATIENT_UPGRADE.md)](ANALYSIS_PATIENT_UPGRADE.md)**

---

## 4. Seeded synthetic patient cases

The demo physician owns three fixtures: `P-101` (fever and cough), `P-102` (chest pain), and `P-103` (vague malaise without recorded vitals). Use them only to exercise the application. Automated clinical assessment currently returns `insufficient_evidence`.

### Voice assistant demo

Open the voice panel and choose **Auto**, **বাংলা**, or **English** under **Conversation language**. Auto follows each typed or transcribed turn, including common Banglish phrases. Its microphone starts in the page language and follows the most recent reply language. For spoken input, select Bangla or English before recording if you want to switch. The page language stays as selected in the app. Library excerpts retain the source wording and language.

In Settings, use **Sample Voice** to compare the Friendly and Reserved presets and adjust the speaking rate. The default engine uses installed Bangla and English device voices. Super admins can select **Expressive cloud voice for assistant messages** under **Engine & Routing** on `/en/admin/voice` (or `/bn/admin/voice`) when an OpenAI key is configured. It applies to scripted assistant messages and previews. Case and medication read-aloud use device voices. If cloud playback fails, DocMate tries the installed voice for the spoken language and displays a translated message if that voice is unavailable.

The Maya option includes short, pre-rendered Bangla and English greetings with the Friendly female voice. Select **Maya neural voice (local)** in **Engine & Routing** to hear them. Settings previews use clips generated from DocMate’s public greeting text using Maya’s Jahnavi preset. They play without downloading a model. To synthesize the other replies and voice presets locally, use [Maya 2 Native](https://huggingface.co/maya-research/maya2-native). On Apple Silicon install the [MLX port](https://github.com/AkashKhamkar/maya2-mlx) in a separate Python environment. The first startup downloads about 5 GB of model weights plus the codec. No API key is required.

```sh
python3.12 -m venv .maya-local/venv
.maya-local/venv/bin/pip install 'maya2-mlx @ git+https://github.com/AkashKhamkar/maya2-mlx.git@b722de398cec5c51e78190017971d18fa0c90726'
HF_HOME="$PWD/.maya-local/hf" .maya-local/venv/bin/maya2 --quantize 4 serve --host 127.0.0.1 --port 8319
```

Set `DOCMATE_MAYA_PORT=8319` in `.env.local` and restart DocMate. In **Engine & Routing** on `/en/admin/voice`, select **Maya neural voice (local)**, click **Test Audio** to check live synthesis, then save. The personal **Sample Voice** preview can play from the bundled clips. DocMate sends scripted assistant speech to the loopback engine. The live greeting and replies use the same Maya speaker. If Maya is unavailable before a message starts playing, DocMate uses the installed voice for each language for the rest of the conversation. Reload the page to let Maya try again. The reply stays visible if playback is unavailable. Speech is labelled AI-generated.


## 5. System architecture

The Next.js workspace stores cases, physician follow-up turns and audit events in PostgreSQL. Case API reads and writes are scoped to the authenticated physician. Library ingestion stores source metadata, chunks and full-text vectors. The active Ask route searches text and displays verbatim, verified source excerpts. Optional pgvector embeddings are available to the offline evaluation harness when provider access is configured.

## 6. How to Add New Medical Guidelines to the Library

To expand the internal knowledge base with real clinical textbooks or national protocols:

1. Place your guideline Markdown files (`.md`) or text files into `data/library/`.
2. Format headings using standard Markdown (`# Title`, `## Section 1: ...`).
3. Run the ingestion script:
   ```bash
   pnpm run ingest
   ```
   The script splits files by section into chunks of up to 500 whitespace-separated words with 10% overlap and populates the PostgreSQL full-text index. Unchanged chunks are reused by SHA-256 hash. A configured embedding key sends library text to the provider during ingestion.

---

## 7. Testing & Verification

### Running Vitest Unit Tests
Tests citation whitespace normalization, verbatim matching, dropping unverified claims, drug safety engine rules (allergies, interactions, pregnancy, eGFR, age), and 100% i18n key parity:
```bash
pnpm test
```

### Running Playwright Smoke E2E Tests
Tests demo login, case workspace rendering, and bilingual disclaimer persistence:
```bash
pnpm run test:e2e
```

### Code Quality & Compilation
```bash
pnpm run lint
pnpm run typecheck
pnpm run build
```

---

## 8. License & Standards
Built for hackathon demonstration purposes. Use only synthetic patient data. Clinical and business deployment remain out of scope.
