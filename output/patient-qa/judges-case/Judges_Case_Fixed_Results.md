# P-901 judges' case · Fix and browser verification

**24 November 2026 · Branch `codex/judges-demo` (base `main` b217f1a)**

A pass establishes that this synthetic demo meets its acceptance criteria. Clinical release requires separate validation. One fixture does not measure general clinical accuracy.

## Verdict

| Acceptance criterion | Bangla | English |
| --- | --- | --- |
| Symptoms only: cautious answer that asks for HbA1c and fasting plasma glucose | Pass. `insufficient_evidence`; lists both criteria with quotes; "Still needed for this patient: HbA1c, Fasting plasma glucose" | Pass |
| Symptoms only: patient results not labelled "not in the library" | Pass | Pass |
| Complete case in chat: concludes diabetes mellitus | Pass (assessment `supported`) | Pass |
| Shows 7.4%, 154 mg/dL and 151 mg/dL with units | Pass | Pass |
| Links the reference PDF excerpt | Pass (chunk `eed395e6…`, page 1) | Pass |
| Subtype left undetermined | Pass ("ধরন (subtype) নির্ধারিত হয়নি") | Pass ("Subtype not determined") |
| Structured Analyze (gated synthetic path) | Pass: `ok`, top differential diabetes mellitus, values with units, no subtype | Pass |
| Model and mode | `gpt-4o-mini`, live | `gpt-4o-mini`, live |
| Verifier rejections in final passing run | none | none |

The final browser test asserts every row above. It passed **4 out of 4 consecutive runs** (both locales each run) after the last two fixes. Before those fixes, 3 runs failed. The causes are listed under "Flakiness found and fixed".

Screenshots (`fixed/`):
- `bn-01-symptoms-only.png`, `en-01-symptoms-only.png`
- `bn-02-complete-case.png`, `en-02-complete-case.png`
- `bn-03-structured-analyze.png`, `en-03-structured-analyze.png`
- `bn-04-citation.png`, `en-04-citation.png` (evidence sheet with the full passage and highlighted quote)
- Raw results: `fixed/results.json`

## Why the original run failed (rejection trace)

The original report (`Judges_Case_Browser_Results.md` in the main checkout) showed a generic abstention after the labs, and an `insufficient_evidence` Analyze. Tracing each dropped claim gave four separate causes:

| Cause | Type | What happened |
| --- | --- | --- |
| Patient value cited to a library quote | `patient_value_cited_to_library` / unsupported inference | The model wrote "HbA1c 7.4% confirms diabetes" and cited the table header `LABORATORY HbA1c (A1C) FASTING PLASMA GLUCOSE (FPG)`. The quote was verbatim, so the old check passed it, although the quote does not support the claim. 7.4% belongs to the case record, not the library. |
| Altered quotes | `altered_quote` | The model joined two table cells (`LABORATORY HbA1c (A1C) 6.5% or higher`) or paraphrased. These quotes are not verbatim, so they were correctly dropped. Then nothing verified remained. |
| Relevance gate | gate | A case-level question ("what can be concluded now?") contains no clinical terms. The gate found no overlap with the excerpts and blanked the answer. |
| Analyze had no lab comparison | missing feature | The default Analyze path did not compare structured lab values with library thresholds. |
| UI wording | wording | Missing patient labs were shown under "not in the library". |

## What changed

The model no longer writes the diagnostic conclusion. It proposes the criteria as JSON. Code then checks and decides:

1. Code parses patient values (analyte, value, unit, day) from structured lab fields and from the doctor's messages, in Bangla or English. Patient values are case data. The library is never cited for them.
2. The model proposes the condition, thresholds, the confirmation rule and the limitation. Each comes with an excerpt ID and a quote.
3. Code verifies every part:
   - the quote is verbatim in the named excerpt;
   - the threshold, unit and comparator appear in the quote;
   - the analyte appears near the quote;
   - the condition is stated in the quote;
   - no unstated subtype.
   Rejection reasons: `wrong_chunk`, `altered_quote`, `irrelevant_quote`, `unsupported_inference`, `unsupported_subtype`, `patient_value_mismatch`.
4. Code compares the values with the verified thresholds (it converts mmol/L) and sets a status:
   - `supported`: at least two results meet the criteria, a confirmation quote exists, and no result fails.
   - `needs_confirmation`, `conflicting` (abstains), `needs_case_data` or `no_criteria`.
5. Code writes every sentence of the reply in Bangla or English. Each criterion links to its exact quote.

Doctor chat and the gated Analyze use the same function (`runEvidenceAssessment`). The free-text path also got stricter:
- A sentence that states a patient value is dropped when it cites the library.
- A sentence about "this patient" needs a quote that covers it.

**Gating.** The Analyze path runs only with `DOCMATE_DEMO_MODE=true` and `DOCMATE_SYNTHETIC_ASSESSMENT=on`. The default clinical release gate is unchanged. Real-patient treatment, prescription issuance and official printing stay gated. The audit entry records the path, model, mode and every rejection.

**Not done (on purpose):**
- No P-901 special case.
- No answer key in prompts or in the library.
- No relaxing of the verifier.
- The repair retry (below) sends the rejection reasons back to the model. The same verifier checks the new proposal.

## Flakiness found and fixed during this pass

| Symptom | Cause | Fix (commit) |
| --- | --- | --- |
| Chat reply omitted HbA1c 7.4% in 1 of ~10 runs | The model merged two table cells into the HbA1c quote. The verifier correctly rejected it, but the reply then silently dropped the recorded value. | A value without a verified criterion is now shown as "not compared". A rejected quote gets one retry with the rejection reasons; the better verified proposal is kept (00f5087). |
| Structured Analyze returned the generic abstention in 1 run | OpenAI stream error (`model output unusable (stream error)`) | One retry after a stream error, skipped on cancel (9e1b815) |
| Symptoms-only answer fell back to free text in the first run (both locales) | That run overlapped a full eval run against the same API key. The cause was not captured. Not seen in 7 later runs. | Browser test now asserts the status, so a repeat fails visibly |
| Eval counted "Still needed for this patient" as an uncited sentence | The eval checker did not know the new note | Note treated as app text; placeholder items dropped (909be4e) |

## Negative controls

Unit tests in `tests/evidence-assessment.test.ts` (24 tests):
- wrong chunk ID; altered quote; altered threshold or unit; irrelevant verbatim quote; unsupported subtype; threshold quote without its analyte nearby;
- a patient value cited to a library quote;
- a changed patient value changes the result;
- conflicting results (HbA1c 5.8%, FPG 154 mg/dL) abstain;
- a single result needs confirmation;
- a merged table-cell quote shows the value as "not compared"; one repair retry; first proposal kept when the retry is no better; retry after a stream error.

Live Analyze controls (`.qa/analyze.mjs`, judges DB):
- full labs: `ok`;
- no labs: `insufficient_evidence` with the tests to record;
- conflicting labs: `insufficient_evidence`, shows which value disagrees.

## Commands and results

| Command | Result |
| --- | --- |
| `DATABASE_URL=postgresql://apple@localhost:5432/docmate_judges npx vitest run tests/evidence-assessment.test.ts` | 24/24 passed |
| `DATABASE_URL=postgresql://apple@localhost:5432/docmate_judges npx vitest run` | 408 passed, 13 skipped; 1 file fails at setup (see below) |
| `npx eslint` | clean |
| `npx tsc --noEmit` | clean |
| `npx next build` | exit 0 |
| `DATABASE_URL=… DOCMATE_QA_BASE_URL=http://127.0.0.1:3150 npx playwright test e2e/judges-demo.spec.ts` | 2 passed, 4 of 4 consecutive runs |
| `npm run -s eval:rag` (judges DB) | fully correct 44/45 (97.8%), the same total as before |
| `npm run -s eval:chat` (judges DB) | 67/68 scenarios; `acs-09` abstained once |
| Baseline: `main` code, same judges DB, `eval:chat` | 66/68; `dengue-11` and `acs-11` failed |

The judges DB has a smaller library than the main database. `dengue-11` fails on it with both `main` and this branch, so that failure is about library content, not a regression. `acs-07`/`acs-09`/`acs-11` flip between runs on both branches.

## Rerun from scratch

Run these commands from the worktree root. All data is synthetic.

```sh
createdb docmate_judges
# .env: DATABASE_URL=postgresql://<you>@localhost:5432/docmate_judges
#       DOCMATE_DEMO_MODE=true
#       DOCMATE_SYNTHETIC_ASSESSMENT=on
#       OPENAI_API_KEY=...   (without it the run records fallback mode)
npm run -s migrate
npm run -s seed
node --env-file=.env --import tsx scripts/ingest.ts output/pdf/DocMate_Judges_Diagnostic_Reference.pdf --direct
# Optional distractors: other published library sources (this run copied 5 from a demo DB, 27 chunks total)
node --env-file=.env --import tsx scripts/seed-phase4-dgda-formulary.ts
DOCMATE_DEBUG_ASSISTANT=1 npx next dev -p 3150 -H 127.0.0.1    # separate terminal
DATABASE_URL=postgresql://<you>@localhost:5432/docmate_judges \
  DOCMATE_QA_BASE_URL=http://127.0.0.1:3150 \
  npx playwright test e2e/judges-demo.spec.ts
```

The answer key (`output/pdf/DocMate_Judges_Demo_Case.md`) is not ingested. With `DOCMATE_DEBUG_ASSISTANT=1`, the server logs each proposal and its rejections as `[assessment] attempt=N …`.

## Remaining failures

- `tests/phase5-portals-workspaces.test.ts` fails at setup on `main`'s schema: the fixture uses `patients.full_name`. This is fixed on `codex/ux-rbac-audit` and not repeated here.
- The free-text chat path, used when no lab values are involved, still depends on the model. The eval rates above apply to that path.
- The criteria extractor knows four analytes (HbA1c, fasting, random and 2-hour OGTT glucose). Other diagnostic thresholds go through the free-text path.

## Overlap with Antigravity and other branches

Files changed here that are also changed on `main` or other branches:
- `src/lib/assistant/engine.ts`, `verify.ts` and `prompt.ts`; `src/lib/persona/phrasebank/data.ts`
- `tests/assistant-engine.test.ts`, `tests/golden-conversations.test.ts`, `scripts/eval-conversations.ts`, `eval/RESULTS.md` and `eval/rag/RESULTS.md`
- `messages/bn.json` and `messages/en.json`
- `src/app/[locale]/cases/[id]/page.tsx`
- `src/app/api/cases/[id]/analyze/route.ts` and `src/app/api/cases/[id]/route.ts`
- `src/components/shared/EvidenceSheet.tsx`

Migrations: `main` has `0010_patient_safety_and_privacy.sql`; `codex/ux-rbac-audit` adds `0010_schema_alignment.sql`. Renumber one of them before merging. This branch adds no migration.

None of the branches (`codex/doctor-treatment-safety`, `codex/ux-rbac-audit`, `codex/judges-demo`) is pushed or merged.
