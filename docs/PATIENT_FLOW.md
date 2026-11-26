# docs/PATIENT_FLOW.md — Patient-Centred Clinical & Portal Workflows

This document details the patient-centred model, multi-profile account structure, in-clinic consent workflows, and patient portal routine in DocMate AI.

---

## 1. Overview & Architecture

In DocMate AI:
- **Patient Accounts (`patient_accounts`)** belong to a phone number (normalized to E.164: `+8801XXXXXXXXX`).
- **Patient Profiles (`patient_profiles`)**: Each account supports multiple dependent profiles (`self`, `child`, `spouse`, `parent`, `other`).
- **Profile Health Summary (`profile_health_summary`)**: Append-only versioned health summary recording allergies, chronic conditions, and current medications with optimistic locking (`version`).
- **Doctor Scope & Consent Grants (`access_grants`)**:
  - A doctor sees:
    - (a) All records authored by that doctor (`cases`, `prescriptions`).
    - (b) Records authored by other doctors **only while an active `full_history` grant exists**.
  - Grants can be activated via in-clinic SMS OTP verification, profile creation, or the patient portal.
- **Tamper-Evident Access Logs (`access_logs`)**: Every search, history view, and merge event is audited and transparently viewable by patients in their portal.

---

## 2. Doctor Intake Workflow (`/[locale]/patients/new`)

1. **Stage 1: Phone Search**:
   - The clinician enters the patient's phone number (Bangladeshi local formats `017...`, `+880...`, or Bengali numerals `০১৭১...` are automatically normalized).
   - Anti-enumeration rate-limiting: Maximum 30 queries per hour per doctor.
   - Searches are audited in `access_logs`.
   - Results show matching family profiles. For profiles where the doctor has no grant, phone numbers and names are masked (`Ka*** Ho***`, `+880 17***-**001`).
2. **Stage 2: Profile Selection & Creation**:
   - The doctor can select an existing family profile or create a new profile.
   - **Fuzzy Duplicate Warning**: If a new profile has a similar name and age ($\le 2$ years difference) to an existing profile on the account, a warning is raised. The doctor can either pick the existing profile or confirm creation.
3. **Stage 3: In-Clinic OTP Consent (`ConsentSheet`)**:
   - If other doctors' records exist on the selected profile and the doctor has no active grant, the doctor can open `ConsentSheet`.
   - An SMS OTP (6 digits, 5-minute validity, fixed to `123456` in demo mode) is sent to the patient's mobile.
   - Upon verification, an active `full_history` grant (30 days) is activated, and prior visits, prescriptions, and lab tests become visible.
4. **Stage 4: Clinical Intake**:
   - The doctor inputs Chief Complaint, Symptoms, Vitals (BP, Pulse, Temp, Weight, SpO2), Allergies, Chronic Conditions, and Medications.
   - Submitting creates the clinical case and associates it with the `profile_id`.
   - Idempotency key protection prevents duplicate submissions on double-clicks or transient network retries.

---

## 3. Clinical History Timeline (`/[locale]/patients/[id]`)

- **Patient Header**: Phone, Age, Sex, Relation, Blood Group, and Health Summary Chips.
- **Access Status Badge**:
  - `অনুমতি সক্রিয় (৩০ দিন বাকি)`: Active `full_history` grant.
  - `শুধুমাত্র আপনার রেকর্ড`: Author records only. Warning banner prompts the doctor to request patient consent to check cross-doctor interactions.
- **Unified Timeline**:
  - Chronological combination of Visits, Prescriptions, and Lab Reports.
  - Filter by Type (All / Visits / Prescriptions / Reports) and Doctor (All Doctors / My Records Only).
  - Vitals trend mini-cards (latest recorded BP, Pulse, Weight, Temp, SpO2).

---

## 4. Patient Portal (`/[locale]/portal`)

- **Phone + OTP Authentication**: Patients log in via mobile phone and 6-digit SMS OTP.
- **Multi-Profile Switcher**: Switch between `Self`, `Child`, `Spouse`, `Parent` profiles with a `+ নতুন সদস্য` (Add Member) button.
- **আজকের ওষুধ (Today's Medicine Schedule)**:
  - Morning, Noon, and Night medication routines.
  - One-tap **'খেয়েছি' (Taken)** button logs intake with timestamp into `medicine_intake_logs` and provides instant feedback (`✓ সম্পন্ন`).
- **আমার প্রেসক্রিপশন (Prescriptions)**:
  - View finalized prescriptions, doctor details, and medication instructions.
- **রিপোর্ট ও ফাইল (Reports & Investigations)**:
  - Upload lab reports with file title and test type.
  - Privacy toggle: `ডাক্তার দেখতে পারেন` (Shared) vs `ব্যক্তিগত` (Private).
- **অনুমতি ও নিরাপত্তা (Consent & Access Logs)**:
  - List of active doctor access grants with expiry and a one-click `অনুমতি বাতিল করুন` (Revoke Access) button.
  - **কে আমার তথ্য দেখেছেন (Access Audit Log)**: Real-time tamper-evident log showing doctor name, role, action, and timestamp.

---

## 5. Super Admin Patient Governance (`/[locale]/admin/patients`)

- **Accounts & Profiles Metadata**: Overview of registered phone accounts and family profiles without exposing clinical PHI.
- **Duplicate Review Queue**: Automated detection of potential duplicate accounts and profiles based on phonetic name matching and age proximity.
- **Non-Destructive Merge Tool**:
  - Allows an admin to merge a duplicate profile into a canonical profile with written clinical justification.
  - Reassigns all cases, prescriptions, and reports to the canonical profile.
  - Unions health summaries into a new version.
  - Retains the duplicate profile with `relation = 'merged'` (never deletes data).
  - Fully audited in `audit_logs` and `access_logs`.
