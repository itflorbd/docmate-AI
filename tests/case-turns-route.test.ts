import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://apple:@localhost:5432/docmate',
});

let testDoctorId: string;
let testCaseId: string;

// Mock requirePhysician to return the test doctor user
vi.mock('@/lib/case-access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/case-access')>();
  return {
    ...actual,
    requirePhysician: async () => ({
      id: testDoctorId,
      email: 'doctor-turns-test@docmate.ai',
      role: 'doctor',
      name: 'Dr. Test Assistant',
      status: 'active',
    }),
  };
});

describe('Case Turns Route Hotfixes & Integration (Phases 1 & Regression)', () => {
  let POST: typeof import('@/app/api/cases/[id]/turns/route').POST;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      // 1. Create or get test doctor
      const dRes = await client.query(
        "SELECT id FROM users WHERE email = 'doctor-turns-test@docmate.ai'"
      );
      if (dRes.rows.length > 0) {
        testDoctorId = dRes.rows[0].id;
      } else {
        const insDoc = await client.query(
          `INSERT INTO users (email, role, name, status, password_hash)
           VALUES ('doctor-turns-test@docmate.ai', 'doctor', 'Dr. Test Assistant', 'active', 'hash123')
           RETURNING id`
        );
        testDoctorId = insDoc.rows[0].id;
      }

      // 2. Create test case
      const cRes = await client.query(
        `INSERT INTO cases (doctor_id, patient_code, status, structured_input)
         VALUES ($1, 'P-TURNS-101', 'draft', $2)
         RETURNING id`,
        [
          testDoctorId,
          JSON.stringify({
            age: 45,
            gender: 'female',
            chief_complaint: 'fever and cough for 4 days',
            symptoms: ['fever', 'cough'],
            past_medical_history: [],
            current_medicines: [],
            allergies: [],
            vitals: {},
          }),
        ]
      );
      testCaseId = cRes.rows[0].id;
    } finally {
      client.release();
    }

    // Dynamically import the route handler after mocks are set
    const mod = await import('@/app/api/cases/[id]/turns/route');
    POST = mod.POST;
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      if (testCaseId) {
        await client.query('DELETE FROM case_turns WHERE case_id = $1', [testCaseId]);
        await client.query('DELETE FROM audit_logs WHERE case_id = $1', [testCaseId]);
        await client.query('DELETE FROM cases WHERE id = $1', [testCaseId]);
      }
      if (testDoctorId) {
        await client.query("DELETE FROM users WHERE email = 'doctor-turns-test@docmate.ai'");
      }
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('1. Triggers critical safety alert for Bangla red flag: বুকে তীব্র ব্যথা', async () => {
    const req = new Request(`http://localhost:3000/api/cases/${testCaseId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'রোগীর বুকে তীব্র ব্যথা হচ্ছে',
        locale: 'bn',
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: testCaseId }) });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.assistantTurn).toBeDefined();
    const alerts = data.assistantTurn.content.safety_alerts;
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('জরুরি কার্ডিয়াক রেড ফ্ল্যাগ');
  });

  it('2. Does NOT trigger safety alert when red flag is negated: বুকে তীব্র ব্যথা নেই', async () => {
    const req = new Request(`http://localhost:3000/api/cases/${testCaseId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'রোগীর বুকে তীব্র ব্যথা নেই, শুধু সাধারণ সর্দি',
        locale: 'bn',
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: testCaseId }) });
    const data = await res.json();

    expect(data.success).toBe(true);
    const alerts = data.assistantTurn.content.safety_alerts;
    expect(alerts).toHaveLength(0);
  });

  it('3. Answers follow-up question, extracts vitals facts, and returns an assistant turn (No Dead End)', async () => {
    const req = new Request(`http://localhost:3000/api/cases/${testCaseId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'question_answer',
        question_id: 'vitals-followup',
        question: 'রোগীর রক্তচাপ ও পালস কত?',
        answer: 'বিপি ১২০/৮০, পালস ৭৬',
        locale: 'bn',
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: testCaseId }) });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    // Doctor turn recorded
    expect(data.turn).toBeDefined();
    expect(data.turn.content.type).toBe('question_answer');

    // Assistant turn MUST be returned (NOT null)
    expect(data.assistantTurn).toBeDefined();
    expect(data.assistantTurn.role).toBe('system');
    expect(data.assistantTurn.content.status).toBe('analyzed');

    // Proposed updates must have extracted BP and HR
    const updates = data.assistantTurn.content.proposed_updates;
    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(updates.some((u: { field_path: string }) => u.field_path === 'vitals.blood_pressure')).toBe(true);
    expect(updates.some((u: { field_path: string }) => u.field_path === 'vitals.heart_rate')).toBe(true);
  });

  it('4. Multi-turn memory: suppresses answered vitals-followup on subsequent turns', async () => {
    const req = new Request(`http://localhost:3000/api/cases/${testCaseId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'কাশির সাথে সামান্য হলুদ শ্লেষ্মা আসছে',
        locale: 'bn',
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: testCaseId }) });
    const data = await res.json();

    expect(data.success).toBe(true);
    const followUps = data.assistantTurn.content.follow_ups;
    // Follow-ups must NOT include vitals-followup because it was already answered!
    expect(followUps.some((f: { id: string }) => f.id === 'vitals-followup')).toBe(false);
    // At most 1 smart follow-up
    expect(followUps.length).toBeLessThanOrEqual(1);
  });

  it('5. Stores real status instead of hardcoding insufficient_evidence', async () => {
    const req = new Request(`http://localhost:3000/api/cases/${testCaseId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'রোগীর জ্বর ও কাশি রয়েছে, তাপমাত্রা ৩৮.৫ ডিগ্রি',
        locale: 'bn',
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: testCaseId }) });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.assistantTurn.content.status).toBe('analyzed');
    expect(data.assistantTurn.content.status).not.toBe('insufficient_evidence');
  });
});
