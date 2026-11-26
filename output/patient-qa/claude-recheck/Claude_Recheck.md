# Independent DocMate browser recheck

24 November 2026. I ran Chromium against separate copies of Claude's diagnosis branch (`codex/judges-demo`, `8003c02`) and treatment branch (`codex/doctor-treatment-safety`, `6d036d0`) with their existing disposable synthetic databases. The diagnosis and treatment branches are separate from the current `main` (`b217f1a`). The diagnosis branch was tested with the synthetic assessment gate enabled. The treatment branch was tested with the clinical release gate closed. Local substitute fonts avoided external font requests in the test copies.

## Diagnosis

The live Bangla browser walkthrough passed. Symptoms alone prompted for the missing labs. With all three results, chat and structured Analyze identified **diabetes mellitus**, showed the recorded units and values, cited the PDF, and left the subtype undetermined.

The English chat showed the same diagnostic result. The original suite timed out at the English Analyze step. A separate retry on the same structured case returned HTTP 200, `status: ok`, top differential `diabetes mellitus`, and a summary showing all three results with the subtype undetermined. The Bangla and English assessment results reported the live `gpt-4o-mini` path. [Bangla Analyze](bn-03-structured-analyze.png) · [English chat](en-02-complete-case.png) · [English Analyze response](english-analyze.json)

## Exact P-901 treatment result

I entered the three structured lab results for the 47-year-old fixture, recorded diabetes mellitus as the synthetic working diagnosis, opened Treatment and clicked **Build draft**. The request returned HTTP 200 with `insufficient_evidence` and zero options. The screen said there was no guideline passage naming a medicine for that diagnosis. The judges' PDF covers diagnosis, confirmation and subtype limits. It contains no medication recommendation. [Treatment screenshot](P901-treatment.png) · [Raw result](P901-treatment.json)

## What the treatment engine proposed

For the separate synthetic pneumonia fixture with documented no known allergies, the treatment engine displayed **amoxicillin** and a conditional **azithromycin** option. It preselected amoxicillin only. I opened the guideline citation and followed the clinician approval into the draft report. Official issuance returned HTTP 423. These are observed synthetic demo suggestions. The treatment engine uses published library passages and structured formulary data. [Treatment draft](F1-treatment-draft.png) · [Evidence sheet](F1-evidence-sheet.png) · [Draft report](F1-report-preview.png)

For the documented penicillin anaphylaxis fixture, Amoxicillin and Cefuroxime were displayed as blocked. The server refused Amoxicillin approval with HTTP 422. The other listed options were Azithromycin, Doxycycline and Levofloxacin under the fixture's safety rules. The supplemental cases preserved the urgent chest-pain warning on reanalysis and withheld drafts when inputs or guideline evidence were missing. [Allergy stop](F4-safety-stop.png)

## Commands and results

- `npm exec -- playwright test e2e/judges-demo.spec.ts --workers=1 --reporter=line` passed Bangla. English reached a complete chat answer and timed out at Analyze. The targeted rerun via `node english-analyze.cjs` returned the expected structured result.
- `npm exec -- playwright test e2e/treatment-safety.spec.ts --workers=1 --reporter=line` passed five fixtures on the warmed instance with extended waits in the scratch harness. F6 timed out in the editor. The targeted `--grep 'F6 manual prescription'` retry passed. It matched the editor and server safety state and verified that both saved prescriptions were drafts.
- `node diabetes-treatment.cjs` opened P-901 in Chromium and verified the treatment response of zero options.

## Scope

The branches were exercised separately. An integrated run from one checkout still needs verification. Clinical accuracy, patient outcomes, and real patient release remain outside this synthetic validation.
