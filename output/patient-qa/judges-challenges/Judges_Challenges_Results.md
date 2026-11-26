# Judges' challenges: follow-up visits and guideline disagreement

**24 November 2026 · Branch `codex/integration-followup`**

All runs used one integrated production build (`next build`, then `next start`) on port 3160. They used a disposable database (`docmate_integration`) with synthetic patients, synthetic doctors and three guideline PDFs labelled "SYNTHETIC TEST DOCUMENT - NOT CLINICAL GUIDANCE".

Gates during the runs:
- Demo mode on (`DOCMATE_DEMO_MODE=true`), so treatment drafts can be reviewed.
- Clinical release gate closed. Official issuance and printing stayed blocked (HTTP 423).
- Real-patient treatment was not enabled.

A pass shows only that these synthetic workflows meet the acceptance criteria below. Clinical use requires separate validation.

## Base and integration

| Branch | Commit | What it brings |
| --- | --- | --- |
| `main` | b217f1a | Antigravity fixes (patient authorization, access log, report download, migration 0010) |
| `codex/judges-demo` | 8003c02 | `main` plus the P-901 diagnosis fix |
| `codex/ux-rbac-audit` | 9f802e7 | Treatment safety (all of `codex/doctor-treatment-safety`), RBAC, UX |

The integration branch starts from `codex/judges-demo` and merges `codex/ux-rbac-audit` (merge commit 31f2cda). It had 13 conflicts. Each one was resolved to keep both sides' fixes:
- Patient routes use the owner-only scope, and the phone lookup now also matches E.164 and normalized forms, as on `main`.
- Report sharing keeps `main`'s access log entry.
- Report upload keeps magic-byte checks and "private by default".
- Finalize keeps the release gate.
- Analyze keeps both the gated synthetic assessment and urgent findings.
- Intake keeps unset vitals plus `main`'s respiratory rate and weight.
- `0010_schema_alignment.sql` was renamed to `0011_schema_alignment.sql`. Both 0010 migrations are idempotent.

`main` and the other worktrees were not changed.

## 1. Follow-up from a previous visit

| Acceptance check | Bangla | English |
| --- | --- | --- |
| "Start follow-up" on Visit 1 in the patient timeline (also in the case header) | Pass | Pass |
| Preview lists diagnosis, allergy, medicine, lab, measurements and open item, each with visit date and source | Pass | Pass |
| Another doctor's unshared visit is left out; the preview says some history was not included | Pass ("Hidden allergy" and "Hidden medicine" absent) | Pass |
| Treatment before reconciliation | 409 `reconciliation_required` | 409 |
| Changed medicine reconciled | `Metformin 1000 mg twice daily` is the only current medicine | Same |
| New measurement | Today's vitals hold only BP 138/86. Visit 1's BP 150/95, HR 82, weight 74 kg and HbA1c 7.9% are kept under `prior_visit.historical` | Same |
| Today's working diagnosis confirmed explicitly | Pass | Pass |
| Plan shows which earlier facts it used | Allergy (allergy check), changed medicine (interaction check), diagnosis (confirmed for today), measurements (history only) | Same |
| Visit 1 unchanged (row compared before and after) | `true` | `true` |
| Repeat submission (new request key, after creation) | 200, same visit, `created: false`, 1 follow-up row | Same |

Audit trail for Visit 2, in order:
1. `FOLLOW_UP_STARTED`
2. `FOLLOW_UP_RECONCILED`
3. `TREATMENT_APPROVAL_BLOCKED`
4. `TREATMENT_CONFLICT_REVIEWED` (request information)
5. `TREATMENT_CONFLICT_REVIEWED` (use recommendation)

The history read is also written to `access_logs` (`history_carry_forward`).

Server rules:
- A doctor may continue their own visit only while the patient's consent grant is active. Another doctor's visit needs a full-history grant.
- Consent is checked again when the doctor saves the reconciliation.
- A unit test covers concurrent duplicate submissions (request key plus row lock).

## 2. Guidelines that disagree

Fixtures: two synthetic PDFs disagree about Metformin for adult outpatients with type 2 diabetes:
- Guideline A (2025, version 1): recommends Metformin.
- Guideline B (2026, version 2): advises against it.

A third PDF, Guideline C (children), is used for a control. All three were published through the normal ingestion CLI. A's year was corrected to 2025 by SQL to stand in for an admin metadata edit, because the extractor defaulted it to the current year.

| Acceptance check | Bangla | English |
| --- | --- | --- |
| Both passages shown together: plain-language reading, exact quote, source title, year, version, page | Pass | Pass |
| Both citations open the full passage in the evidence sheet | Pass (A and B screenshots) | Pass |
| Patient fit per side: matches (adult, 52 years) and still needed (care setting) | Pass | Pass |
| Classified as "same patient group" (genuine disagreement) | Pass | Pass |
| Metformin not preselected and its checkbox disabled | Pass | Pass |
| Approval without a review | 422 `guideline_conflict` (audited) | Same |
| Doctor requests information, then records reasoning for "use the recommending passage" | Both audited, with both quotes and chunk IDs | Same |
| After the review, Metformin can be selected but is still not selected | Pass | Pass |
| Medication safety stops still apply to disputed options | Unit test: penicillin-allergic patient, disputed amoxicillin stays `blocked` | — |

**Controls**, run in English on the same build:

| Control | Result |
| --- | --- |
| Different population (B retired, C "children" published) | `different_context`, not blocking, applicable side "recommends", Metformin not disputed |
| Single applicable source (only A) | No conflict; Metformin not disputed |
| Altered quote (B's passage text edited in the database) | New conflict key; the earlier review no longer applies; approval refused with 422 `guideline_conflict`. After restoring the text, the earlier review is current again |

Removed hardcoded content: the research page's "Guideline Comparison" table was removed. It showed invented Bangladesh-versus-WHO recommendations with doses. That content was never retrieved from the library and could be mistaken for evidence.

## Screenshots

| Step | Bangla | English |
| --- | --- | --- |
| Previous visit in timeline | `bn-01-previous-visit-timeline.png` | `en-01-…` |
| Carry-forward preview | `bn-02-carry-forward-preview.png` | `en-02-…` |
| New follow-up draft (reconcile) | `bn-03-follow-up-draft-reconcile.png` | `en-03-…` |
| Earlier facts used in the plan | `bn-04a-history-used-in-plan.png` | `en-04a-…` |
| Both guideline readings | `bn-04b-guideline-conflict.png` | `en-04b-…` |
| Guideline A passage / B passage | `bn-05-guideline-A-passage.png`, `bn-05-guideline-B-passage.png` | `en-05-…` |
| Final review state | `bn-06-final-review-state.png` | `en-06-…` |

Raw results: `results.json`.

## Commands and results

| Command | Result |
| --- | --- |
| `npx eslint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `DATABASE_URL=…/docmate_integration npx vitest run` | 46 files, 479 tests passed |
| `… npx vitest run tests/treatment-draft.test.ts tests/follow-up.test.ts tests/i18n-parity.test.ts` | 35 passed |
| `npx next build` | exit 0 |
| `npx playwright test e2e/followup-and-conflict.spec.ts` | 2 passed (bn, en) |
| `npx playwright test e2e/treatment-safety.spec.ts e2e/rbac-matrix.spec.ts` (regression) | 13 passed |
| `npx playwright test e2e/judges-demo.spec.ts` (P-901 diagnosis, live `gpt-4o-mini`) | 2 passed |

## Rerun

```sh
git worktree add ../DoctMate-recheck codex/integration-followup && cd ../DoctMate-recheck
npm ci   # or clone node_modules; Turbopack does not follow a symlinked node_modules
cp .env.example .env   # set DATABASE_URL=postgresql://<you>@localhost:5432/docmate_integration,
                       # DOCMATE_DEMO_MODE=true, DOCMATE_SYNTHETIC_ASSESSMENT=on, AUTH_SECRET, OPENAI_API_KEY (diagnosis demo only)
sh scripts/setup-disposable-db.sh docmate_integration <db with the synthetic demo library>
node e2e/fixtures/make-guideline-pdfs.mjs
for f in output/pdf/Synthetic_Guideline_*.pdf; do node --env-file=.env --import tsx scripts/ingest.ts "$f" --direct; done
npx next build && ALLOW_DEMO_IN_PRODUCTION=true npx next start -p 3160 -H 127.0.0.1 &
DATABASE_URL=postgresql://<you>@localhost:5432/docmate_integration DOCMATE_QA_BASE_URL=http://127.0.0.1:3160 \
  npx playwright test e2e/followup-and-conflict.spec.ts
```

The setup script copies the synthetic library (`sources`, `source_versions`, `source_files`, `chunks`) from another disposable database. The run here used `docmate_judges`. The follow-up and conflict spec needs only the three synthetic PDFs. The P-901 spec also needs the judges' reference PDF.

## Remaining gaps

- **Care setting.** The care setting is recorded only from the treatment tab (new `care_setting` field). Intake does not ask for it yet.
- **Context reading.** Population and setting are read from fixed word lists in code: adults, children, older adults, pregnancy, penicillin allergy, outpatient, inpatient, intensive care. Other limits (region, severity, renal function) are not recognised, so two such passages are treated as the same context and blocked. That errs on the side of blocking.
- **Quote headings.** A quote can begin with the PDF section heading when the extracted text has no full stop after it (for example "Initial drug therapy For adult outpatients…"). The quote is still verbatim.
- **Prior plan.** The prior plan is read from the last treatment approval of that visit. Prescriptions are not linked to cases in the schema, so prescription items are not carried forward.
- **Server text in English.** Server messages and draft follow-up questions are English in both locales (unchanged from before).
- **Report-download routes.** Antigravity's `/api/patient/reports/download` and the UX branch's `/api/patient/reports/{id}/file` both exist. The portal uses the second. Pick one when merging to `main`.
- **Not pushed.** None of the branches is pushed or merged.
