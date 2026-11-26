# DocMate AI visual recheck of both judges’ challenges

**24 November 2026 · 9/10 for the two synthetic demo workflows**

I drove the doctor workflow in Playwright Chromium and reviewed fresh screenshots. The desktop run used 1280 × 720 and the mobile run used 390 × 844. Both languages were exercised. The running sync candidate was `codex/sync-latest` (`fe15a69`). I also ran the separate challenge-fix candidate, `codex/challenge-gaps` (`5c0d61d`), on its local production build. Both used disposable synthetic records and guideline PDFs.

| Challenge | Score | Visual evidence and deduction |
| --- | --- | --- |
| Continue a prior visit | **4.5/5** | I started a follow-up from the timeline, saw the dated source and restricted-history notice, reconciled medicines, entered today's 138/86 reading, and confirmed the new working diagnosis. The treatment screen identified the history that it used and kept past labs and vitals separate. One English sync run failed a supplemental equality check on the prior visit's stored row. The targeted English retry and both challenge-fix desktop runs passed that check. The changed field from the first run remains unidentified, so I deducted 0.5 for uncertainty about repeatability. |
| Explain guideline disagreement | **4.5/5** | The case displayed the two opposing excerpts, source titles, dates and context. I opened both evidence sheets, saw that the disputed medicine stayed disabled until review, and saved the doctor's reason. On mobile, plain refresh showed an empty draft area with a Build draft button. Rebuilding restored the saved decision and rationale in both languages. I deducted 0.5 because the doctor needs that extra step to see the saved decision after refresh. |

## Evidence

- [Timeline](gaps-desktop/en-01-previous-visit-timeline.png) · [Carry-forward preview](gaps-desktop/en-02-carry-forward-preview.png) · [Previously recorded facts used in the new plan](gaps-desktop/en-04a-history-used-in-plan.png)
- [English guideline comparison](gaps-desktop/en-04b-guideline-conflict.png) · [Bangla comparison](gaps-desktop/bn-04b-guideline-conflict.png) · [Guideline A passage](gaps-desktop/en-05-guideline-A-passage.png) · [Guideline B passage](gaps-desktop/en-05-guideline-B-passage.png)
- [Mobile screen after refresh](gaps-mobile/en-07a-reload-before-rebuild.png) · [Saved review after rebuilding](gaps-mobile/en-07-review-after-reload.png)
- [First sync run results](sync-desktop/results.json) · [Targeted English retry](sync-desktop/english-retry.json) · [Challenge-fix desktop](gaps-desktop/results.json) · [Challenge-fix mobile](gaps-mobile/results.json)

## Commands and checks

- `npm exec -- playwright test e2e/followup-and-conflict.spec.ts --workers=1 --reporter=line` on the sync desktop candidate. Bangla passed. English reached the final review screen and failed the prior-row equality check. A targeted `--grep '\(en\)'` retry passed.
- Same Playwright command on the challenge-fix desktop copy. Both locales passed. The first scratch server startup required restoring the locale configuration file used by the compiled build.
- Same Playwright command with the scratch viewport set to 390 × 844 and a browser reload added. The direct-restoration assertion failed in Bangla, where the browser showed Build draft. The rerun rebuilt the draft through that button after refresh and passed in both locales.
- The suite also used supplemental API and database assertions for duplicate requests, prior-row integrity, approval blocking, audit entries, and controls with one source, a different population and altered evidence. The user-facing steps and results were observed in Chromium.

The score applies to the two synthetic challenge workflows. Main was outside this browser run, and the score does not assess real-patient readiness.
