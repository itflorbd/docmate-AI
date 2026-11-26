import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { caseVersion, mergeUrgentFindings, type FindingResolution, type UrgentFinding } from '@/lib/case-urgency';
import type { StructuredPatientInput } from '@/types';

// Synthetic fixtures. The chest-pain text mirrors seeded case P-102.
const chestPain: Partial<StructuredPatientInput> = {
  age: 58,
  gender: 'male',
  chief_complaint: 'Severe substernal crushing chest pain radiating to left arm and jaw with diaphoresis for 2 hours',
  symptoms: ['Substernal chest pain', 'Diaphoresis'],
};
const mild: Partial<StructuredPatientInput> = { age: 30, gender: 'female', chief_complaint: 'Mild headache for 2 days', symptoms: ['Headache'] };

const resolution = (input: Partial<StructuredPatientInput>): FindingResolution => ({
  by: 'doc-1',
  basis: 'investigation',
  rationale: 'Serial ECG and troponin normal, reviewed with senior',
  at: new Date().toISOString(),
  case_version: caseVersion(input),
});

describe('urgent findings (pure)', () => {
  it('detects a rule finding with its source', () => {
    const findings = mergeUrgentFindings({ input: chestPain, previous: [], priorStatus: 'draft', resolutions: new Map(), round: 1 });
    expect(findings.map((f) => [f.id, f.status, f.source])).toEqual([['rule:acute-coronary', 'active', 'rule:acute-coronary']]);
  });

  it('keeps an earlier finding active even when the new round no longer detects it', () => {
    const previous = mergeUrgentFindings({ input: chestPain, previous: [], priorStatus: 'draft', resolutions: new Map(), round: 1 });
    const next = mergeUrgentFindings({ input: mild, previous, priorStatus: 'red_flag', resolutions: new Map(), round: 2 });
    expect(next.find((f) => f.id === 'rule:acute-coronary')?.status).toBe('active');
    expect(next.find((f) => f.id === 'rule:acute-coronary')?.first_detected_round).toBe(1);
  });

  it('carries over a case already marked urgent with no saved findings', () => {
    const findings = mergeUrgentFindings({ input: mild, previous: [], priorStatus: 'red_flag', resolutions: new Map(), round: 1 });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ id: 'prior-red-flag', status: 'active', source: 'prior_case_status' });
  });

  it('resolves a finding only through a clinician resolution, and keeps it resolved on reanalysis', () => {
    const previous = mergeUrgentFindings({ input: chestPain, previous: [], priorStatus: 'draft', resolutions: new Map(), round: 1 });
    const resolutions = new Map([['rule:acute-coronary', resolution(chestPain)]]);
    const resolved = mergeUrgentFindings({ input: chestPain, previous, priorStatus: 'red_flag', resolutions, round: 2 });
    expect(resolved[0].status).toBe('resolved');
    expect(resolved[0].resolution?.basis).toBe('investigation');
    const again = mergeUrgentFindings({ input: chestPain, previous: resolved, priorStatus: 'insufficient_evidence', resolutions: new Map(), round: 3 });
    expect(again[0].status).toBe('resolved');
  });

  it('re-raises a resolved finding when the record changes and the rule still fires', () => {
    const previous: UrgentFinding[] = mergeUrgentFindings({ input: chestPain, previous: [], priorStatus: 'draft', resolutions: new Map(), round: 1 });
    const resolutions = new Map([['rule:acute-coronary', resolution(chestPain)]]);
    const changed = { ...chestPain, symptoms: [...(chestPain.symptoms ?? []), 'Syncope'] };
    const findings = mergeUrgentFindings({ input: changed, previous, priorStatus: 'insufficient_evidence', resolutions, round: 2 });
    expect(findings[0]).toMatchObject({ status: 'active', reraised: true });
  });

  it('ignores negated mentions', () => {
    const findings = mergeUrgentFindings({
      input: { chief_complaint: 'No chest pain, no shortness of breath', symptoms: [] },
      previous: [],
      priorStatus: 'draft',
      resolutions: new Map(),
      round: 1,
    });
    expect(findings).toEqual([]);
  });
});

// Route-level checks against the database in DATABASE_URL (use a disposable database).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let doctorId = '';
let caseId = '';

vi.mock('@/lib/case-access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/case-access')>();
  return { ...actual, requirePhysician: async () => ({ id: doctorId, role: 'doctor', status: 'active', email: 'urgency-test@docmate.ai' }) };
});
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, getCurrentUser: async () => ({ id: doctorId, role: 'doctor', status: 'active', email: 'urgency-test@docmate.ai' }) };
});

describe('urgent findings through the case routes', () => {
  beforeAll(async () => {
    const doctor = await pool.query(
      `INSERT INTO users (email, role, name, status, password_hash) VALUES ('urgency-test@docmate.ai', 'doctor', 'Dr. Urgency Test', 'active', 'x')
       ON CONFLICT (email) DO UPDATE SET status = 'active' RETURNING id`,
    );
    doctorId = doctor.rows[0].id;
    const created = await pool.query(
      `INSERT INTO cases (doctor_id, patient_code, status, structured_input) VALUES ($1, 'P-URG-102', 'red_flag', $2) RETURNING id`,
      [doctorId, JSON.stringify({ ...chestPain, past_medical_history: [], current_medicines: [], allergies: [], vitals: {}, lab_values: [] })],
    );
    caseId = created.rows[0].id;
  });

  // The synthetic case is kept: deleting it would null case_id on hashed audit
  // rows (ON DELETE SET NULL) and break audit-chain verification.
  afterAll(async () => {
    await pool.end();
  });

  const analyze = async () => {
    const { POST } = await import('@/app/api/cases/[id]/analyze/route');
    const res = await POST(new Request('http://test/api', { method: 'POST', body: JSON.stringify({ locale: 'en' }) }), { params: Promise.resolve({ id: caseId }) });
    return { status: res.status, body: await res.json() };
  };

  it('keeps the red flag through reanalysis while reporting insufficient evidence', async () => {
    for (let round = 0; round < 2; round++) {
      const { status, body } = await analyze();
      expect(status).toBe(200);
      expect(body.analysis.status).toBe('insufficient_evidence');
      expect(body.analysis.urgency).toBe('urgent');
      expect(body.analysis.missing_information.length).toBeGreaterThan(0);
      expect(body.analysis.red_flags.length).toBeGreaterThan(0);
      expect(body.case.status).toBe('red_flag');
    }
  });

  it('keeps the case urgent when a working diagnosis is confirmed', async () => {
    const { PATCH } = await import('@/app/api/cases/[id]/route');
    const res = await PATCH(new Request('http://test/api', { method: 'PATCH', body: JSON.stringify({ confirmedDiagnosis: 'Suspected ACS' }) }), { params: Promise.resolve({ id: caseId }) });
    expect((await res.json()).case.status).toBe('red_flag');
  });

  it('rejects a resolution without a rationale, then records an audited one', async () => {
    const { POST } = await import('@/app/api/cases/[id]/urgent-findings/resolve/route');
    const call = (body: unknown) => POST(new Request('http://test/api', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: caseId }) });

    expect((await call({ finding_id: 'rule:acute-coronary', basis: 'investigation', rationale: 'ok' })).status).toBe(400);
    const res = await call({ finding_id: 'rule:acute-coronary', basis: 'investigation', rationale: 'Serial ECG and hs-troponin normal at 0 and 3 hours' });
    expect(res.status).toBe(200);

    const audit = await pool.query(`SELECT user_id, payload FROM audit_logs WHERE case_id = $1 AND event = 'URGENT_FINDING_RESOLVED'`, [caseId]);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].user_id).toBe(doctorId);
    expect(audit.rows[0].payload).toMatchObject({ finding_id: 'rule:acute-coronary', basis: 'investigation', finding_source: 'rule:acute-coronary' });
    expect(audit.rows[0].payload.case_version).toHaveLength(64);

    const { body } = await analyze();
    expect(body.analysis.urgency).toBe('none');
    expect(body.analysis.urgent_findings[0].status).toBe('resolved');
    expect(body.case.status).toBe('insufficient_evidence');
  });

  it('re-raises the finding after the record changes', async () => {
    await pool.query(`UPDATE cases SET structured_input = jsonb_set(structured_input, '{symptoms}', '["Substernal chest pain","Diaphoresis","Syncope"]') WHERE id = $1`, [caseId]);
    const { body } = await analyze();
    expect(body.analysis.urgency).toBe('urgent');
    expect(body.analysis.urgent_findings[0]).toMatchObject({ status: 'active', reraised: true });
  });
});
