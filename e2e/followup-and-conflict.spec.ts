// Judges' challenges 1 and 2 in Chromium, Bangla and English, on one build.
//
// 1. Start a follow-up from Visit 1, reconcile a changed medicine, add a new
//    measurement, confirm the diagnosis; Visit 1 stays unchanged, a repeat
//    submission returns the same visit, and history the doctor cannot see is left out.
// 2. Two SYNTHETIC guideline PDFs disagree about Metformin for adult outpatients
//    with type 2 diabetes. Both passages open from their citations, Metformin
//    stays unselected, and the review decision is audited. Controls: a different
//    population, a single source, and an altered quote.
//
// Needs: DOCMATE_DEMO_MODE=true on the server, the three synthetic PDFs from
// e2e/fixtures/make-guideline-pdfs.mjs ingested, and DATABASE_URL for fixtures.
//   DATABASE_URL=... DOCMATE_QA_BASE_URL=http://127.0.0.1:3160 npx playwright test e2e/followup-and-conflict.spec.ts
// All patients, doctors and guidelines here are synthetic.

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

const bn = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages', 'bn.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages', 'en.json'), 'utf8'));
const OUT = path.join(process.cwd(), 'output', 'patient-qa', 'judges-challenges');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const results: Record<string, unknown> = {};
const GUIDE_A = 'SYNTHETIC TEST Guideline A - Type 2 Diabetes Initial Therapy (2025)';
const GUIDE_B = 'SYNTHETIC TEST Guideline B - Type 2 Diabetes Lifestyle First (2026)';
const GUIDE_C = 'SYNTHETIC TEST Guideline C - Paediatric Type 2 Diabetes (2026)';

async function lifecycle(title: string, value: 'published' | 'retired') {
  await pool.query(`UPDATE sources SET lifecycle = $2 WHERE title = $1`, [title, value]);
}

async function login(request: APIRequestContext) {
  const res = await request.post('/api/auth/login', { data: { email: 'doctor@docmate.ai', password: 'demo123' } });
  expect(res.ok()).toBeTruthy();
}

/** Synthetic patient with Visit 1 by this doctor and an earlier visit by another doctor the patient did not share. */
async function seedPatient(locale: 'bn' | 'en') {
  const stamp = `${locale}${Date.now().toString(36)}`;
  const { rows: [doctor] } = await pool.query(`SELECT id FROM users WHERE email = 'doctor@docmate.ai'`);
  const { rows: [other] } = await pool.query(
    `INSERT INTO users (email, password_hash, role, name) VALUES ($1, 'x', 'doctor', 'Dr. Other (synthetic)') RETURNING id`,
    [`other-${stamp}@test.local`],
  );
  const phone = `+88019${String(Date.now()).slice(-8)}`;
  const { rows: [account] } = await pool.query(`INSERT INTO patient_accounts (phone, phone_normalized) VALUES ($1, $1) RETURNING id`, [phone]);
  const { rows: [profile] } = await pool.query(
    `INSERT INTO patient_profiles (account_id, name, age, gender) VALUES ($1, $2, 52, 'female') RETURNING id`,
    [account.id, `Synthetic FU ${stamp}`],
  );
  await pool.query(`INSERT INTO access_grants (profile_id, doctor_id, scope, status) VALUES ($1, $2, 'this_doctor_only', 'active')`, [profile.id, doctor.id]);
  await pool.query(
    `INSERT INTO cases (doctor_id, profile_id, patient_code, status, structured_input, created_at) VALUES ($1, $2, $3, 'confirmed', $4, now() - interval '120 days')`,
    [other.id, profile.id, `P-FU0-${stamp}`, JSON.stringify({ age: 52, gender: 'female', chief_complaint: 'Hidden visit', symptoms: [], past_medical_history: [], current_medicines: ['Hidden medicine 5 mg'], allergies: ['Hidden allergy'], vitals: {}, lab_values: [] })],
  );
  const visit1Input = {
    age: 52,
    gender: 'female',
    chief_complaint: locale === 'bn' ? 'বেশি পিপাসা' : 'Increased thirst',
    symptoms: [],
    past_medical_history: [],
    current_medicines: ['Metformin 500 mg twice daily'],
    allergies: ['Sulfonamide rash'],
    vitals: { blood_pressure_systolic: 150, blood_pressure_diastolic: 95, heart_rate: 82 },
    weight_kg: 74,
    lab_values: [{ name: 'HbA1c', value: 7.9, unit: '%' }],
  };
  const { rows: [visit1] } = await pool.query(
    `INSERT INTO cases (doctor_id, profile_id, patient_code, status, confirmed_diagnosis, structured_input, created_at)
     VALUES ($1, $2, $3, 'confirmed', 'Type 2 diabetes mellitus', $4, now() - interval '30 days') RETURNING id`,
    [doctor.id, profile.id, `P-FU1-${stamp}`, JSON.stringify(visit1Input)],
  );
  await pool.query(
    `INSERT INTO analyses (case_id, round, output, model) VALUES ($1, 1, $2, 'docmate-abstention-v1')`,
    [visit1.id, JSON.stringify({ status: 'insufficient_evidence', summary: '', red_flags: [], differentials: [], missing_information: [{ id: 'eye', text: 'Has the patient had an eye examination?', type: 'question', why_it_helps: '', which_diagnoses_it_separates: [] }], confidence: { label: 'insufficient', score: 0, reasoning: '' } })],
  );
  return { profileId: profile.id as string, visit1: visit1.id as string };
}

async function visitRow(id: string) {
  const { rows } = await pool.query(`SELECT patient_code, status, confirmed_diagnosis, structured_input, updated_at FROM cases WHERE id = $1`, [id]);
  return JSON.stringify(rows[0]);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

test.beforeAll(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await lifecycle(GUIDE_A, 'published');
  await lifecycle(GUIDE_B, 'published');
  await lifecycle(GUIDE_C, 'retired');
});

test.afterAll(async () => {
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  await lifecycle(GUIDE_C, 'retired');
  await lifecycle(GUIDE_B, 'published');
  await pool.end();
});

for (const locale of ['bn', 'en'] as const) {
  const m = locale === 'bn' ? bn : en;
  test(`follow-up and guideline conflict (${locale})`, async ({ page }) => {
    await login(page.request);
    const { profileId, visit1 } = await seedPatient(locale);
    const visit1Before = await visitRow(visit1);
    const record: Record<string, unknown> = {};

    // --- Challenge 1: previous visit in the timeline, then the carry-forward preview.
    await page.goto(`/${locale}/patients/${profileId}`);
    await expect(page.getByTestId('timeline-start-follow-up').first()).toBeVisible({ timeout: 60_000 });
    await shot(page, `${locale}-01-previous-visit-timeline`);
    await page.getByTestId('timeline-start-follow-up').first().click();
    const sheet = page.getByTestId('follow-up-sheet');
    await expect(sheet.getByTestId('carry-item').first()).toBeVisible({ timeout: 30_000 });
    await expect(sheet.getByTestId('history-excluded')).toBeVisible();
    await expect(sheet).not.toContainText('Hidden allergy');
    await expect(sheet).not.toContainText('Hidden medicine');
    await page.waitForTimeout(700); // let the sheet finish opening
    record.preview_kinds = await sheet.getByTestId('carry-item').evaluateAll((items) => items.map((item) => item.getAttribute('data-kind')));
    await shot(page, `${locale}-02-carry-forward-preview`);

    const created = page.waitForResponse((res) => res.url().includes(`/api/cases/${visit1}/follow-up`) && res.request().method() === 'POST');
    await sheet.getByTestId('create-follow-up').click();
    const createdBody = await (await created).json();
    const visit2 = createdBody.case_id as string;
    await page.waitForURL(new RegExp(`/cases/${visit2}`), { timeout: 60_000 });

    // Repeat submissions (same key and a new key) return the same visit.
    const again = await page.request.post(`/api/cases/${visit1}/follow-up`, { data: { request_key: 'repeat-key-0001' } });
    const againBody = await again.json();
    const { rows: [{ n: followUps }] } = await pool.query(`SELECT count(*)::int AS n FROM case_follow_ups WHERE previous_case_id = $1`, [visit1]);
    record.repeat_submission = { status: again.status(), same_visit: againBody.case_id === visit2, created: againBody.created, follow_up_rows: followUps };
    expect(againBody.case_id).toBe(visit2);
    expect(followUps).toBe(1);

    // Treatment waits for reconciliation.
    const early = await page.request.post(`/api/cases/${visit2}/treatment`);
    record.treatment_before_reconcile = { status: early.status(), code: (await early.json()).code };
    expect(early.status()).toBe(409);

    // --- Reconcile: confirm the allergy, change the medicine, add today's BP, confirm the diagnosis.
    const panel = page.getByTestId('carry-forward');
    await expect(panel).toHaveAttribute('data-status', 'pending', { timeout: 60_000 });
    await panel.locator('[data-item="allergy:sulfonamide-rash"]').getByRole('radio', { name: m.followUp.action.confirm }).check();
    const med = panel.locator('[data-item="medication:metformin-500-mg-twice-daily"]');
    await med.getByRole('radio', { name: m.followUp.action.changed }).check();
    await med.getByRole('textbox').fill('Metformin 1000 mg twice daily');
    await panel.getByLabel(m.followUp.complaint).fill(locale === 'bn' ? 'ডায়াবেটিস ফলো-আপ' : 'Diabetes follow-up');
    await panel.locator('#today-blood_pressure_systolic').fill('138');
    await panel.locator('#today-blood_pressure_diastolic').fill('86');
    await panel.getByRole('checkbox', { name: m.followUp.confirmDiagnosis }).check();
    await shot(page, `${locale}-03-follow-up-draft-reconcile`);
    const reconciled = page.waitForResponse((res) => res.url().includes(`/api/cases/${visit2}/carry-forward`) && res.request().method() === 'POST');
    await page.getByTestId('save-reconciliation').click();
    const reconciledBody = await (await reconciled).json();
    const input2 = reconciledBody.case.structured_input;
    record.reconciled = {
      current_medicines: input2.current_medicines,
      allergies: input2.allergies,
      vitals: input2.vitals,
      lab_values: input2.lab_values,
      historical: input2.prior_visit?.historical,
      diagnosis: reconciledBody.case.confirmed_diagnosis,
    };
    expect(input2.current_medicines).toEqual(['Metformin 1000 mg twice daily']);
    expect(input2.vitals).toEqual({ blood_pressure_systolic: 138, blood_pressure_diastolic: 86 });
    expect(input2.lab_values).toEqual([]);

    // --- Challenge 2: the treatment draft for today's diagnosis.
    const draftCard = page.getByTestId('treatment-draft');
    await expect(draftCard.getByTestId('guideline-conflict')).toBeVisible({ timeout: 60_000 });
    const conflict = draftCard.getByTestId('guideline-conflict');
    await expect(conflict).toHaveAttribute('data-kind', 'same_context');
    await expect(conflict.getByTestId('conflict-side')).toHaveCount(2);
    await expect(conflict).toContainText(GUIDE_A);
    await expect(conflict).toContainText(GUIDE_B);
    await expect(draftCard.getByTestId('history-used')).toBeVisible();
    const metformin = draftCard.locator('[data-testid="draft-option"][data-drug="Metformin"]');
    await expect(metformin).toHaveAttribute('data-disputed', 'true');
    await expect(metformin.getByRole('checkbox')).not.toBeChecked();
    await expect(metformin.getByRole('checkbox')).toBeDisabled();
    record.history_used = await draftCard.getByTestId('history-used').locator('[data-used-for]').evaluateAll((items) => items.map((item) => `${item.getAttribute('data-used-for')}: ${item.textContent}`));
    await shot(page, `${locale}-04a-history-used-in-plan`);
    await conflict.scrollIntoViewIfNeeded();
    await shot(page, `${locale}-04b-guideline-conflict`);

    // Both passages open from their citations.
    for (const [index, stance] of (['recommends', 'advises_against'] as const).entries()) {
      await conflict.locator(`[data-testid="conflict-side"][data-stance="${stance}"] button`).first().click();
      const evidence = page.getByRole('dialog').filter({ hasText: stance === 'recommends' ? 'recommended first-line therapy' : 'should not be started' });
      await expect(evidence).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(700);
      await expect(evidence).toContainText(stance === 'recommends' ? GUIDE_A : GUIDE_B);
      await shot(page, `${locale}-05-guideline-${index === 0 ? 'A' : 'B'}-passage`);
      await page.keyboard.press('Escape');
      await expect(evidence).toBeHidden();
    }

    // Approval of the disputed medicine is refused without a review.
    const draftResponse = await page.request.post(`/api/cases/${visit2}/treatment`);
    const draftJson = await draftResponse.json();
    const disputed = draftJson.draft.options.find((option: { generic_name: string }) => option.generic_name === 'Metformin');
    const refused = await page.request.post(`/api/cases/${visit2}/treatment/approve`, { data: { approved_drug_ids: [disputed.drug_id], case_version: draftJson.case_version } });
    record.approve_without_review = { status: refused.status(), code: (await refused.json()).code };
    expect(refused.status()).toBe(422);

    // The doctor asks for the missing fact, then records a reasoned decision.
    const form = conflict.getByTestId('conflict-review-form');
    await form.getByRole('radio', { name: m.guidelineConflict.decision.request_information }).check();
    await form.getByLabel(m.guidelineConflict.requestedLabel).fill(locale === 'bn' ? 'চিকিৎসার স্থান' : 'care setting');
    await form.getByLabel(m.guidelineConflict.reasoning).fill(locale === 'bn' ? 'রোগী বহির্বিভাগে কিনা নিশ্চিত হতে হবে।' : 'Need to confirm the patient is treated as an outpatient.');
    await form.getByRole('button', { name: m.guidelineConflict.save }).click();
    await expect(conflict.getByTestId('conflict-review')).toHaveAttribute('data-decision', 'request_information', { timeout: 15_000 });
    await form.getByRole('radio', { name: m.guidelineConflict.decision.use_recommendation }).check();
    await form.getByLabel(m.guidelineConflict.reasoning).fill(
      locale === 'bn' ? 'রোগী বহির্বিভাগে; আগের ভিজিটে মেটফরমিন সহ্য হয়েছে, তাই গাইডলাইন A মানছি।' : 'Outpatient; tolerated Metformin at Visit 1, so I follow Guideline A.',
    );
    await form.getByRole('button', { name: m.guidelineConflict.save }).click();
    await expect(conflict.getByTestId('conflict-review')).toHaveAttribute('data-decision', 'use_recommendation', { timeout: 15_000 });
    await expect(conflict.getByTestId('conflict-review')).not.toContainText(m.guidelineConflict.requestedLabel);
    await expect(metformin.getByRole('checkbox')).toBeEnabled();
    await expect(metformin.getByRole('checkbox')).not.toBeChecked();
    await conflict.getByTestId('conflict-review').scrollIntoViewIfNeeded();
    await shot(page, `${locale}-06-final-review-state`);

    const { rows: audits } = await pool.query(
      `SELECT event, payload->>'decision' AS decision, payload->'sides' AS sides FROM audit_logs WHERE case_id = $1 AND event IN ('TREATMENT_CONFLICT_REVIEWED', 'TREATMENT_APPROVAL_BLOCKED', 'FOLLOW_UP_STARTED', 'FOLLOW_UP_RECONCILED') ORDER BY created_at`,
      [visit2],
    );
    record.audit = audits.map((row) => ({ event: row.event, decision: row.decision, sides: row.sides?.length ?? null }));
    expect(audits.map((row) => row.event)).toEqual(['FOLLOW_UP_STARTED', 'FOLLOW_UP_RECONCILED', 'TREATMENT_APPROVAL_BLOCKED', 'TREATMENT_CONFLICT_REVIEWED', 'TREATMENT_CONFLICT_REVIEWED']);

    // Visit 1 is unchanged.
    record.visit1_unchanged = (await visitRow(visit1)) === visit1Before;
    expect(record.visit1_unchanged).toBe(true);

    // --- Controls (API, same build): different population, single source, altered quote.
    if (locale === 'en') {
      const build = async () => (await (await page.request.post(`/api/cases/${visit2}/treatment`)).json());
      await lifecycle(GUIDE_B, 'retired');
      await lifecycle(GUIDE_C, 'published');
      const population = await build();
      const populationConflict = population.draft.conflicts.find((entry: { generic_name: string }) => entry.generic_name === 'Metformin');
      const populationOption = population.draft.options.find((option: { generic_name: string }) => option.generic_name === 'Metformin');
      await lifecycle(GUIDE_C, 'retired');
      const single = await build();
      await lifecycle(GUIDE_B, 'published');
      const { rows: [bChunk] } = await pool.query(`SELECT c.id, c.text FROM chunks c JOIN sources s ON s.id = c.source_id WHERE s.title = $1`, [GUIDE_B]);
      await pool.query(`UPDATE chunks SET text = replace(text, 'should not be started at diagnosis', 'should not be started at first diagnosis') WHERE id = $1`, [bChunk.id]);
      const altered = await build();
      const alteredConflict = altered.draft.conflicts.find((entry: { generic_name: string }) => entry.generic_name === 'Metformin');
      const alteredOption = altered.draft.options.find((option: { generic_name: string }) => option.generic_name === 'Metformin');
      const alteredApprove = await page.request.post(`/api/cases/${visit2}/treatment/approve`, { data: { approved_drug_ids: [alteredOption.drug_id], case_version: altered.case_version } });
      await pool.query(`UPDATE chunks SET text = $2 WHERE id = $1`, [bChunk.id, bChunk.text]);
      const restored = await build();
      const restoredOption = restored.draft.options.find((option: { generic_name: string }) => option.generic_name === 'Metformin');

      record.controls = {
        different_population: { kind: populationConflict?.kind, blocking: populationConflict?.blocking, applicable: populationConflict?.applicable_stance, option_disputed: Boolean(populationOption?.dispute) },
        single_source: { conflicts: single.draft.conflicts.length, option_disputed: Boolean(single.draft.options.find((o: { generic_name: string }) => o.generic_name === 'Metformin')?.dispute) },
        altered_quote: {
          new_key: alteredConflict?.key !== disputed.dispute.key,
          earlier_review_applies: Boolean(altered.conflict_reviews[alteredConflict?.key]),
          approve_status: alteredApprove.status(),
          approve_code: (await alteredApprove.json()).code,
        },
        restored_quote_review_current: restored.conflict_reviews[restoredOption.dispute.key]?.current === true,
      };
      expect(populationConflict).toMatchObject({ kind: 'different_context', blocking: false, applicable_stance: 'recommends' });
      expect(single.draft.conflicts).toEqual([]);
      expect(alteredApprove.status()).toBe(422);
    }
    results[locale] = record;
  });
}
