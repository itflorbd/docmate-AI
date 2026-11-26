# Complete Step-by-Step Deployment Guide: Render & Vercel
### DocMate AI — Clinical Decision Support Assistant

> **Clinical Decision Support Disclaimer**:  
> **Clinical decision support only. Not a substitute for professional judgement.**  
> *(শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।)*

---

## Table of Contents
1. [Overview & Platform Selection](#1-overview--platform-selection)
2. [Prerequisites & Key Generation](#2-prerequisites--key-generation)
3. [PART 1: Complete Deployment on Render (All-in-One)](#3-part-1-complete-deployment-on-render-all-in-one)
   - [Method A: 1-Click Blueprint Deploy (Recommended)](#method-a-1-click-blueprint-deploy-recommended)
   - [Method B: Manual Step-by-Step Deploy on Render](#method-b-manual-step-by-step-deploy-on-render)
   - [Database Initialization in Render Shell](#database-initialization-in-render-shell)
   - [Verifying Your Render Deployment](#verifying-your-render-deployment)
4. [PART 2: Complete Deployment on Vercel + Supabase / Neon](#4-part-2-complete-deployment-on-vercel--supabase--neon)
   - [Step 1: Set Up Cloud PostgreSQL with pgvector (Supabase or Neon)](#step-1-set-up-cloud-postgresql-with-pgvector-supabase-or-neon)
   - [Step 2: Initialize Database & Ingest Guidelines Locally](#step-2-initialize-database--ingest-guidelines-locally)
   - [Step 3: Deploy to Vercel via Dashboard](#step-3-deploy-to-vercel-via-dashboard)
   - [Verifying Your Vercel Deployment](#verifying-your-vercel-deployment)
5. [Environment Variables Reference Table](#5-environment-variables-reference-table)
6. [Post-Deployment Verification & Testing](#6-post-deployment-verification--testing)
7. [Common Issues & Troubleshooting FAQ](#7-common-issues--troubleshooting-faq)

---

## 1. Overview & Platform Selection

DocMate AI requires two main components:
1. **Next.js 16 Web Application** (React 19, bilingual i18n, Tailwind CSS, API routes).
2. **PostgreSQL 16 Database with `pgvector` extension** (stores clinical cases, DGDA formulary, patient profiles, vector embeddings, and full-text library chunks).

### Which Platform Should You Choose?

```
                       ┌─────────────────────────┐
                       │ Where should I deploy?  │
                       └────────────┬────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│          Choose RENDER          │       │          Choose VERCEL          │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ ✔ All-in-one (Web + Database)   │       │ ✔ Fastest global edge CDN       │
│ ✔ Zero external accounts needed │       │ ✔ Native Next.js App Router     │
│ ✔ Free internal private network │       │ ✘ Needs external database       │
│ ✔ In-browser terminal for setup │       │   (e.g. Supabase or Neon)       │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

---

## 2. Prerequisites & Key Generation

Before starting, generate two cryptographically secure 32-byte secret keys on your computer.

Open your local terminal and run:
```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate PATIENT_ENCRYPTION_KEY
openssl rand -base64 32
```
Keep these two values handy. You will paste them into the environment variables during deployment.

---

## 3. PART 1: Complete Deployment on Render (All-in-One)

Render is the simplest option because it provides both a **Managed PostgreSQL database** (with `pgvector`) and a **Docker Web Service** in the same region with private networking.

### Method A: 1-Click Blueprint Deploy (Recommended)

Your repository already contains a pre-configured `render.yaml` blueprint.

1. **Sign in to Render**: Visit [dashboard.render.com](https://dashboard.render.com/) and log in (or sign up with your GitHub account).
2. **Create New Blueprint**:
   - In the top navigation bar, click **New +** and select **Blueprint**.
   - Connect your GitHub account if not already connected.
   - Choose your repository: `irfan0072/DocMate-AI-powered-doctor-assistant-`.
3. **Review Resources**:
   Render will inspect `render.yaml` and display two resources to be created:
   - **`docmate-db`**: PostgreSQL 16 Database.
   - **`docmate-ai`**: Web Service running via Docker.
4. **Click Apply**:
   - Click the blue **Apply** button. Render will immediately begin provisioning the database and building the Docker container.
5. **Enable pgvector & Initialize Schema**:
   Proceed to [Database Initialization in Render Shell](#database-initialization-in-render-shell) below once building completes.

---

### Method B: Manual Step-by-Step Deploy on Render

If you prefer to configure each service manually without Blueprints:

#### Step 1: Create PostgreSQL Database on Render
1. On your Render dashboard, click **New +** > **PostgreSQL**.
2. Configure database settings:
   - **Name**: `docmate-db`
   - **Database**: `docmate`
   - **User**: `docmate_admin`
   - **Region**: Choose the region closest to you (e.g., `Singapore` or `Frankfurt`).
   - **PostgreSQL Version**: `16`
   - **Plan**: `Free` or `Starter`
3. Click **Create Database**.
4. Wait ~1 minute until the database status is **Available**.
5. Scroll down to the **Connections** section and copy the **Internal Database URL** (e.g. `postgresql://docmate_admin:...@dpg-...-a:5432/docmate`).

#### Step 2: Enable the `pgvector` Extension in Render Postgres
1. On the database page in Render, click the **Connect** dropdown in the top right.
2. Select **PSQL Command** and copy the command, or open an interactive web terminal.
3. Run the following SQL query:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Verify by running `\dx`. You should see `vector` in the installed extensions list.

#### Step 3: Create the Docker Web Service on Render
1. Click **New +** > **Web Service**.
2. Select **Build and deploy from a Git repository** and pick `irfan0072/DocMate-AI-powered-doctor-assistant-`.
3. Configure settings:
   - **Name**: `docmate-ai`
   - **Region**: Same region as your database (e.g., `Singapore`).
   - **Branch**: `main`
   - **Runtime**: **Docker** (Render will automatically detect your project's `Dockerfile`).
   - **Plan**: `Starter` (or `Free`).
4. Scroll down to **Environment Variables** and add the following keys:

   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Production runtime |
   | `DATABASE_URL` | *(Paste Internal Database URL from Step 1)* | Private database connection |
   | `AUTH_SECRET` | *(Your generated 32-byte secret)* | Session encryption |
   | `PATIENT_ENCRYPTION_KEY` | *(Your generated 32-byte secret)* | AES-256-GCM patient PII |
   | `DOCMATE_DEMO_MODE` | `true` | Enables seeded accounts & demo cases |
   | `DEMO_MODE` | `true` | Allows fixed OTP 123456 for testing |
   | `NEXT_PUBLIC_DEMO_MODE` | `true` | Shows demo banner in UI |
   | `NEXT_PUBLIC_APP_URL` | `https://docmate-ai.onrender.com` | Replace with your actual Render URL |
   | `OPENAI_API_KEY` | *(Optional)* | For live vector embeddings |
   | `OPENAI_EMBED_MODEL` | `text-embedding-3-small` | Default embedding model |

5. Scroll down to **Health Check Path** and enter:
   ```
   /bn/login
   ```
6. Click **Create Web Service**.

---

### Database Initialization in Render Shell

Once your Web Service shows **Live** (green status):

1. Go to your Web Service (`docmate-ai`) in the Render dashboard.
2. In the left sidebar, click the **Shell** tab to open an in-browser terminal.
3. Run the following three initialization commands one after another:

```bash
# 1. Push PostgreSQL schema tables (users, patients, cases, prescriptions, formulary)
pnpm exec drizzle-kit push

# 2. Ingest clinical guidelines & textbook chunks into full-text vector index
pnpm run ingest

# 3. Seed DGDA drug formulary and demo accounts
pnpm run seed
```

Each script will output completion confirmations. Your database is now populated!

---

### Verifying Your Render Deployment

1. Click on the URL provided at the top of your Render Web Service (e.g. `https://docmate-ai.onrender.com`).
2. You will be redirected to the default Bangla landing page (`/bn`).
3. Click **ডেমো লগইন (Demo Sign In)**:
   - **Doctor**: `doctor@docmate.ai` / `demo123`
   - **Student**: `student@docmate.ai` / `demo123`
   - **Researcher**: `researcher@docmate.ai` / `demo123`
   - **Admin**: `admin@docmate.ai` / `demo123`
4. Confirm patient cases (`P-101`, `P-102`, `P-103`) render in the doctor dashboard!

---

## 4. PART 2: Complete Deployment on Vercel + Supabase / Neon

Vercel provides instant global CDN delivery for Next.js. Because Vercel is serverless, you connect it to an external managed PostgreSQL provider that supports `pgvector` (e.g., **Supabase** or **Neon**).

---

### Step 1: Set Up Cloud PostgreSQL with pgvector (Supabase or Neon)

#### Using Supabase:
1. Go to [supabase.com](https://supabase.com/) and click **Start your project**.
2. Create a new organization and project (e.g. `docmate-db`).
3. Choose a strong database password and select a region (e.g. `Southeast Asia (Singapore)`).
4. Once the project is created, click the **SQL Editor** tab on the left sidebar.
5. Paste and run the following command:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
6. Click **Project Settings** (gear icon) > **Database**.
7. Under **Connection String**, select **URI** and choose **Transaction Pooler** (port `6543`) or **Direct connection** (port `5432`).
8. Copy the connection string. Replace `[YOUR-PASSWORD]` with your database password:
   ```
   postgresql://postgres.xxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```

*(Alternatively, if using [Neon.tech](https://neon.tech): create a project, go to the SQL Editor, run `CREATE EXTENSION IF NOT EXISTS vector;`, and copy your pooled connection string).*

---

### Step 2: Initialize Database & Ingest Guidelines Locally

Because Vercel serverless functions have short execution timeouts, run the database setup commands from your local computer pointing to your remote cloud database:

1. Open your computer's terminal in the DocMate project folder:
   ```bash
   cd /Applications/XAMPP/xamppfiles/htdocs/DoctMate
   ```
2. Run database migration, guideline ingestion, and formulary seeding:
   ```bash
   # Push schema to Supabase/Neon
   DATABASE_URL="your-supabase-connection-string" pnpm exec drizzle-kit push

   # Ingest clinical library chunks into the remote database
   DATABASE_URL="your-supabase-connection-string" pnpm run ingest

   # Seed DGDA formulary and demo accounts
   DATABASE_URL="your-supabase-connection-string" pnpm run seed
   ```

Your Supabase/Neon database is now completely initialized and ready for Vercel!

---

### Step 3: Deploy to Vercel via Dashboard

1. Go to [vercel.com](https://vercel.com/) and sign in with GitHub.
2. Click **Add New...** > **Project**.
3. Under **Import Git Repository**, find `DocMate-AI-powered-doctor-assistant-` and click **Import**.
4. In the configuration window:
   - **Framework Preset**: `Next.js` (detected automatically).
   - **Root Directory**: `./` (leave default).
   - **Build Command**: `pnpm run build` (or leave default).
   - **Install Command**: `pnpm install` (or leave default).
5. Expand the **Environment Variables** section and add the following keys:

   ```
   DATABASE_URL=postgresql://postgres.xxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   NODE_ENV=production
   AUTH_SECRET=your_32_byte_random_auth_secret
   PATIENT_ENCRYPTION_KEY=your_32_byte_random_patient_encryption_key
   DOCMATE_DEMO_MODE=true
   DEMO_MODE=true
   NEXT_PUBLIC_DEMO_MODE=true
   NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
   OPENAI_API_KEY=sk-proj-... (optional)
   OPENAI_EMBED_MODEL=text-embedding-3-small
   ```

6. Click **Deploy**.
7. Vercel will build the Next.js application, optimize static pages, and deploy worldwide in 1–2 minutes!

---

### Verifying Your Vercel Deployment

1. Click on the deployment domain assigned by Vercel (e.g. `https://docmate-ai.vercel.app`).
2. Verify that the landing page renders in Bengali (`/bn`) with responsive navigation and language switching (`EN`/`বাং`).
3. Log in with `doctor@docmate.ai` / `demo123` to test the case workspace and verbatim citation verification.

---

## 5. Environment Variables Reference Table

| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Sets Node.js runtime to production mode |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `https://docmate.onrender.com` | Base URL used for redirect callbacks & cookies |
| `DATABASE_URL` | **Yes** | `postgresql://...` | Connection string to PostgreSQL with pgvector |
| `AUTH_SECRET` | **Yes** | 32+ character random string | Secret for signing doctor & patient session cookies |
| `PATIENT_ENCRYPTION_KEY` | **Yes** | 32+ character random string | AES-256-GCM secret for phone & identity encryption |
| `DOCMATE_DEMO_MODE` | Recommended | `true` (dev) / `false` (live) | Enables pre-seeded demo accounts & synthetic cases |
| `DEMO_MODE` | Recommended | `true` (dev) / `false` (live) | Enforces OTP 123456 in demo; real SMS gateway when false |
| `NEXT_PUBLIC_DEMO_MODE` | Recommended | `true` | Controls visibility of synthetic demo warnings in UI |
| `OPENAI_API_KEY` | Optional | `sk-proj-...` | For computing embeddings during library ingestion |
| `OPENAI_EMBED_MODEL` | Optional | `text-embedding-3-small` | Model used for semantic search embeddings |
| `BD_SMS_GATEWAY_API_KEY` | Optional | *(Provider API Key)* | Real SMS OTP delivery in Bangladesh for patients |

---

## 6. Post-Deployment Verification & Testing

Run through this quick 5-point sanity checklist after deploying:

1. **Root URL Redirect**: Visiting `https://your-app/` should automatically redirect to `https://your-app/bn`.
2. **Language Toggle**: Clicking the language switcher in the header should toggle seamlessly between Bengali (`/bn`) and English (`/en`).
3. **Demo Doctor Login**: Sign in as `doctor@docmate.ai` (`demo123`). The Doctor Case Workspace should load with 3 synthetic patients (`P-101`, `P-102`, `P-103`).
4. **Verbatim Citation Verification**: Open case `P-101` and check the Differential Diagnosis accordion. Each clinical finding must show a citation chip linking to verified library excerpts.
5. **Patient Phone Login (Demo OTP)**: Log out and click **রোগী পোর্টাল (Patient Portal)**. Enter `01799887766` and use OTP `123456`. Verify dependent profiles and the medication schedule.

---

## 7. Common Issues & Troubleshooting FAQ

#### Q: `ERROR: type "vector" does not exist` during `drizzle-kit push`
* **Cause**: The PostgreSQL database does not have `pgvector` enabled yet.
* **Fix**: Connect to your database using psql / SQL editor and run:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

#### Q: Render Web Service fails with `OOM (Out of Memory)` during build
* **Cause**: `pnpm run build` on Next.js 16 can use up to 1.5 GB RAM during static generation.
* **Fix**: Ensure your Render Web Service has at least 1 GB RAM (`Starter` plan), or set `NODE_OPTIONS="--max-old-space-size=1536"` in Render environment variables.

#### Q: Vercel displays `FATAL SECURITY VIOLATION: DEMO_MODE=true is strictly prohibited in production`
* **Cause**: The safety guard in `src/lib/otp.ts` detects `NODE_ENV=production` while `DEMO_MODE=true` is set without permission.
* **Fix**: If running a hackathon/evaluation demo on Vercel, add `ALLOW_DEMO_IN_PRODUCTION=true` to your Vercel Environment Variables. In a live hospital environment, set `DEMO_MODE=false`.

#### Q: Render Free Tier Web Service goes to sleep after 15 minutes of inactivity
* **Cause**: Render Free tier spins down inactive Web Services.
* **Fix**: The first request after sleep takes ~45 seconds to spin up. For instant 24/7 uptime without sleep, upgrade the Web Service to the $7/month Starter plan, or set up a free healthcheck monitor via [UptimeRobot](https://uptimerobot.com) pinging `/bn/login` every 5 minutes.

---

## Support & Repository Links
* **GitHub Repository**: [https://github.com/irfan0072/DocMate-AI-powered-doctor-assistant-](https://github.com/irfan0072/DocMate-AI-powered-doctor-assistant-)
* **Render Blueprint File**: [render.yaml](file:///Applications/XAMPP/xamppfiles/htdocs/DoctMate/render.yaml)
* **General Deployment Guide**: [DEPLOYMENT.md](file:///Applications/XAMPP/xamppfiles/htdocs/DoctMate/DEPLOYMENT.md)
