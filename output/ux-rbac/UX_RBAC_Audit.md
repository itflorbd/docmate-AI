# UX, validation and access-control audit

**24 November 2026 · Branch `codex/ux-rbac-audit`** (built on `codex/doctor-treatment-safety`)

The audit covered all six roles (doctor, patient, student, researcher, medicine controller and super admin) plus signed-out visitors. It ran against an isolated server and disposable database with synthetic demo accounts only.

## Verdict

| Question | Answer |
| --- | --- |
| Can each role reach only the pages and data it needs? | **Yes, for the routes tested.** The live matrix (`e2e/rbac-matrix.spec.ts`) passes for all roles and signed-out visitors on a production build. |
| Ready for a synthetic demo? | **Yes.** |
| Ready for real patients? | **No-go.** Clinical validation, approved library and formulary, the Antigravity fixes listed below, and release approval are still missing. |

## Access-control findings and fixes

| Severity | Finding (before) | Fix |
| --- | --- | --- |
| Critical | `DOCMATE_DEMO_MODE` was on unless set to exactly `false`. A deployment that missed the variable accepted `demo123` for the demo admin. | Demo mode needs `DOCMATE_DEMO_MODE=true`. In production it also needs `ALLOW_DEMO_IN_PRODUCTION=true`, otherwise it refuses to run (`src/lib/demo-mode.ts`). |
| Critical | `/api/patient/portal` fell back to the first patient account, so every role, including admin and students, got 200. | `requirePatientScope`: own account by verified phone, no fallback. |
| Critical | `/api/patient/consent`, `pre-visit` and `schedules` read and wrote the first patient in the table for any signed-in user. | These routes were unused, so I removed them. |
| High | Any user could change sharing on any report (`reports/toggle-share`). | The report must belong to one of the patient's own profiles. |
| High | `/api/patient/reports` returned 200 to every role. | Patients only. Resolving the correct patient is the Antigravity reports work. |
| High | Dose logging (`patient/intake`) accepted any `profileId`. | Must be one of the patient's own profiles; body validated. |
| High | Super admin could list every patient's clinical cases. | Clinical case APIs are doctor-only. The audited break-glass path remains for admins. |
| Medium | Research, study, library and medicine-search APIs checked sign-in only. | Each now enforces its feature key (`research.tools`, `study.tools`, `library.browse`, `medicine.search`, `library.ask`). |
| Medium | Pages and APIs disagreed. Doctors could open the study, research, controller and portal pages; patients could open the prescription editor; admins could open everything. | One per-role page list in `src/proxy.ts` that matches the API checks. The sidebar and Cmd+K show only allowed pages. |

Raw before/after matrices: `api-matrix-before.txt`, `api-matrix-after.txt`, `page-matrix-before.txt`, `page-matrix-after.txt`.

### Pages each role can open

| Role | Pages |
| --- | --- |
| Doctor | dashboard, cases, patients, prescriptions, library, ask, settings |
| Patient | portal (including own prescriptions), settings |
| Student | study, library, ask, settings |
| Researcher | research, library, ask, settings |
| Medicine controller | controller, library, ask, settings |
| Super admin | admin, controller, library, ask, settings |

## Validation

- **Request bodies now checked with Zod**, returning a 400 with field errors:
  - patient: dependent, intake
  - study: cases, notes, quizzes
  - research: collections, export
  - admin: duplicate decision, source review, retire and retract, patient merge
- **Still unvalidated:** `admin/library/settings` and `controller/medicines/import` (admin-only, complex payloads).
- **Not mine to change:** `patient/grants/revoke`, `patient/reports` and `patient/health-summary` belong to the Antigravity consent and reports work.

## UI/UX findings and fixes

| Finding | Fix |
| --- | --- |
| Tab bars overlapped on phones (controller, cases, portal) because the shared `TabsList` had a fixed 32 px height | List wraps; each tab is at least 36 px tall |
| Filter selects showed raw values ("all") | All selects pass an `items` label map |
| Five recall notices stacked above the content on the dashboard and editor | One compact banner shows the most urgent notice, with "Show N more" |
| Sidebar showed "Sign In" and a guest menu to signed-in users while the session loaded | Placeholders until the session is known; translated labels |
| Jargon titles ("Bangladeshi Prescription Builder", "BMDC compliant … safety engine", "Super Admin Control Plane", "fine-grained RBAC", "Cryptographic Audit", "Trainee Mode", "Evidence Mode") | Short plain titles, for example "New prescription" ("Choose a patient, add medicines, check safety, then finalize.") and "Admin". Done in both languages. |
| Practice cases and quizzes rendered blank when empty | Empty states with a short explanation |
| Safety header and DGDA banners used hard-coded rose and amber colours | Theme tokens |

Screenshots in this folder:
- `doctor-dashboard-en-1280.png`
- `doctor-cases-bn-390.png`
- `controller-controller-bn-390.png`
- `patient-portal-bn-390.png`
- `student-study-en-1280.png`
- `admin-admin-en-1280.png`

## Security headers (production build)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), geolocation=(), microphone=(self), payment=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- `X-Powered-By` removed

No Content-Security-Policy yet. It needs a nonce setup for Next.js inline scripts and should be tested separately.

## Commands and results

| Command | Result |
| --- | --- |
| `npx eslint` | 0 errors; 1 existing warning (`src/lib/assistant/engine.ts`) |
| `npx tsc --noEmit` | 0 errors |
| `DATABASE_URL=…/docmate_treatment npx vitest run` | 401 passed, 13 skipped. 1 file fails at setup (`phase5-portals-workspaces`: `patients.full_name` missing after a clean migrate; Antigravity migrations). |
| `npx next build` | exit 0 |
| `ALLOW_DEMO_IN_PRODUCTION=true npx next start -p 3140` then `npx playwright test e2e/treatment-safety.spec.ts e2e/rbac-matrix.spec.ts` | **13 passed** |

Rerunning the treatment suite on the production build exposed a bug: the draft could preselect a medicine whose evidence is conditional (Azithromycin, "when Legionella or Mycoplasma is suspected"). This is fixed in commit `fix(treatment): stable option order…` and cherry-picked to the treatment branch.

## Not done, or left to Antigravity

- The portal still shows some English labels in Bangla ("male", "self", "FAMILY ACCOUNT PROFILES"). Portal page edits overlap the Antigravity report-upload work.
- The patient reports API still reads the first legacy patient row for patients.
- Grant revocation does not check ownership.
- Clean migrations miss `patients.sex`, `patients.full_name` and `patient_reports.is_shared`. All three were added by hand to the disposable DB only.
- No full accessibility (axe) run or keyboard-only walkthrough in this pass.
- Not every page was reviewed in depth. The audit covered each role's main pages at 1280 px and 390 px.

**Shared files to merge carefully:**
- `messages/en.json` and `messages/bn.json` (new namespace `notices`; changed `admin` titles)
- `src/app/[locale]/cases/new/page.tsx` (select labels only)
- `src/app/api/patient/*`
- `src/proxy.ts`
- `src/components/ui/tabs.tsx`
- `scripts/demo-users.ts`
- `render.yaml`
- `next.config.ts`

## Follow-up: remaining work and full visual pass (24 November 2026)

**Done since the first audit:**
- Patient reports: real upload (PDF/JPG/PNG, max 10 MB, content-checked), private by default, owner/grant-checked file route.
- Grant revocation: owner-only, written in one transaction.
- Migration `0010_schema_alignment.sql`, checked on a clean database and as an upgrade.
- Intake starts with empty vitals and an unticked consent box.
- Login and OTP forms use POST.
- Library settings accept only allowlisted keys; medicine import has bounds; HTML library uploads are sandboxed.
- `e2e/patient-portal.spec.ts` passes.
- Full unit suite: **415/415** passed (40 files).

**Visual pass.** 105 page views: 6 roles plus signed-out visitors; English and Bangla; 1280 px light and dark; 390 px. Each view was checked with axe (WCAG 2 A/AA), console and API errors, and horizontal overflow.

| Check | First run | After fixes |
| --- | --- | --- |
| Pages with horizontal overflow | 2 | 0 |
| Pages with console or API errors | 6 (signed-out 401) | 0 |
| axe `select-name` (critical) | 18 pages | 0 |
| axe `label` (critical) | 4 pages | 0 |
| axe `scrollable-region-focusable` | 2 pages | 0 |
| axe `color-contrast` (serious) | 32 pages | 17 pages |

**Remaining.** `color-contrast` still fails on parts of these pages:
- admin access, language, audit and source detail
- doctor dashboard (dark), case and report (dark), prescription view
- patient settings
- landing and login pages

These need a per-element pass. Not every page was checked at every width.
