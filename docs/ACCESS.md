# docs/ACCESS.md — DocMate AI Access Control & Feature Matrix

This document defines the formal access control rules, dynamic feature permissions, data-scope isolation policies, and verification gates for DocMate AI.

---

## 1. Six User Roles

| Role | Target Persona | Scope of Use |
| :--- | :--- | :--- |
| **`super_admin`** | Executive hospital/system administrator | Platform governance, access matrix toggling, library approval, user verification, system audit. **No clinical access by default**; break-glass required. |
| **`doctor`** | Licensed medical practitioner (BMDC registered) | Patient intake, clinical observation, evidence-backed AI assistance, prescribing, safety override acknowledgments. |
| **`student`** | Medical trainee / intern | Study tools, synthetic virtual patient practice, cited library Q&A, chapter quizzes, personal study notes. **Zero access to real patient records.** |
| **`researcher`** | Clinical epidemiologist / academic | Guideline search, side-by-side evidence comparison, collections, RIS/BibTeX citation export. **Zero access to real patient records.** |
| **`patient`** | Individual seeking or receiving medical care | Patient portal: shared prescriptions, reminder schedule, report uploads, pre-visit questionnaires, consent management. **Zero AI diagnosis or dose advice.** |
| **`medicine_controller`** | Regulatory pharmacologist / formulary officer | Medicine catalog management (brands, generics, DGDA registration, dose bounds, interactions), versioning, safety notices. **Zero access to real patient records.** |

---

## 2. Dynamic Feature Access Matrix

Access is evaluated dynamically via the server-side function `canUse(user, featureKey)` rather than hardcoded role strings.

| Feature Key | `super_admin` | `doctor` | `student` | `researcher` | `patient` | `medicine_controller` | Description |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`patients.manage`** | **BG** | **Y** | - | - | - | - | Create/edit patient profiles, clinical visits, encounters |
| **`patient.search`** | **Y** | **Y** | - | - | - | - | Search patient accounts and profiles by phone number with audit logging |
| **`patient.create`** | **Y** | **Y** | - | - | **Y** | - | Create new patient profile or family dependent with duplicate warning |
| **`history.request`** | **Y** | **Y** | - | - | - | - | Request in-clinic patient consent via OTP for cross-doctor clinical history |
| **`history.view`** | **BG** | **grant** | - | - | **own** | - | View full cross-doctor chronological timeline of patient encounters and prescriptions |
| **`portal.profiles`** | - | - | - | - | **own** | - | Switch between personal and dependent family member profiles |
| **`portal.prescriptions`** | - | - | - | - | **own** | - | View and download active and historical prescriptions |
| **`portal.reports`** | - | - | - | - | **own** | - | Upload diagnostic lab reports and toggle sharing with consulting doctors |
| **`portal.medicine_schedule`**| - | - | - | - | **own** | - | Track daily morning, noon, and night medication doses and log intake status |
| **`portal.permissions`** | - | - | - | - | **own** | - | Inspect active doctor access grants and revoke consent at any time |
| **`portal.access_log`** | - | - | - | - | **own** | - | Review tamper-evident audit logs of which doctors and staff accessed clinical records |
| **`ai.analyze`** | - | **Y** | - | - | - | - | Differential diagnosis analysis & follow-up questions |
| **`ai.treatment`** | - | **Y** | - | - | - | - | Guideline-recommended treatments & dosing rules |
| **`prescription.create`** | - | **Y** | - | - | - | - | Generate, sign, print, and share prescriptions |
| **`library.ask`** | **Y** | **Y** | **Y** | **Y** | - | **Y** | Q&A with verbatim citations over internal library |
| **`library.browse`** | **Y** | **Y** | **Y** | **Y** | - | **Y** | Read approved textbooks and clinical protocols |
| **`library.manage`** | **Y** | - | - | - | - | - | Ingest, edit, approve, and retire library sources |
| **`library.ingest`** | **Y** | - | - | - | - | - | Upload files (PDF, DOCX, JSON, ZIP) and import links/DOIs |
| **`library.review`** | **Y** | - | - | - | - | - | Review extractions, quality scores, safety flags, and test retrieval |
| **`library.retire`** | **Y** | - | - | - | - | - | Retire or retract published library sources immediately |
| **`medicine.search`** | **Y** | **Y** | **Y** | **Y** | - | **Y** | Search generic medicines, Bangladeshi brands, dosage forms |
| **`medicine.interactions`** | **Y** | **Y** | **Y** | **Y** | - | **Y** | Multi-drug interaction screening engine |
| **`medicine.manage`** | **Y** | - | - | - | - | **Y** | Add/edit drugs, brand mapping, DGDA registration, dose rules |
| **`medicine.notices`** | **Y** | **read** | **read** | **read** | **own** | **Y** | Broadcast/read regulatory safety notices and recalls |
| **`study.tools`** | - | - | **Y** | - | - | - | Virtual patient cases, chapter flashcards, quizzes, notes |
| **`research.tools`** | - | - | - | **Y** | - | - | Cross-guideline comparison, collections, RIS/BibTeX export |
| **`patient.portal`** | - | - | - | - | **own** | - | Patient self-service portal, schedule, report upload |
| **`feedback.send`** | **Y** | **Y** | **Y** | **Y** | **Y** | **Y** | Submit feedback or report clinical discrepancies |
| **`feedback.review`** | **Y** | - | - | - | - | **drug** | Review feedback (controller reviews drug feedback only) |
| **`users.manage`** | **Y** | - | - | - | - | - | Approve sign-ups, suspend accounts, session revocation |
| **`access.manage`** | **Y** | - | - | - | - | - | Configure feature matrix toggles and per-user overrides |
| **`plans.billing`** | **Y** | **view** | **view** | **view** | - | - | Subscription tiers, payment adapters, invoices |
| **`ai.settings`** | **Y** | **view** | **view** | **view** | - | - | Prompt versions, model selection, abstain thresholds |
| **`audit.read`** | **Y** | - | - | - | - | - | Read cryptographic hash-chain audit ledger |
| **`system.manage`** | **Y** | - | - | - | - | - | Maintenance mode, backups, kill switches |
| **`voice.assistant`** | **Y** | **Y** | **library** | **library** | - | - | Talk to DocMate voice assistant (students/researchers: library Q&A only) |
| **`voice.dictation`** | **Y** | **Y** | - | - | - | - | Dictate clinical intake, observations, and case notes |
| **`voice.avatar`** | **Y** | **Y** | **Y** | **Y** | - | - | Render animated cartoon doctor character |
| **`voice.readaloud`** | **Y** | **Y** | - | - | **own** | - | Read prescription schedules and instructions aloud |
| **`language.prefs`** | **Y** | **Y** | **Y** | **Y** | **Y** | **Y** | Manage personal multilingual preferences and reply modes |
| **`language.aliases.manage`** | **Y** | - | - | - | - | **drug** | Curate clinical term aliases & Banglish vocabulary (controller: drug only) |
| **`language.phonetic_typing`** | **Y** | - | - | - | - | - | Enable client-side phonetic Bangla typing in input fields |
| **`assistant.personalize`** | **Y** | **Y** | **Y** | **Y** | **Y** | **Y** | Personalize assistant tone, address style, verbosity, and voice preferences |
| **`assistant.phrasebank.manage`** | **Y** | - | - | - | - | - | Manage assistant phrase bank, curate variants, and audit tone review status |

*Legend*:
- **`Y`**: Fully enabled.
- **`-`**: Denied (returns HTTP 403 Forbidden).
- **`BG`**: Break-Glass only (requires written clinical emergency rationale, audited, time-limited).
- **`own`**: Access restricted strictly to own personal records.
- **`read`**: Read-only access to published bulletins.
- **`view`**: View plan status or public settings only.
- **`drug`**: Review drug-related feedback reports only.

---

## 3. Strict Server-Side Data-Scope Policies

These data-scope rules are **hardcoded invariants** enforced on the server. No toggle or database override can bypass them:

1. **Patient-Centred Ownership & Doctor Scope**:
   - Patient accounts (`patient_accounts`) belong to phone numbers. Each account holds multiple profiles (`patient_profiles` with relations: `self`, `child`, `spouse`, `parent`, `other`).
   - A doctor sees:
     - (a) **Every clinical record that doctor authored** (cases, prescriptions, notes).
     - (b) **Other doctors' records of a profile only while an active access grant (`full_history`) from the patient exists.**
   - If no grant exists or the grant has expired, other doctors' records are masked, and a warning prompts the clinician to request in-clinic patient consent via OTP.
2. **Patient Isolation & Sovereign Control**:
   - A patient logs in via mobile phone + SMS OTP.
   - Patients can switch between their personal and dependent profiles.
   - Patients view their unified medication intake schedule and mark doses as taken.
   - Patients view active doctor access grants and can revoke consent at any time.
   - Patients have access to a live, tamper-evident audit log showing exactly who accessed their records, when, and for what reason.
3. **PHI Wall**:
   - `student`, `researcher`, and `medicine_controller` accounts are physically blocked from accessing any patient record or clinical table (`HTTP 403 Forbidden`).
4. **Super Admin Clinical Exclusion & Break-Glass**:
   - `super_admin` has zero default access to clinical records, patient encounters, or diagnostic notes.
   - Super admins have access to metadata governance only (phone accounts, profile counts, duplicate candidate review queue, and non-destructive merges).
   - In rare system emergencies or court audits, a super admin may invoke **Break-Glass**:
     - Requires a formal written justification (`reason`).
     - Session is time-bounded (maximum 60 minutes).
     - Every read and action during break-glass is flagged in the audit log with `event: "break_glass.invoked"`.
5. **Non-Destructive Governance**:
   - Clinical records are append-only. Merging duplicate patient profiles reassigns references and unions health summaries into a new version while marking the duplicate as merged (`relation = 'merged'`). No clinical history is ever deleted.

---

## 4. Professional Verification Workflows

1. **Doctor Registration**:
   - Requires BMDC registration number and medical certificate document upload.
   - Account status is `pending_verification`.
   - `patients.manage`, `ai.analyze`, and `prescription.create` are disabled until a `super_admin` approves the verification record.
2. **Student Registration**:
   - Requires institute name, student ID number, and institutional email domain.
   - Automatic approval if email matches a whitelist in `systemSettings`; otherwise requires `super_admin` review.
3. **Researcher Registration**:
   - Requires institutional email or ORCID identifier.
   - Approved by `super_admin`.
4. **Medicine Controller**:
   - Created exclusively by invitation from a `super_admin`.
5. **Patient Registration**:
   - Self-registration via mobile phone number + SMS OTP verification. No admin approval required.
   - Linked to doctors through unique invite codes or OTP match upon explicit patient consent (*"আমি এই ডাক্তারকে অনুমতি দিচ্ছি"*).

---

## 5. Security & Audit Invariants

- **Central Enforcement**: `canUse()` is invoked in every API route handler, server action, and file export endpoint. UI hiding is strictly for user experience; the server governs authorization.
- **Audit Logging of Permission Changes**: Any modification to role features or user overrides by a super admin records before and after states in the tamper-evident hash-chained `audit_logs` table.
- **Instant Invalidation**: Permission cache invalidation occurs immediately on update.
