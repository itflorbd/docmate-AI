# DocMate AI — Production Deployment Guide
### Complete Setup, Docker Deployment, Cloud Provisioning & Clinical Safety Operations

> **Clinical Decision Support Disclaimer**:  
> **Clinical decision support only. Not a substitute for professional judgement.**  
> *(শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।)*

> [!TIP]
> **Looking for Render or Vercel step-by-step guides?**  
> Check out the dedicated walkthrough with 1-click Blueprints and screenshots: **[docs/RENDER_AND_VERCEL_DEPLOYMENT.md](docs/RENDER_AND_VERCEL_DEPLOYMENT.md)**.

---

## Table of Contents
1. [Overview & Architecture](#1-overview--architecture)
2. [System Requirements & Prerequisites](#2-system-requirements--prerequisites)
3. [Environment Configuration & Secrets](#3-environment-configuration--secrets)
4. [Deployment Option A: Docker & Docker Compose (Recommended)](#4-deployment-option-a-docker--docker-compose-recommended)
5. [Deployment Option B: Bare-Metal / VPS (Ubuntu/Debian with PM2 & Nginx)](#5-deployment-option-b-bare-metal--vps-ubuntudebian-with-pm2--nginx)
6. [Deployment Option C: Render (1-Click Blueprint or Docker Web Service)](#6-deployment-option-c-render-1-click-blueprint-or-docker-web-service)
7. [Deployment Option D: Vercel + Supabase / Neon PostgreSQL](#7-deployment-option-d-vercel--supabase--neon-postgresql)
8. [Database Setup, Migrations & Clinical Library Ingestion](#8-database-setup-migrations--clinical-library-ingestion)
9. [Production Clinical Safety & Security Guardrails](#9-production-clinical-safety--security-guardrails)
10. [Backups, Monitoring & Health Checks](#10-backups-monitoring--health-checks)
11. [Troubleshooting & FAQ](#11-troubleshooting--faq)

---

## 1. Overview & Architecture

DocMate AI is a modern clinical decision support system built on Next.js 16 (App Router), React 19, TypeScript, PostgreSQL (with `pgvector`), and Drizzle ORM.

```
                   ┌──────────────────────────────────────────┐
                   │    Client (Desktop / Tablet / Mobile)    │
                   └────────────────────┬─────────────────────┘
                                        │ HTTPS (TLS 1.3)
                                        ▼
                   ┌──────────────────────────────────────────┐
                   │      Nginx / Reverse Proxy / CDN        │
                   │  (SSL termination, rate limiting, gzip)  │
                   └────────────────────┬─────────────────────┘
                                        │ Proxy pass (:3000)
                                        ▼
                   ┌──────────────────────────────────────────┐
                   │          Next.js App Server              │
                   │ - Next.js 16 / React 19 / App Router     │
                   │ - Bilingual i18n (Bangla default / Eng) │
                   │ - Verbatim Citation Verification Engine  │
                   │ - Deterministic DGDA Drug Safety Engine  │
                   │ - AES-256-GCM Patient PII Encryption    │
                   └──────────┬───────────────────┬───────────┘
                              │                   │
         SQL Queries &        ▼                   ▼ External APIs (Optional)
     Vector Similarity ┌───────────────┐     ┌───────────────────────┐
                       │  PostgreSQL   │     │ OpenAI (Embeddings)   │
                       │   (pgvector)  │     │ BD SMS Gateway (OTP)  │
                       └───────────────┘     └───────────────────────┘
```

---

## 2. System Requirements & Prerequisites

### Minimum Hardware Recommendations
* **Development / Staging**: 1 vCPU, 2 GB RAM, 20 GB SSD
* **Production**: 2+ vCPU, 4 GB RAM (8 GB recommended for heavy vector indexing), 50+ GB SSD

### Software Prerequisites
* **Node.js**: `20.x` LTS (v20.19+ recommended)
* **Package Manager**: `pnpm` (v9+) or `npm` (v10+)
* **Database**: PostgreSQL 16+ with the `pgvector` extension installed
* **Container Runtime (Optional)**: Docker 24+ and Docker Compose v2+

---

## 3. Environment Configuration & Secrets

Copy the provided template to configure your production environment:
```bash
cp .env.example .env
```

### Essential Production Environment Variables

| Variable | Required | Description | Example / Generator |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | App runtime environment | `production` |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Canonical public URL (HTTPS required in prod) | `https://docmate.yourhospital.org` |
| `DATABASE_URL` | **Yes** | Connection string for PostgreSQL (with pgvector) | `postgresql://user:pass@host:5432/docmate` |
| `AUTH_SECRET` | **Yes** | Cryptographic key for session cookies (32+ chars) | Generate: `openssl rand -base64 32` |
| `PATIENT_ENCRYPTION_KEY` | **Yes** | AES-256-GCM secret for phone/identity encryption | Generate: `openssl rand -base64 32` |
| `DOCMATE_DEMO_MODE` | **Yes** | Disable demo bypasses in real hospital deployments | `false` |
| `DEMO_MODE` | **Yes** | Disable fixed OTPs (123456) in production | `false` |
| `NEXT_PUBLIC_DEMO_MODE`| **Yes** | UI flag for synthetic demo banners | `false` |
| `OPENAI_API_KEY` | Optional | For vector embeddings of clinical guidelines | `sk-proj-...` (or leave blank for offline) |
| `OPENAI_EMBED_MODEL` | Optional | Semantic embeddings model | `text-embedding-3-small` |
| `BD_SMS_GATEWAY_API_KEY` | Optional | SMS gateway key for sending patient OTP in Bangladesh | Provider API key |

> [!CAUTION]
> **Production Security Guard**: Never deploy with `DEMO_MODE=true` in a live clinical environment containing real patient data. In `DEMO_MODE=false`, the system strictly requires legitimate OTP delivery and authenticates credentials securely without bypasses.

---

## 4. Deployment Option A: Docker & Docker Compose (Recommended)

Docker Compose offers the quickest, most reproducible production deployment.

### Step 1: Clone the Repository
```bash
git clone https://github.com/irfan0072/DocMate-AI-powered-doctor-assistant-.git /opt/docmate
cd /opt/docmate
```

### Step 2: Configure Production Environment
Create `.env.production` (or `.env`):
```bash
cp .env.example .env
```
Generate random secrets:
```bash
sed -i "s/your_auth_session_secret_32_chars_or_more/$(openssl rand -hex 32)/" .env
sed -i "s/your_patient_encryption_secret_key_32_bytes/$(openssl rand -hex 32)/" .env
```

### Step 3: Build & Start Containers
Use the pre-configured production Docker Compose specification:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 4: Run Initial Database Migration & Ingestion
Execute the database setup inside the running container:
```bash
# Push database schemas
docker compose -f docker-compose.prod.yml exec app pnpm exec drizzle-kit push

# Ingest clinical guideline chunks
docker compose -f docker-compose.prod.yml exec app pnpm run ingest

# Optional: Seed initial DGDA drug formulary & base settings
docker compose -f docker-compose.prod.yml exec app pnpm run seed
```

Check logs and health status:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

---

## 5. Deployment Option B: Bare-Metal / VPS (Ubuntu/Debian with PM2 & Nginx)

For deployment on Linux virtual private servers (AWS EC2, DigitalOcean Droplet, Linode, Hetzner, etc.):

### Step 1: Install PostgreSQL 16 with pgvector
```bash
sudo apt-get update && sudo apt-get install -y postgresql-common curl gnupg
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt-get install -y postgresql-16 postgresql-16-pgvector

# Enable vector extension in database
sudo -u postgres psql -c "CREATE USER docmate WITH PASSWORD 'secure_production_password';"
sudo -u postgres psql -c "CREATE DATABASE docmate OWNER docmate;"
sudo -u postgres psql -d docmate -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Step 2: Install Node.js 20 & pnpm
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm pm2
```

### Step 3: Clone, Install & Build App
```bash
sudo mkdir -p /var/www/docmate
sudo chown -R $USER:$USER /var/www/docmate
git clone https://github.com/irfan0072/DocMate-AI-powered-doctor-assistant-.git /var/www/docmate
cd /var/www/docmate

pnpm install --frozen-lockfile
cp .env.example .env
# Edit .env with production database credentials and secrets
nano .env

pnpm exec drizzle-kit push
pnpm run ingest
pnpm run seed
pnpm run build
```

### Step 4: Manage App Process with PM2
```bash
pm2 start "pnpm start" --name "docmate-ai" -i max
pm2 save
pm2 startup
```

### Step 5: Configure Nginx Reverse Proxy & SSL
Create `/etc/nginx/sites-available/docmate`:
```nginx
server {
    server_name docmate.yourhospital.org;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}
```

Enable site and provision Let's Encrypt SSL:
```bash
sudo ln -s /etc/nginx/sites-available/docmate /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d docmate.yourhospital.org
```

---

## 6. Deployment Option C: Render (1-Click Blueprint or Docker Web Service)

Render is one of the easiest ways to deploy DocMate AI because it provides both a **Managed PostgreSQL database (with pgvector)** and a **Dockerized Web Service** in the same region with free internal private networking.

### Method 1: 1-Click Blueprint Deployment (`render.yaml`)
This repository contains a pre-configured `render.yaml` Blueprint specification.
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Blueprint**.
3. Connect your GitHub repository: `https://github.com/irfan0072/DocMate-AI-powered-doctor-assistant-`.
4. Render will detect `render.yaml` and automatically configure:
   - **PostgreSQL 16 Service** (`docmate-db`)
   - **Docker Web Service** (`docmate-ai`) using the production `Dockerfile`
   - Auto-generated cryptographic keys for `AUTH_SECRET` and `PATIENT_ENCRYPTION_KEY`
5. Click **Apply**.
6. Once provisioned, connect to your PostgreSQL database in the Render dashboard and enable the vector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
7. Open the **Shell** tab of your `docmate-ai` Web Service in Render and run the database initialization commands:
   ```bash
   pnpm exec drizzle-kit push
   pnpm run ingest
   pnpm run seed
   ```

### Method 2: Manual Web Service on Render
If not using Blueprints:
1. **Create PostgreSQL**: Click **New +** > **PostgreSQL**. Set Database Name to `docmate`, User to `docmate_admin`, and Region (e.g., `Singapore` or `Frankfurt`). Copy the **Internal Database URL**.
2. **Enable Vector Extension**: Open the database **Connect** menu, open the interactive psql shell, and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. **Create Web Service**: Click **New +** > **Web Service**. Select your GitHub repository.
   - **Runtime**: Docker (it automatically detects the root `Dockerfile`).
   - **Health Check Path**: `/bn/login`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `DATABASE_URL`: *(paste the Internal Database URL from Step 1)*
     - `AUTH_SECRET`: *(32-character random string)*
     - `PATIENT_ENCRYPTION_KEY`: *(32-character random string)*
     - `DOCMATE_DEMO_MODE`: `true` (or `false` for live clinic)
     - `DEMO_MODE`: `true` (or `false` for live clinic)
     - `NEXT_PUBLIC_DEMO_MODE`: `true`
4. Click **Deploy Web Service**.

---

## 7. Deployment Option D: Vercel + Supabase / Neon PostgreSQL

Vercel is the native serverless platform for Next.js applications. Because Vercel is a stateless serverless compute platform, you pair it with a cloud PostgreSQL database that supports `pgvector` (such as **Supabase** or **Neon**).

### Step 1: Provision Cloud PostgreSQL with pgvector
1. Sign up on [Supabase](https://supabase.com) (or [Neon](https://neon.tech)).
2. Create a new PostgreSQL project in your preferred region.
3. Open the **SQL Editor** in Supabase/Neon and execute:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Copy the **Pooled Connection String** (Transaction pooler URL or direct URL).

### Step 2: Push Schemas & Ingest Guidelines (From your machine)
Run these commands from your local workspace pointing to your Supabase/Neon connection string:
```bash
DATABASE_URL="your-supabase-or-neon-connection-string" pnpm exec drizzle-kit push
DATABASE_URL="your-supabase-or-neon-connection-string" pnpm run ingest
DATABASE_URL="your-supabase-or-neon-connection-string" pnpm run seed
```

### Step 3: Deploy to Vercel
1. Go to [Vercel](https://vercel.com) and click **Add New** > **Project**.
2. Import your GitHub repository: `https://github.com/irfan0072/DocMate-AI-powered-doctor-assistant-`.
3. In **Environment Variables**, add:
   - `DATABASE_URL`: Your Supabase/Neon PostgreSQL connection string.
   - `AUTH_SECRET`: Generate using `openssl rand -base64 32`.
   - `PATIENT_ENCRYPTION_KEY`: Generate using `openssl rand -base64 32`.
   - `NODE_ENV`: `production`
   - `DOCMATE_DEMO_MODE`: `true` (or `false` for live hospital)
   - `DEMO_MODE`: `true` (or `false` for live hospital)
   - `NEXT_PUBLIC_DEMO_MODE`: `true`
   - `NEXT_PUBLIC_APP_URL`: `https://your-project.vercel.app`
4. Click **Deploy**. Vercel will build and deploy the Next.js application worldwide.

---

## 8. Database Setup, Migrations & Clinical Library Ingestion

DocMate AI maintains internal schema and clinical guidelines through automated scripts:

### 1. Schema Push / Migrations
```bash
pnpm exec drizzle-kit push
```
Inspect schema tables in `src/db/schema.ts` (`users`, `patient_profiles`, `cases`, `prescriptions`, `dgda_formulary`, `audit_logs`, `access_grants`, `access_logs`, `sources`, `chunks`).

### 2. Ingesting National & Hospital Guidelines
Place new clinical guideline markdown files in `data/library/` and execute:
```bash
pnpm run ingest
```
* Breaks long texts into ~500-word sections with 10% overlap.
* Computes deterministic SHA-256 chunk hashes to prevent duplicate indexing.
* Populates PostgreSQL tsvector full-text index and optional OpenAI embeddings.

### 3. Pre-seeding Drug Formularies & Reference Data
```bash
pnpm run seed
```
Seeds standard Bangladesh DGDA drug formulations, therapeutic classes, interactions, contraindications, and role definitions.

---

## 9. Production Clinical Safety & Security Guardrails

DocMate AI is governed by strict clinical safety and privacy rules specified in `AGENTS.md`:

1. **Closed Library Only**: The reasoning engine operates strictly over retrieved local library chunks. No speculative LLM hallucination or external unverified medical advice.
2. **Verbatim Citation Matching**: Every clinical recommendation verifies verbatim match against cited chunks using normalized whitespace comparison. Unverified assertions are discarded.
3. **Deterministic Drug Dosing**: Dosage, route, frequency, and contraindication checks are computed strictly by deterministic TypeScript rules over the DGDA database—never by generative text models.
4. **Patient Privacy & PII Encryption**:
   - Phone numbers and identifying demographic data are encrypted using **AES-256-GCM**.
   - No patient health information (PHI) is transmitted to third-party generative text endpoints.
5. **Mandatory Clinical Disclaimer**: Both English and Bengali disclaimers are persistently displayed on every clinical screen.
6. **Immutable Audit Trails**: Every case view, prescription creation, diagnostic suggestion, and patient record access is timestamped and logged in `audit_logs` and `access_logs`.

---

## 10. Backups, Monitoring & Health Checks

### Container & Service Health Checks
The app provides a built-in healthcheck probe:
```bash
curl -I http://127.0.0.1:3000/bn/login
# Returns HTTP 200 OK
```

### Automated PostgreSQL Backup Script
Set up a daily cron backup:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/docmate"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

# Dump database
pg_dump -U docmate_admin -Fc docmate > "$BACKUP_DIR/docmate_$TIMESTAMP.dump"

# Retain backups for 14 days
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +14 -exec rm {} +
```

Add to crontab:
```bash
0 2 * * * /usr/local/bin/docmate-backup.sh
```

---

## 11. Troubleshooting & FAQ

#### Q: `ERROR: type "vector" does not exist`
**Cause**: The PostgreSQL `pgvector` extension has not been enabled in the active database.  
**Resolution**: Connect as superuser and execute:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Q: `FATAL SECURITY VIOLATION: DEMO_MODE=true is strictly prohibited in production`
**Cause**: `NODE_ENV=production` is set while `DEMO_MODE=true` is enabled.  
**Resolution**: Set `DEMO_MODE=false` in your `.env` to enforce production OTP verification.

#### Q: Bangla fonts or characters display distorted
**Cause**: Missing system font support for Bengali.  
**Resolution**: DocMate packages `@next/font` with Noto Sans Bengali. Ensure web font files are allowed through your reverse proxy / Content-Security-Policy headers without caching blocks.

---

## Support & Contributing
For issues, clinical protocol contributions, or security reports, please open an issue or pull request on the repository:  
**GitHub**: [https://github.com/irfan0072/DocMate-AI-powered-doctor-assistant-](https://github.com/irfan0072/DocMate-AI-powered-doctor-assistant-)
