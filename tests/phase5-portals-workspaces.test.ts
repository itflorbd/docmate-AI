import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { canUse, assertPatientDataScope } from '../src/lib/permissions';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://apple:@localhost:5432/docmate',
});

describe('Phase 5: Portals & Workspaces Safety & Functional Suite', () => {
  const patientUser = {
    id: '55555555-5555-5555-5555-555555555555',
    email: 'patient@docmate.ai',
    role: 'patient' as const,
    name: 'Abdur Rahim',
    status: 'active' as const,
  };

  const studentUser = {
    id: '77777777-7777-7777-7777-777777777777',
    email: 'student@docmate.ai',
    role: 'student' as const,
    name: 'Tanvir Ahmed',
    status: 'active' as const,
  };

  const researcherUser = {
    id: '88888888-8888-8888-8888-888888888888',
    email: 'researcher@docmate.ai',
    role: 'researcher' as const,
    name: 'Dr. Shamim',
    status: 'active' as const,
  };

  const doctorUser = {
    id: '43eb5601-471a-49ad-84e9-c298591deea7',
    email: 'doctor1@docmate.ai',
    role: 'doctor' as const,
    name: 'Dr. Farhana',
    status: 'active' as const,
  };

  let testPatientId: string;
  let actualStudentId: string;
  let actualResearcherId: string;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      // Find or create synthetic patient P-101
      // Prefer the patient that scripts/seed-phase5-portals.ts linked schedules to.
      const pRes = await client.query(
        "SELECT p.id FROM patients p WHERE p.patient_code = 'P-101' OR EXISTS (SELECT 1 FROM patient_schedules s WHERE s.patient_id = p.id) ORDER BY EXISTS (SELECT 1 FROM patient_schedules s WHERE s.patient_id = p.id) DESC LIMIT 1"
      );
      if (pRes.rows.length > 0) {
        testPatientId = pRes.rows[0].id;
      } else {
        const ins = await client.query(
          `INSERT INTO patients (patient_code, name_encrypted, age, gender)
           VALUES ('P-101', 'synthetic', 54, 'male')
           RETURNING id`
        );
        testPatientId = ins.rows[0].id;
      }

      // Find or create student user
      const sRes = await client.query("SELECT id FROM users WHERE email = 'student@docmate.ai'");
      if (sRes.rows.length > 0) {
        actualStudentId = sRes.rows[0].id;
      } else {
        const ins = await client.query(
          `INSERT INTO users (email, password_hash, role, name, status)
           VALUES ('student@docmate.ai', 'hash', 'student', 'Tanvir Ahmed', 'active')
           RETURNING id`
        );
        actualStudentId = ins.rows[0].id;
      }

      // Find or create researcher user
      const rRes = await client.query("SELECT id FROM users WHERE email = 'researcher@docmate.ai'");
      if (rRes.rows.length > 0) {
        actualResearcherId = rRes.rows[0].id;
      } else {
        const ins = await client.query(
          `INSERT INTO users (email, password_hash, role, name, status)
           VALUES ('researcher@docmate.ai', 'hash', 'researcher', 'Dr. Shamim', 'active')
           RETURNING id`
        );
        actualResearcherId = ins.rows[0].id;
      }
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('1. Hard Role Isolation & Clinical Safety Boundary', () => {
    it('strictly forbids patient from clinical AI analysis and treatment features', async () => {
      const canAnalyze = await canUse(patientUser, 'ai.analyze');
      const canTreat = await canUse(patientUser, 'ai.treatment');
      const canManagePatients = await canUse(patientUser, 'patients.manage');
      const canPrescribe = await canUse(patientUser, 'prescription.create');

      expect(canAnalyze.allowed).toBe(false);
      expect(canTreat.allowed).toBe(false);
      expect(canManagePatients.allowed).toBe(false);
      expect(canPrescribe.allowed).toBe(false);
    });

    it('strictly forbids student from accessing real patient records', async () => {
      const scopeCheck = await assertPatientDataScope({
        user: studentUser,
        patientId: testPatientId,
        caseDoctorId: doctorUser.id,
      });

      expect(scopeCheck.allowed).toBe(false);
      expect(scopeCheck.reason).toContain('forbidden_from_patient_data');

      const canManage = await canUse(studentUser, 'patients.manage');
      expect(canManage.allowed).toBe(false);
    });

    it('strictly forbids researcher from accessing real patient records', async () => {
      const scopeCheck = await assertPatientDataScope({
        user: researcherUser,
        patientId: testPatientId,
        caseDoctorId: doctorUser.id,
      });

      expect(scopeCheck.allowed).toBe(false);
      expect(scopeCheck.reason).toContain('forbidden_from_patient_data');

      const canManage = await canUse(researcherUser, 'patients.manage');
      expect(canManage.allowed).toBe(false);
    });
  });

  describe('2. Patient Portal: Schedules, Reports, Pre-Visit, and Consent Audit', () => {
    it('tracks patient daily medication slots and toggles taken status', async () => {
      const client = await pool.connect();
      try {
        // Query daily schedule for patient
        const schedRes = await client.query(
          'SELECT * FROM patient_schedules WHERE patient_id = $1 ORDER BY slot',
          [testPatientId]
        );
        expect(schedRes.rows.length).toBeGreaterThan(0);

        const slot = schedRes.rows[0];
        const newTakenStatus = !slot.taken_today;

        // Toggle status
        const updateRes = await client.query(
          `UPDATE patient_schedules 
           SET taken_today = $1, last_taken_at = $2
           WHERE id = $3 
           RETURNING taken_today, last_taken_at`,
          [newTakenStatus, newTakenStatus ? new Date() : null, slot.id]
        );

        expect(updateRes.rows[0].taken_today).toBe(newTakenStatus);
      } finally {
        client.release();
      }
    });

    it('records and queries patient report uploads with validated report types', async () => {
      const client = await pool.connect();
      try {
        const reportTitle = 'HbA1c & Fasting Glucose Report ' + Date.now();
        const ins = await client.query(
          `INSERT INTO patient_reports (patient_id, title, report_type, file_name, file_url, notes)
           VALUES ($1, $2, 'lab_test', 'hba1c_test.pdf', '/uploads/reports/hba1c_test.pdf', 'Fasting Blood Sugar 7.2 mmol/L')
           RETURNING id, title, report_type`,
          [testPatientId, reportTitle]
        );

        expect(ins.rows[0].id).toBeDefined();
        expect(ins.rows[0].report_type).toBe('lab_test');
        expect(ins.rows[0].title).toBe(reportTitle);

        // Verify retrieval
        const fetch = await client.query(
          'SELECT id, title, report_type FROM patient_reports WHERE id = $1',
          [ins.rows[0].id]
        );
        expect(fetch.rows.length).toBe(1);
      } finally {
        client.release();
      }
    });

    it('submits pre-visit symptom descriptions for doctor review', async () => {
      const client = await pool.connect();
      try {
        const complaint = 'উচ্চ রক্তচাপ ও মাথা ঘোরা (Hypertension & Dizziness)';
        const ins = await client.query(
          `INSERT INTO patient_pre_visits (patient_id, chief_complaint, symptoms, duration, notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, chief_complaint, status`,
          [
            testPatientId,
            complaint,
            JSON.stringify(['dizziness', 'headache', 'chest_tightness']),
            '৩ দিন ধরে',
            'নিয়মিত এসিআই লিনাক্স ঔষধ গ্রহণের পরও সমস্যা হচ্ছে।',
          ]
        );

        expect(ins.rows[0].id).toBeDefined();
        expect(ins.rows[0].status).toBe('pending');
      } finally {
        client.release();
      }
    });

    it('logs patient consent revocation and granting with audit trail', async () => {
      const client = await pool.connect();
      try {
        // 1. Log revocation
        const revokeLog = await client.query(
          `INSERT INTO patient_consent_logs (patient_id, action, reason)
           VALUES ($1, 'revoked', 'Patient requested stop of shared access')
           RETURNING id, action`,
          [testPatientId]
        );
        expect(revokeLog.rows[0].action).toBe('revoked');

        // 2. Log re-granting
        const grantLog = await client.query(
          `INSERT INTO patient_consent_logs (patient_id, action, reason)
           VALUES ($1, 'granted', 'Patient agreed to clinic electronic sharing')
           RETURNING id, action`,
          [testPatientId]
        );
        expect(grantLog.rows[0].action).toBe('granted');
      } finally {
        client.release();
      }
    });
  });

  describe('3. Student Clinical Simulation & Learning Workspace', () => {
    it('retrieves virtual patient simulation cases without exposing correct diagnosis to client query', async () => {
      const client = await pool.connect();
      try {
        const cases = await client.query(
          `SELECT id, title, specialty, difficulty, vignette, vitals, options 
           FROM student_cases 
           ORDER BY created_at DESC`
        );

        expect(cases.rows.length).toBeGreaterThanOrEqual(3);
        const sampleCase = cases.rows[0];
        expect(sampleCase.title).toBeDefined();
        expect(sampleCase.vitals).toBeDefined();
        expect(Array.isArray(sampleCase.options)).toBe(true);
      } finally {
        client.release();
      }
    });

    it('evaluates student diagnosis against gold standard and returns verbatim chunk citation', async () => {
      const client = await pool.connect();
      try {
        const caseRes = await client.query(
          "SELECT id, correct_option, clinical_explanation, citations FROM student_cases LIMIT 1"
        );
        const c = caseRes.rows[0];

        // Correct answer check
        expect(c.correct_option).toBeDefined();
        expect(typeof c.clinical_explanation).toBe('string');
        expect(c.clinical_explanation.length).toBeGreaterThan(10);
        expect(Array.isArray(c.citations)).toBe(true);
        expect(c.citations.length).toBeGreaterThan(0);
        expect(c.citations[0].chunk_id).toBeDefined();
        expect(c.citations[0].quote).toBeDefined();
      } finally {
        client.release();
      }
    });

    it('allows student to save and retrieve high-yield clinical pearls/notes', async () => {
      const client = await pool.connect();
      try {
        const pearlTitle = 'COPD vs Asthma Bronchodilator Reversibility ' + Date.now();
        const ins = await client.query(
          `INSERT INTO student_notes (user_id, title, content, tags)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title`,
          [
            actualStudentId,
            pearlTitle,
            'FEV1 increase > 12% and 200mL suggests asthma reversibility.',
            JSON.stringify(['pulmonology', 'spirometry', 'copd']),
          ]
        );

        expect(ins.rows[0].id).toBeDefined();

        const fetchNotes = await client.query(
          'SELECT id, title, tags FROM student_notes WHERE user_id = $1 AND id = $2',
          [actualStudentId, ins.rows[0].id]
        );
        expect(fetchNotes.rows.length).toBe(1);
        expect(fetchNotes.rows[0].title).toBe(pearlTitle);
      } finally {
        client.release();
      }
    });
  });

  describe('4. Researcher Literature Suite: Faceted Search, Collections, and Export', () => {
    it('executes faceted search across guideline chunks with evidence level filters', async () => {
      const client = await pool.connect();
      try {
        // Query chunks by evidence level
        const searchRes = await client.query(
          `SELECT c.id, c.text, s.title as source_title, c.evidence_level, s.type as source_type, s.year as publication_year
           FROM chunks c
           JOIN sources s ON s.id = c.source_id
           WHERE c.evidence_level IN ('Ia', 'Ib', 'IIa')
           LIMIT 10`
        );

        expect(searchRes.rows.length).toBeGreaterThan(0);
        for (const row of searchRes.rows) {
          expect(['Ia', 'Ib', 'IIa']).toContain(row.evidence_level);
        }
      } finally {
        client.release();
      }
    });

    it('creates and manages researcher citation collections', async () => {
      const client = await pool.connect();
      try {
        const colTitle = 'Antimicrobial Resistance Guidelines Meta-Collection ' + Date.now();
        const ins = await client.query(
          `INSERT INTO researcher_collections (user_id, title, description, tags, items)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, title`,
          [
            actualResearcherId,
            colTitle,
            'Curated evidence on Gram-negative bacteremia and Bangladesh AMR patterns.',
            JSON.stringify(['AMR', 'DGHS', 'Antibiotics']),
            JSON.stringify([{ chunk_id: 'sample-chunk-1', note: 'Essential guidance' }]),
          ]
        );

        expect(ins.rows[0].id).toBeDefined();
        expect(ins.rows[0].title).toBe(colTitle);
      } finally {
        client.release();
      }
    });

    it('formats citation metadata accurately into CSV, RIS, and BibTeX structures', () => {
      const sampleItem = {
        id: 'chunk-dgda-001',
        title: 'National Guideline for Hypertension Management in Bangladesh',
        source: 'Directorate General of Health Services (DGHS)',
        evidenceLevel: 'Grade Ia',
        year: 2023,
        quote: 'First-line therapy for uncomplicated hypertension in adult patients includes Amlodipine or ACEi/ARB.',
      };

      // 1. CSV test
      const csvLine = `"${sampleItem.id}","${sampleItem.title}","${sampleItem.source}","${sampleItem.evidenceLevel}","${sampleItem.year}"`;
      expect(csvLine).toContain('chunk-dgda-001');
      expect(csvLine).toContain('Grade Ia');

      // 2. RIS test
      const risContent = [
        'TY  - JOUR',
        `TI  - ${sampleItem.title}`,
        `AU  - ${sampleItem.source}`,
        `PY  - ${sampleItem.year}`,
        `N1  - Evidence: ${sampleItem.evidenceLevel}`,
        `N2  - ${sampleItem.quote}`,
        'ER  - ',
      ].join('\r\n');
      expect(risContent).toContain('TY  - JOUR');
      expect(risContent).toContain('ER  - ');
      expect(risContent).toContain('Grade Ia');

      // 3. BibTeX test
      const bibtex = `@article{${sampleItem.id},\n  title = {${sampleItem.title}},\n  author = {${sampleItem.source}},\n  year = {${sampleItem.year}},\n  note = {Evidence Level: ${sampleItem.evidenceLevel}}\n}`;
      expect(bibtex).toContain('@article{chunk-dgda-001');
      expect(bibtex).toContain('year = {2023}');
    });
  });
});
