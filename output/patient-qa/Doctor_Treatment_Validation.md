# Doctor treatment workflow validation

**24 November 2026 · Branch `codex/doctor-treatment-safety` (base `1ebea0b`)**

| Verdict | Decision |
| --- | --- |
| Synthetic doctor workflow ready | **Go, for synthetic demonstration only.** All 6 live fixtures matched their expected outcome. Every route that can finalize or issue a prescription now uses one server-side safety decision. |
| Ready for real patient treatment | **No-go.** Clinician review of the expected outcomes and safety policy is still missing. So are an approved evidence library and formulary (the demo formulary has no source citations), integrated validation with the Antigravity workstream, and organisational release approval. Official issuance stays closed by default. |

The expected outcomes below were written by the engineer (Claude Code) from the fixture design and AGENTS.md. **No clinician supplied or reviewed them.** Passing tests measure software behaviour. They do not measure clinical accuracy or effectiveness, because no patient outcome evidence exists.

## What changed (one commit per fix)

| Commit | Fix |
| --- | --- |
| `0014d52` | One server-side safety decision (`src/lib/prescription-safety.ts`, `src/lib/prescription-safety-server.ts`) used by safety-check, draft create/update and finalize. Create accepts drafts only. Finalize requires the reviewed regimen hash and context version, re-runs safety, audits overrides, then checks the release gate before an optimistic-lock write. The editor displays the server result and no longer decides safety itself. |
| `dc4102c` | Patient delivery, QR verification and print show issued prescriptions only. Removed placeholder BMDC numbers, degrees and hospital names. |
| `a9d9f92` | Urgent findings are stored separately from evidence sufficiency and survive reanalysis. Only the treating doctor can resolve one, with a basis and rationale. The resolution is audited and stops applying when the record changes. A non-dismissable banner is shown on the case page. |
| `4a51db5` | Deterministic treatment drafts. The flow: confirmed diagnosis, then guideline-only evidence with verified quotes, then formulary dosing, then server safety, then doctor approval, then report preview. The client-side acknowledgement dialog and the hard-coded doctor signature are removed. |
| `c4f1b80` | Playwright suite `e2e/treatment-safety.spec.ts`. It found a race in the prescription editor, which this commit also fixes. |

### Safety policy (needs clinician review)

- **Hard stops, cannot be overridden:**
  - documented allergy, including drug-class allergy
  - pregnancy category D or X when pregnant
  - formulary minimum and maximum age (paediatric and elderly limits)
  - renal "avoid" below the eGFR threshold
  - DGDA critical recall
  - medicine not in the formulary
  - missing safety inputs: allergy status, pregnancy status for a female aged 12–50, and weight for a child under 12
- **Need a written reason (at least 10 characters):** critical interaction, duplicate therapy, recorded condition contraindication, and renal dose reduction. Each override is audited with the clinician, alert, regimen hash and patient-context version. It stops applying when either the regimen or the patient context changes.
- **Warnings, shown but not blocking:** for example, eGFR not recorded for a renally adjusted medicine.
- **Release gate:** `DOCMATE_CLINICAL_RELEASE=approved` plus `DOCMATE_CLINICAL_RELEASE_REF`. Both are unset by default, so finalize returns 423.

### Evidence rules for a treatment draft

1. The formulary indication must match the diagnosis.
2. The source must be a published guideline. Patient records, case reports, textbooks and unpublished sources are never used.
3. The supporting sentence must name the medicine and recommend it. A clause with a negation or risk wording is never used as support.
4. The sentence must fit the documented patient (adult or child, pregnancy, penicillin allergy).
5. The quote must verify verbatim against the chunk.

Contradicted evidence excludes the medicine. Conditional quotes show their condition, for example "Only if: when Legionella or Mycoplasma is suspected". No language model is involved.

## Live results (Playwright, isolated server)

| Fixture | Expected (engineer) | Observed | Match |
| --- | --- | --- | :---: |
| F1 pneumonia, no known allergies | Amoxicillin proposed with a verified guideline quote; safety clear; approval saved; draft report; issuance blocked | draft proposed (Amoxicillin, Azithromycin); UI safety `clear,clear` = server; finalize 423 | ✅ |
| F2 allergy and pregnancy status not recorded | insufficient_evidence with allergy and pregnancy questions | insufficient_evidence; missing `allergy_status, pregnancy_status` | ✅ |
| F3 urgent chest pain (mirrors P-102) | both rounds insufficient_evidence + urgent; stays red_flag after diagnosis; draft refused; audited resolution | rounds 1–2 `insufficient_evidence/urgent`; status `red_flag`; draft `urgent_review_required`; 1 audit row by the doctor; afterwards `none` | ✅ |
| F4 pneumonia + penicillin anaphylaxis | Amoxicillin shown as a stop and refused by the server | Amoxicillin and Cefuroxime blocked; Azithromycin, Doxycycline, Levofloxacin clear; approve Amoxicillin 422 | ✅ |
| F5 migraine (no guideline) | abstain; zero options | insufficient_evidence; 0 options | ✅ |
| F6 manual prescription paths | create-as-final 422; allergy 422; stale 409; clean draft 423; nothing finalized; editor = server | 422 / blocked→422 / 409 / clear→423; stored `draft,draft`; editor `blocked` = server `blocked` | ✅ |

| Measure | Result |
| --- | --- |
| Plan coverage (eligible fixtures F1, F4) | 2 / 2 produced an approvable plan |
| Appropriate abstention (F2, F5) and urgent refusal (F3) | 3 / 3 |
| Citation validity | 7 / 7 proposed options carry quotes verified verbatim in code; F1 citations checked against the DB as published-guideline chunks: 2 / 2 |
| Evidence relevance | F5 cited nothing. The unit test "never cites an unrelated synthetic record, even when its quote is verbatim" passes. Live limitation: the demo library has 0 chunks that name a formulary medicine, so the browser run cannot show a rejected record quote. That case is covered only by unit tests. |
| Red-flag handling | 1 / 1 live; 10 / 10 unit and route tests |
| Medication safety enforcement | F4 + F6: 7 / 7 blocked or refused paths returned the expected status; browser status matched the server 2 / 2 |

Screenshots in `output/patient-qa/treatment/`:
- `F1-treatment-draft.png`
- `F1-evidence-sheet.png`
- `F1-report-preview.png`
- `F2-insufficient-evidence.png`
- `F3-urgent-warning.png`
- `F3-resolve-dialog.png`
- `F4-safety-stop.png`
- `F5-no-guideline.png`
- `F6-editor-safety.png`

Raw results: `results.json`.

## Commands and results

| Command | Result |
| --- | --- |
| `git worktree add -b codex/doctor-treatment-safety ../DoctMate-treatment 1ebea0b` | Isolated checkout; main checkout untouched |
| `createdb docmate_treatment`; `npm run migrate`; `npm run seed`; `node --import tsx scripts/seed-phase4-dgda-formulary.ts` | Disposable DB. The 4 published guidelines and the demo library were copied read-only from the main DB. |
| `npx next dev -p 3130 -H 127.0.0.1` | Isolated server |
| `DATABASE_URL=…/docmate_treatment DOCMATE_QA_BASE_URL=http://127.0.0.1:3130 npx playwright test e2e/treatment-safety.spec.ts` | **6 passed** |
| `DATABASE_URL=…/docmate_treatment npx vitest run tests/{prescription-safety,case-urgency,treatment-draft,safety-engine,citation-verifier,phase3-prescriptions,red-flags}.test.ts` | **97 passed** (7 files) |
| `DATABASE_URL=…/docmate_treatment npx vitest run` | 399 passed, 13 skipped. 1 file fails at setup (`phase5-portals-workspaces`: column `patients.full_name` missing after a clean migrate; existing gap). |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint` | 0 errors. 1 existing warning in `src/lib/assistant/engine.ts`. |
| `npx next build` | Exit 0 |
| `verifyAuditChain()` on the disposable DB after the final run | valid, 21 rows |

## Remaining gaps

- The safety policy, fixture expectations and evidence rules have not been reviewed by a clinician.
- The formulary has no `source_chunk_id` values, and the guideline library is synthetic demo content.
- Red-flag detection uses only the existing rules. No vital-sign rules were added, because there is no approved source or clinician fixture for them. Red flags raised in case chat are not stored as urgent findings.
- Running analysis still resets a confirmed case to `insufficient_evidence` when it has no active urgent finding (existing behaviour).
- Official issuance from a case returns 501 after the gate. Linking a case to a patient record and prescription pad is part of the coordinated release work.
- Hard stops are not exercised live for pregnancy, age, renal impairment or recall. Those are covered only by unit tests.

## Integration dependencies on the Antigravity workstream

| Item | Effect here | Action at integration |
| --- | --- | --- |
| Clean migrations miss `patients.sex` | `POST /api/patients` returns 500. I added the column to the disposable DB only. | Ship the migration, then rerun F6 |
| Clean migrations miss `patients.full_name` | phase5 test file fails at setup | Ship the migration, then rerun the full Vitest suite |
| Intake default vitals (P0), including weight 65 kg | A default weight would wrongly count as a recorded child weight in the safety check | After the fix, rerun `prescription-safety` and F2 with an untouched weight field |
| `/api/patient/portal` falls back to the first patient account | Finalized prescriptions could reach the wrong patient through the portal | Remove the fallback with the login and consent work; test with two patient accounts |
| `audit_logs.case_id ON DELETE SET NULL` | Deleting a case rewrites hashed audit rows and breaks `verifyAuditChain` | Decide on retention: block case deletion, or exclude `case_id` from the hash |
| Vitest does not load `.env` | DB tests fall back to the main `docmate` DB (`src/db/index.ts`) | Set `DATABASE_URL` in CI and on QA machines. Early unit runs in this session wrote their usual test rows to the main DB before I noticed. |

**Files both workstreams may touch:**
- `messages/en.json` and `messages/bn.json` (new namespaces `urgentFindings` and `treatmentDraft` only)
- `src/app/[locale]/cases/[id]/page.tsx`
- `src/app/[locale]/prescriptions/new/page.tsx`
- `src/app/api/patient/prescriptions/route.ts`
- `src/lib/red-flags.ts`

`src/db/schema.ts` and the migrations were not changed.

**Rerun after integration:**
- `npm run migrate` on a clean DB, then a schema diff
- `npx tsc --noEmit`, `npx eslint`, `npx next build`
- the full Vitest suite with `DATABASE_URL` pointing at a disposable DB
- `tests/i18n-parity.test.ts`
- `e2e/treatment-safety.spec.ts`
- the patient-portal journey with two accounts
- `verifyAuditChain()`
