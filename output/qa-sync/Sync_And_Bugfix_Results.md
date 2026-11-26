# Pull of latest code, merge and full-project check

**24 November 2026 · Branch `codex/sync-latest`**

## What was merged

- **Base:** `codex/doctor-dashboard`. It includes the judges' diagnosis fix, treatment safety, RBAC/UX, follow-up visits, guideline conflicts and the one-screen dashboard.
- **Local `main`:** 7 newer Antigravity commits (dashboards, header alert icon, cases list, portal, overlays). 7 conflicts, all resolved.
- **GitHub `origin/main`:** 4 commits (clinical intelligence engine, `/cases/new` intake routing, Docker/lockfile). 9 conflicts, all resolved.

**Kept from this branch** because the GitHub versions break AGENTS.md hard rules:
- **analyze:** origin built diagnoses from a hardcoded disease table instead of the library.
- **treatment:** origin used the chief complaint as the diagnosis, cited an arbitrary passage, and invented a citation marked verified.
- **finalize:** origin removed the release gate and safety decision, and wrote audit rows outside the hash chain.
- **follow-up answers (`/turns`):** origin answered from the disease table.
- **prompt:** origin asked the model for dosages in free text.
- **report tab:** origin's generated report was not built from the approved plan.
- The unused `/api/cases/[id]/report` route was removed for the same reason.

The clinical library modules and their tests from GitHub are kept. They are not wired into clinical answers.

## Bugs found and fixed

| Area | Bug | Fix |
| --- | --- | --- |
| Assistant | An unrelated question on a case with recorded labs ran the diabetes lab assessment | The assessment runs only when the turn reports results, names a test, or asks about the diagnosis or case |
| Structured Analyze (gated) | With no labs, any case could be asked for HbA1c/FPG, because the diabetes reference matched the generic criteria query | Without labs, the criteria passage must be a top match for the complaint and symptoms and name at least two of them |
| Chat and voice markdown | `_italic_` notes showed raw underscores | Underscore italics supported at word edges (snake_case untouched) |
| Header alerts | Admin pages called `/api/cases` and got 403 on every page | Alerts load for doctors only |
| Header alerts / dashboard | Recall links pointed doctors to `/controller`, which they cannot open | Links go to `/prescriptions` |
| Safety engine (merged) | A built-in liver rule suppressed the formulary's own contraindication, so the override path disappeared | Formulary alert always reported; unsourced wording removed |
| New intake (`/cases/new`) | Random patient code and the saved draft were read during render (server/browser mismatch; form could reset while typing) | Code and draft are applied after mount |
| New intake | URL prefill set state inside an effect | Moved into initial state |
| Diagnosis dialog | Hard-coded English "Other / Clinical Override" and placeholder | Translated (bn/en) |
| Theme | `text-destructive-foreground` was not registered, so red buttons had dark text; light red too light on tinted backgrounds | Token registered; red darkened one step |
| Accessibility | 31 views with low contrast; chat list semantics | Fixed in alerts, badges, printed prescription paper, portal, admin, settings, login, landing; list items have `role="listitem"` |
| Lint | 21 errors and 20 warnings in merged code | 0 errors, 0 warnings |
| Tests | Stale e2e texts; voice test picked the newest case | Updated to current behaviour; fixed fixture case |

## Results

| Command | Result |
| --- | --- |
| `npx eslint .` | exit 0, no warnings |
| `npx tsc --noEmit` | exit 0 |
| `DATABASE_URL=…/docmate_integration npx vitest run` | 49 files, 502 tests passed |
| `npx next build` | exit 0 |
| `DOCMATE_QA_SYNTHETIC=1 … npx playwright test e2e --workers=1` | 39/39 passed, twice in a row |
| Full sweep: 105 page views (all roles plus signed-out; en/bn; light/dark; 1280 and 390 px) | 0 horizontal overflow; 0 console/API errors (was 33); axe critical/serious: color-contrast only on case pages while the composer is disabled during the automatic review (was 31 views); `aria-required-children` fixed |

## Not done

- `main` itself was not changed. It has uncommitted work in its checkout (`src/app/[locale]/admin/page.tsx`, `src/db/index.ts`, assistant files). Fast-forward or merge `codex/sync-latest` after that work is committed.
- Nothing was pushed.
- The faded composer controls while a reply is being written keep the default shadcn disabled style.
