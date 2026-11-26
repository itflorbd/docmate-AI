// Doctor treatment workflow against an isolated server and disposable database.
//
//   DATABASE_URL=postgresql://.../docmate_treatment DOCMATE_QA_BASE_URL=http://127.0.0.1:3130 \
//     npx playwright test e2e/treatment-safety.spec.ts
//
// Every fixture is synthetic. Expected outcomes were written by the engineer
// from the fixture design and the AGENTS.md rules; no clinician has reviewed them.

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

const OUT = path.join(process.cwd(), 'output', 'patient-qa', 'treatment');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const results: Record<string, unknown>[] = [];
let doctorId = '';

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

async function login(request: APIRequestContext) {
  const res = await request.post('/api/auth/login', { data: { email: 'doctor@docmate.ai', password: 'demo123' } });
  expect(res.ok()).toBeTruthy();
}

// Unique per run. Cases are never deleted: deleting one nulls case_id on hashed audit rows.
const RUN = Date.now().toString(36).toUpperCase();

async function createCase(code: string, input: Record<string, unknown>, status = 'draft') {
  const base = { past_medical_history: [], current_medicines: [], vitals: {}, lab_values: [], symptoms: [] };
  const { rows } = await pool.query(
    `INSERT INTO cases (doctor_id, patient_code, status, structured_input) VALUES ($1, $2, $3, $4) RETURNING id`,
    [doctorId, `${code}-${RUN}`, status, JSON.stringify({ ...base, ...input })],
  );
  return rows[0].id as string;
}

async function setDiagnosis(request: APIRequestContext, caseId: string, diagnosis: string) {
  const res = await request.patch(`/api/cases/${caseId}`, { data: { confirmedDiagnosis: diagnosis } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).case.status as string;
}

async function guidelineOnly(chunkIds: string[]) {
  if (chunkIds.length === 0) return true;
  const { rows } = await pool.query(
    `SELECT bool_and(s.source_type = 'guideline' AND s.lifecycle = 'published') AS ok FROM chunks c JOIN sources s ON s.id = c.source_id WHERE c.id = ANY($1)`,
    [chunkIds],
  );
  return rows[0].ok === true;
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

test.beforeAll(async () => {
  const { rows } = await pool.query(`SELECT id FROM users WHERE email = 'doctor@docmate.ai'`);
  doctorId = rows[0].id;
});

test.afterAll(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  await pool.end();
});

test('F1 eligible case: draft, evidence, approval and report preview', async ({ page }) => {
  await login(page.request);
  const caseId = await createCase('QA-T1', {
    age: 45,
    gender: 'male',
    chief_complaint: 'Fever and productive cough for 4 days',
    symptoms: ['Fever', 'Productive cough'],
    allergies: ['No known allergies'],
  });
  await setDiagnosis(page.request, caseId, 'Community-acquired pneumonia');

  await page.goto(`/en/cases/${caseId}?tab=treatment`);
  await page.getByRole('button', { name: 'Build draft' }).click();
  const draft = page.getByTestId('treatment-draft');
  await expect(draft).toHaveAttribute('data-status', 'proposed');
  const amox = page.getByTestId('draft-option').filter({ hasText: 'Amoxicillin' });
  await expect(amox).toHaveAttribute('data-safety', 'clear');
  await expect(amox.getByTestId('option-citation')).toContainText('recommended first-line therapy');
  await shot(page, 'F1-treatment-draft');

  // Server draft for the record, compared with what the page shows.
  const api = await (await page.request.post(`/api/cases/${caseId}/treatment`)).json();
  const uiSafety = await page.getByTestId('draft-option').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-safety')));
  const serverSafety = api.draft.options.map((option: { safety: { status: string } }) => option.safety.status);

  // Evidence sheet from the citation chip.
  await amox.getByTestId('option-citation').getByRole('button').first().click();
  await page.waitForTimeout(800);
  await shot(page, 'F1-evidence-sheet');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Approve plan' }).click();
  await expect(page.getByTestId('treatment-draft').getByText('Plan approved')).toBeVisible();
  await page.getByRole('button', { name: 'Open report' }).click();
  const report = page.getByTestId('report-preview');
  await expect(report).toContainText('Draft — not a prescription');
  await expect(page.getByTestId('report-plan')).toContainText('Amoxicillin');
  await expect(page.getByRole('button', { name: 'Print preview' })).toBeDisabled();
  await shot(page, 'F1-report-preview');

  const finalize = await page.request.post(`/api/cases/${caseId}/finalize`);
  const chunkIds = api.draft.options.map((option: { citation: { chunk_id: string } }) => option.citation.chunk_id);
  results.push({
    fixture: 'F1 eligible pneumonia, no known allergies',
    expected: 'Draft proposes amoxicillin with a verified guideline quote, safety clear, approval saved, report is a draft, official issuance blocked (423).',
    observed: `draft=${api.draft.status}; options=${api.draft.options.map((o: { generic_name: string }) => o.generic_name).join(', ')}; ui safety=${uiSafety.join(',')}; server safety=${serverSafety.join(',')}; finalize=${finalize.status()}`,
    plan: api.draft.status === 'proposed',
    citations_guideline_only: await guidelineOnly(chunkIds),
    ui_matches_server: JSON.stringify(uiSafety) === JSON.stringify(serverSafety),
    issuance_blocked: finalize.status() === 423,
    match: api.draft.status === 'proposed' && finalize.status() === 423 && JSON.stringify(uiSafety) === JSON.stringify(serverSafety),
  });
});

test('F2 incomplete case: abstains with specific questions', async ({ page }) => {
  await login(page.request);
  const caseId = await createCase('QA-T2', { age: 30, gender: 'female', chief_complaint: 'Cough for 5 days', allergies: [] });
  await setDiagnosis(page.request, caseId, 'Community-acquired pneumonia');
  await page.goto(`/en/cases/${caseId}?tab=treatment`);
  await page.getByRole('button', { name: 'Build draft' }).click();
  await expect(page.getByTestId('treatment-draft')).toHaveAttribute('data-status', 'insufficient_evidence');
  await expect(page.getByTestId('draft-follow-up')).toContainText('drug allergies');
  await expect(page.getByTestId('draft-follow-up')).toContainText('pregnant');
  await shot(page, 'F2-insufficient-evidence');
  const api = await (await page.request.post(`/api/cases/${caseId}/treatment`)).json();
  results.push({
    fixture: 'F2 incomplete: allergy and pregnancy status not recorded',
    expected: 'insufficient_evidence with questions about allergies and pregnancy; no approvable option.',
    observed: `draft=${api.draft.status}; missing=${api.draft.missing_information.join(',')}`,
    abstained: api.draft.status === 'insufficient_evidence',
    match: api.draft.status === 'insufficient_evidence' && api.draft.missing_information.includes('allergy_status') && api.draft.missing_information.includes('pregnancy_status'),
  });
});

test('F3 urgent case: red flag survives reanalysis, blocks treatment, audited resolution', async ({ page }) => {
  await login(page.request);
  const caseId = await createCase(
    'QA-T3',
    {
      age: 58,
      gender: 'male',
      chief_complaint: 'Severe substernal crushing chest pain radiating to left arm and jaw with diaphoresis for 2 hours',
      symptoms: ['Substernal chest pain', 'Diaphoresis'],
      allergies: ['No known allergies'],
    },
    'red_flag',
  );
  const first = await (await page.request.post(`/api/cases/${caseId}/analyze`, { data: { locale: 'en' } })).json();
  const second = await (await page.request.post(`/api/cases/${caseId}/analyze`, { data: { locale: 'en' } })).json();
  const statusAfterDx = await setDiagnosis(page.request, caseId, 'Acute coronary syndrome');
  const blockedDraft = await (await page.request.post(`/api/cases/${caseId}/treatment`)).json();

  await page.goto(`/en/cases/${caseId}?tab=treatment`);
  const banner = page.getByTestId('urgent-findings');
  await expect(banner).toBeVisible();
  await page.getByRole('button', { name: 'Build draft' }).click();
  await expect(page.getByTestId('treatment-draft')).toHaveAttribute('data-status', 'urgent_review_required');
  await shot(page, 'F3-urgent-warning');

  await banner.getByRole('button', { name: 'Record decision' }).click();
  await page.getByText('Tests ruled it out').click();
  await page.getByLabel('Reason').fill('Serial ECG and hs-troponin normal at 0 and 3 hours');
  await shot(page, 'F3-resolve-dialog');
  await page.getByRole('button', { name: 'Save decision' }).click();
  await expect(banner).toBeHidden();
  const audit = await pool.query(`SELECT user_id, payload FROM audit_logs WHERE case_id = $1 AND event = 'URGENT_FINDING_RESOLVED'`, [caseId]);
  const third = await (await page.request.post(`/api/cases/${caseId}/analyze`, { data: { locale: 'en' } })).json();

  results.push({
    fixture: 'F3 urgent chest pain (mirrors P-102)',
    expected: 'Both analyses: insufficient_evidence + urgency urgent + red flag listed; case stays red_flag after diagnosis; draft refused; resolution audited with doctor, basis and rationale; urgency cleared afterwards.',
    observed: `round1=${first.analysis.status}/${first.analysis.urgency}/${first.analysis.red_flags.length} flags; round2=${second.analysis.status}/${second.analysis.urgency}; status after dx=${statusAfterDx}; draft=${blockedDraft.draft.status}; audit rows=${audit.rowCount}; after resolution=${third.analysis.urgency}/${third.case.status}`,
    red_flag_preserved: second.analysis.urgency === 'urgent' && second.analysis.red_flags.length > 0 && statusAfterDx === 'red_flag',
    match:
      first.analysis.status === 'insufficient_evidence' &&
      second.analysis.urgency === 'urgent' &&
      statusAfterDx === 'red_flag' &&
      blockedDraft.draft.status === 'urgent_review_required' &&
      audit.rowCount === 1 &&
      audit.rows[0].user_id === doctorId &&
      third.analysis.urgency === 'none',
  });
});

test('F4 contraindicated regimen: allergy hard stop shown and refused by the server', async ({ page }) => {
  await login(page.request);
  const caseId = await createCase('QA-T4', { age: 40, gender: 'male', chief_complaint: 'Fever and cough', allergies: ['Penicillin (anaphylaxis)'] });
  await setDiagnosis(page.request, caseId, 'Community-acquired pneumonia');
  await page.goto(`/en/cases/${caseId}?tab=treatment`);
  await page.getByRole('button', { name: 'Build draft' }).click();
  const amox = page.getByTestId('draft-option').filter({ hasText: 'Amoxicillin' });
  await expect(amox).toHaveAttribute('data-safety', 'blocked');
  await expect(amox.getByRole('checkbox')).toBeDisabled();
  await amox.scrollIntoViewIfNeeded();
  await shot(page, 'F4-safety-stop');

  const api = await (await page.request.post(`/api/cases/${caseId}/treatment`)).json();
  const amoxId = api.draft.options.find((o: { generic_name: string }) => o.generic_name === 'Amoxicillin').drug_id;
  const refused = await page.request.post(`/api/cases/${caseId}/treatment/approve`, { data: { approved_drug_ids: [amoxId], case_version: api.case_version } });
  results.push({
    fixture: 'F4 pneumonia with penicillin anaphylaxis',
    expected: 'Amoxicillin shown as a safety stop and refused by the server (422); non-beta-lactam options offered.',
    observed: `options=${api.draft.options.map((o: { generic_name: string; safety: { status: string } }) => `${o.generic_name}:${o.safety.status}`).join(', ')}; approve amoxicillin=${refused.status()}`,
    safety_enforced: refused.status() === 422,
    match: refused.status() === 422,
  });
});

test('F5 unrelated retrieval: no guideline, no plan, no record cited', async ({ page }) => {
  await login(page.request);
  const caseId = await createCase('QA-T5', { age: 35, gender: 'male', chief_complaint: 'Headache', allergies: ['No known allergies'] });
  await setDiagnosis(page.request, caseId, 'Migraine');
  const api = await (await page.request.post(`/api/cases/${caseId}/treatment`)).json();
  // The demo library holds synthetic records that mention medicines; none may be cited.
  const demoMentions = await pool.query(
    `SELECT count(*)::int AS n FROM chunks c JOIN sources s ON s.id = c.source_id WHERE s.title = 'Demo resource library' AND c.text ~* '(paracetamol|amoxicillin|aspirin)'`,
  );
  await page.goto(`/en/cases/${caseId}?tab=treatment`);
  await page.getByRole('button', { name: 'Build draft' }).click();
  await expect(page.getByTestId('treatment-draft')).toHaveAttribute('data-status', 'insufficient_evidence');
  await shot(page, 'F5-no-guideline');
  results.push({
    fixture: 'F5 diagnosis with no guideline in the library (migraine)',
    expected: 'insufficient_evidence with a question; zero options; no demo-record citation.',
    observed: `draft=${api.draft.status}; options=${api.draft.options.length}; demo-library chunks naming a medicine=${demoMentions.rows[0].n}`,
    abstained: api.draft.status === 'insufficient_evidence',
    match: api.draft.status === 'insufficient_evidence' && api.draft.options.length === 0,
  });
});

test('F6 manual prescription: blocked before issuance, browser matches server', async ({ page }) => {
  await login(page.request);
  const create = async (name: string, allergies: string[]) => {
    const res = await page.request.post('/api/patients', {
      data: { name, age: 40, gender: 'male', consentObtained: true, chiefComplaint: 'Fever', allergies },
    });
    expect(res.status()).toBe(201);
    return res.json();
  };
  const allergic = await create('QA Synthetic Allergic', ['Penicillin']);
  const clear = await create('QA Synthetic Clear', ['No known allergies']);
  const item = (genericName: string) => ({ brandName: genericName, genericName, strength: '500 mg', form: 'Tab', dosingSchedule: '1+1+1', durationDays: 5 });

  const direct = await page.request.post('/api/prescriptions', { data: { patientId: clear.patient.id, encounterId: clear.encounter.id, status: 'finalized', items: [item('Paracetamol')] } });

  const blockedRx = await (await page.request.post('/api/prescriptions', { data: { patientId: allergic.patient.id, encounterId: allergic.encounter.id, items: [item('Amoxicillin')] } })).json();
  const blockedCheck = await (await page.request.post(`/api/prescriptions/${blockedRx.prescription.id}/safety-check`, { data: {} })).json();
  const blockedFinal = await page.request.post(`/api/prescriptions/${blockedRx.prescription.id}/finalize`, {
    data: { regimen_hash: blockedCheck.regimen_hash, context_version: blockedCheck.context_version },
  });

  const clearRx = await (await page.request.post('/api/prescriptions', { data: { patientId: clear.patient.id, encounterId: clear.encounter.id, items: [item('Paracetamol')] } })).json();
  const clearCheck = await (await page.request.post(`/api/prescriptions/${clearRx.prescription.id}/safety-check`, { data: {} })).json();
  const stale = await page.request.post(`/api/prescriptions/${clearRx.prescription.id}/finalize`, { data: { regimen_hash: 'a'.repeat(64), context_version: clearCheck.context_version } });
  const gated = await page.request.post(`/api/prescriptions/${clearRx.prescription.id}/finalize`, {
    data: { regimen_hash: clearCheck.regimen_hash, context_version: clearCheck.context_version },
  });
  const stored = await pool.query(`SELECT status FROM prescriptions WHERE id = ANY($1)`, [[blockedRx.prescription.id, clearRx.prescription.id]]);

  // Browser: the editor shows the server's decision. This patient has no allergy record,
  // so the default paracetamol draft must be blocked for missing allergy status.
  const unknown = await create('QA Synthetic Unknown', []);
  await page.goto(`/en/prescriptions/new?patientId=${unknown.patient.id}`);
  await expect(page.locator(`select:has(option[value="${unknown.patient.id}"])`)).toHaveValue(unknown.patient.id);
  await page.getByRole('button', { name: 'Check safety' }).click();
  const panel = page.getByTestId('safety-result');
  await expect(panel).toBeVisible();
  const uiStatus = await panel.getAttribute('data-status');
  await panel.scrollIntoViewIfNeeded();
  await shot(page, 'F6-editor-safety');
  await expect(page.getByRole('button', { name: 'Finalize' })).toBeDisabled();
  // The draft the editor just saved, checked through the API.
  const latest = await pool.query(`SELECT id FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1`, [unknown.patient.id]);
  const serverStatus = (await (await page.request.post(`/api/prescriptions/${latest.rows[0].id}/safety-check`, { data: {} })).json()).status;

  results.push({
    fixture: 'F6 manual prescription issuance paths',
    expected: 'create-as-finalized refused (422); allergy draft blocked (422); stale review refused (409); clean draft stops at release gate (423); nothing stored as finalized; editor shows the server status.',
    observed: `direct finalized=${direct.status()}; allergy check=${blockedCheck.status}, finalize=${blockedFinal.status()}; stale=${stale.status()}; clean check=${clearCheck.status}, finalize=${gated.status()}; stored=${stored.rows.map((r) => r.status).join(',')}; editor=${uiStatus} server=${serverStatus}`,
    safety_enforced: blockedFinal.status() === 422,
    issuance_blocked: direct.status() === 422 && gated.status() === 423 && stored.rows.every((r) => r.status === 'draft'),
    ui_matches_server: uiStatus === serverStatus,
    match:
      direct.status() === 422 &&
      blockedCheck.status === 'blocked' &&
      blockedFinal.status() === 422 &&
      stale.status() === 409 &&
      clearCheck.status === 'clear' &&
      gated.status() === 423 &&
      stored.rows.every((r) => r.status === 'draft') &&
      uiStatus === serverStatus,
  });
});
