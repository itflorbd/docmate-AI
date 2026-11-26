# DocMate AI — Judges' Challenges Gaps Closure Report

**Date:** 24 November 2026  
**Branch:** `codex/challenge-gaps` (branched from `codex/integration-followup` @ `b211196`)  
**Worktree:** `/Applications/XAMPP/xamppfiles/htdocs/DoctMate-gaps`  
**Implementation HEAD SHA (Tasks 1–7):** `b4f0d030e5f8bac7d62258a99c4652dda7baf3e8`  
**Database:** Disposable PostgreSQL `docmate_gaps` (synthetic data only; `DOCMATE_DEMO_MODE=true`, `DOCMATE_CLINICAL_RELEASE` unset, official issuance/printing blocked with HTTP 423).

> Note: All tests use synthetic patients, synthetic doctors, and synthetic guideline fixtures. Passing results verify deterministic engineering behavior on synthetic fixtures only and do not constitute clinical validation.

---

## 1. Task Summary

| # | Task | What Changed | Files | Tests | Status |
| :-: | :--- | :--- | :--- | :--- | :-: |
| 1 | **Care setting at intake** (`fcc2874`) | Added optional `care_setting` (`outpatient` \| `inpatient` \| `intensive_care`, default unset) to New Intake Step 1 & Step 4 summary, added Zod validation to `caseInput` (`POST /api/cases`), displayed `care_setting` in `PatientDetailSheet`, and added `en`/`bn` i18n keys. | `src/lib/case-input.ts`, `src/app/[locale]/patients/new/page.tsx`, `src/app/[locale]/cases/[id]/components/PatientDetailSheet.tsx`, `messages/en.json`, `messages/bn.json`, `tests/care-setting-intake.test.ts` | `tests/care-setting-intake.test.ts` (3 passed), `e2e/challenge-gaps.spec.ts` (bn/en) | **PASS** |
| 2 | **Guideline conflict context dimensions** (`f4b0ecc`) | Added deterministic `severity` (`mild`/`moderate`/`severe`), `renal` (eGFR thresholds & `renal_impairment`/`normal_renal`), and `region` (`in regions with …`) extraction, patient comparison (unknown -> `needs`, never guessed), conservative disjointness (`mild` vs `severe`, `eGFR <30` vs `normal_renal`, `high X` vs `low X`; unclear stays `same_context` blocking), UI rendering in `GuidelineConflictCard`, and `en`/`bn` labels. | `src/types/index.ts`, `src/lib/guideline-conflict.ts`, `src/app/[locale]/cases/[id]/components/GuidelineConflictCard.tsx`, `messages/en.json`, `messages/bn.json`, `tests/guideline-conflict-dimensions.test.ts` | `tests/guideline-conflict-dimensions.test.ts` (11 passed), `tests/treatment-draft.test.ts` (20 passed), `e2e/challenge-gaps.spec.ts` (bn/en renal) | **PASS** |
| 3 | **Quotes must not start with a PDF heading** (`f249fc0`) | Updated `sentences()` in `src/lib/treatment-draft.ts` to split off leading heading lines (no end punctuation followed by newline + capital letter) using original newlines before collapsing whitespace; preserved `verifyQuoteInChunk`. | `src/lib/treatment-draft.ts`, `tests/treatment-draft.test.ts` | `tests/treatment-draft.test.ts` (`strips a leading PDF heading line from quotes while keeping verbatim chunk verification`), `e2e/judges-demo.spec.ts` (2 passed) | **PASS** |
| 4 | **Link prescriptions to cases** (`685797a`) | Added idempotent migration `0013_prescription_case_link.sql` (`prescriptions.case_id` nullable FK to `cases` `ON DELETE SET NULL` + partial index; no backfill), updated `POST /api/prescriptions` and `/prescriptions/new` to accept and verify `caseId`, updated `follow-up.ts` & `follow-up-server.ts` to carry forward linked prescription items with `source.field = "prescription"` under identical ownership/consent rules, and added `en`/`bn` source label. | `migrations/0013_prescription_case_link.sql`, `src/db/schema.ts`, `src/app/api/prescriptions/route.ts`, `src/app/[locale]/prescriptions/new/page.tsx`, `src/lib/follow-up.ts`, `src/lib/follow-up-server.ts`, `messages/en.json`, `messages/bn.json`, `tests/prescription-case-link.test.ts`, `tests/follow-up.test.ts` | `tests/prescription-case-link.test.ts` (3 passed: unit + DB linked/unlinked/inaccessible/full_history), `tests/follow-up.test.ts` (10 passed), `tests/audit.test.ts` (4 passed) | **PASS** |
| 5 | **Publication year at ingestion** (`c3cd995`) | Added `resolvePublicationYear()` in `src/lib/ingestion/pipeline.ts` reading explicit text (`Publication year YYYY`), title `(YYYY)`, and PDF metadata (`CreationDate`/`PublicationYear`) in `PdfExtractor`; added idempotent migration `0014_source_year_verified.sql` (`sources.year_verified`) so missing years keep NOT NULL fallback while flagging `"Year unverified"` in admin source detail view; removed the SQL `UPDATE sources SET year = 2025` workaround from `e2e/followup-and-conflict.spec.ts`. | `migrations/0014_source_year_verified.sql`, `src/db/schema.ts`, `src/lib/ingestion/extractors/index.ts`, `src/lib/ingestion/extractors/pdf-extractor.ts`, `src/lib/ingestion/pipeline.ts`, `src/app/[locale]/admin/library/sources/[id]/page.tsx`, `messages/en.json`, `messages/bn.json`, `e2e/followup-and-conflict.spec.ts`, `tests/publication-year-ingestion.test.ts` | `tests/publication-year-ingestion.test.ts` (4 passed), re-ingested `Synthetic_Guideline_A_Diabetes_2025.pdf` -> `year = 2025, year_verified = true`, `e2e/followup-and-conflict.spec.ts` (2 passed without SQL UPDATE) | **PASS** |
| 6 | **Localized server text** (`9657281`) | Replaced English prose in treatment-draft `follow_up_questions` and `excluded[].reason` with structured `{ code, params? }` objects (stored stably in audit logs), rendered them via `next-intl` in `TreatmentTab.tsx`, and added full `en`/`bn` translations. | `src/lib/treatment-draft.ts`, `src/app/[locale]/cases/[id]/components/TreatmentTab.tsx`, `messages/en.json`, `messages/bn.json`, `tests/treatment-draft.test.ts` | `tests/treatment-draft.test.ts` (20 passed), `tests/i18n-parity.test.ts` (6 passed), `e2e/challenge-gaps.spec.ts` (bn/en zero English server text) | **PASS** |
| 7 | **One report-download route** (`b4f0d03`) | Removed duplicate `/api/patient/reports/download/route.ts` (zero callers in repo); kept `/api/patient/reports/[id]/file/route.ts` with magic-byte file serving, normalized phone matching for patient owners, active-grant + shared-only check for doctors, 404 for all other roles, and `access_logs` entry on every download. | Deleted `src/app/api/patient/reports/download/route.ts`; updated `src/app/api/patient/reports/[id]/file/route.ts`; added `tests/report-download.test.ts` | `tests/report-download.test.ts` (4 passed), `e2e/patient-portal.spec.ts` (passed), `e2e/challenge-gaps.spec.ts` (bn/en) | **PASS** |

---

## 2. Verification Commands & Observed Outputs

| Command | Observed Output | Exit Code |
| :--- | :--- | :-: |
| `npx eslint` | Clean (no errors or warnings) | `0` |
| `npx tsc --noEmit` | Clean (0 TypeScript errors) | `0` |
| `DATABASE_URL=postgresql://apple@localhost:5432/docmate_gaps npx vitest run` | `Test Files 51 passed (51)`, `Tests 505 passed (505)` in 19.33s (includes `tests/audit.test.ts` 4/4, `tests/i18n-parity.test.ts` 6/6, `tests/follow-up.test.ts` 10/10, `tests/prescription-case-link.test.ts` 3/3, `tests/report-download.test.ts` 4/4) | `0` |
| `npx next build` | `Compiled successfully in 19.5s`, `Finished TypeScript in 37.8s`, `Generating static pages (59/59)` | `0` |
| `ALLOW_DEMO_IN_PRODUCTION=true npx next start -p 3170 -H 127.0.0.1` | `Ready in 164ms` on `http://127.0.0.1:3170` | running |
| `DATABASE_URL=…/docmate_gaps DOCMATE_QA_BASE_URL=http://127.0.0.1:3170 npx playwright test e2e/followup-and-conflict.spec.ts e2e/treatment-safety.spec.ts e2e/rbac-matrix.spec.ts e2e/patient-portal.spec.ts` | `16 passed (30.3s)` (2 `followup-and-conflict`, 6 `treatment-safety`, 7 `rbac-matrix`, 1 `patient-portal`) | `0` |
| `DATABASE_URL=…/docmate_gaps DOCMATE_QA_BASE_URL=http://127.0.0.1:3170 npx playwright test e2e/judges-demo.spec.ts` | `2 passed (59.9s)` — **Model:** `gpt-4o-mini`, **Mode:** `live` (did not fall back) | `0` |
| `DATABASE_URL=…/docmate_gaps DOCMATE_QA_BASE_URL=http://127.0.0.1:3170 npx playwright test e2e/challenge-gaps.spec.ts` | `2 passed (26.8s)` (`bn` 13.4s, `en` 10.8s) | `0` |

---

## 3. Screenshots (`output/patient-qa/challenge-gaps/`)

| Task / Check | Bangla (`bn`) | English (`en`) |
| :--- | :--- | :--- |
| Task 1: Care setting selector at New Intake | `bn-task1-intake-care-setting.png` | `en-task1-intake-care-setting.png` |
| Task 1: Care setting shown in `PatientDetailSheet` | `bn-task1-patient-sheet.png` | `en-task1-patient-sheet.png` |
| Task 2: Renal function context dimension (`needs_information` -> eGFR) | `bn-task2-renal-conflict.png` | `en-task2-renal-conflict.png` |
| Task 6: Localized treatment-draft follow-up text (zero English server text in `bn`) | `bn-task6-localized-draft.png` | `en-task6-localized-draft.png` |
| Task 7: Patient portal reports view & consolidated `/api/patient/reports/[id]/file` | `bn-task7-portal-reports.png` | `en-task7-portal-reports.png` |

---

## 4. Anything Not Done

None. All 7 tasks, migrations, unit/DB tests, Playwright regression suites, live `judges-demo` run, and Bangla/English browser checks completed and passed without relaxing any hard rule. `main`, `codex/integration-followup`, and all other worktrees were left untouched. Nothing was pushed or merged.
