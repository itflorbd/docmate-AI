import { test, expect, type APIRequestContext } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';

const OUT = path.join(process.cwd(), 'output', 'patient-qa', 'challenge-gaps');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function loginAs(request: APIRequestContext, email: string, password = 'demo123') {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.ok()).toBeTruthy();
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

let renalSourceAId = '';
let renalSourceBId = '';

test.beforeAll(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // Seed two temporary synthetic renal guidelines for Ciprofloxacin / UTI (retired in afterAll)
  const sA = await pool.query<{ id: string }>(
    `INSERT INTO sources (title, authors, type, source_type, year, year_verified, lifecycle, status)
     VALUES ('SYNTHETIC TEST Renal Guideline A (2025)', '[]'::jsonb, 'guideline', 'guideline', 2025, true, 'published', 'active')
     RETURNING id`,
  );
  const sB = await pool.query<{ id: string }>(
    `INSERT INTO sources (title, authors, type, source_type, year, year_verified, lifecycle, status)
     VALUES ('SYNTHETIC TEST Renal Guideline B (2026)', '[]'::jsonb, 'guideline', 'guideline', 2026, true, 'published', 'active')
     RETURNING id`,
  );
  renalSourceAId = sA.rows[0].id;
  renalSourceBId = sB.rows[0].id;
  await pool.query(
    `INSERT INTO chunks (source_id, page, section, text, evidence_level, status)
     VALUES ($1, 1, 'Renal Dosing', 'For adults with normal renal function and urinary tract infection, Ciprofloxacin is recommended as first-line therapy.', 'Ia', 'active')`,
    [renalSourceAId],
  );
  await pool.query(
    `INSERT INTO chunks (source_id, page, section, text, evidence_level, status)
     VALUES ($1, 1, 'Renal Dosing', 'For adults with eGFR < 30 and urinary tract infection, Ciprofloxacin should not be used as first-line therapy.', 'Ia', 'active')`,
    [renalSourceBId],
  );
});

test.afterAll(async () => {
  if (renalSourceAId) await pool.query(`UPDATE sources SET lifecycle = 'retired' WHERE id = $1`, [renalSourceAId]);
  if (renalSourceBId) await pool.query(`UPDATE sources SET lifecycle = 'retired' WHERE id = $1`, [renalSourceBId]);
  await pool.end();
});

for (const locale of ['bn', 'en'] as const) {
  test(`Browser checks (${locale}): Tasks 1, 2 (renal), 6 (localized draft), and 7 (report download)`, async ({ page, request, browser }) => {
    await loginAs(page.request, 'doctor@docmate.ai');

    // === TASK 1: Care setting at intake + PatientDetailSheet ===
    await page.goto(`/${locale}/patients/new`);
    await page.waitForLoadState('networkidle');
    await page.locator('input').first().fill('01712345678');
    await page.getByTestId('search-patient-btn').click();
    await page.getByTestId('patient-profile-card').first().click();
    const skipBtn = page.getByRole('button', { name: /Skip for now|এখনকার মতো|পরে|এড়িয়ে/i });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
    }
    // The lookup forwards to the /cases/new intake; care setting is on the complaint step.
    await page.waitForURL(/\/cases\/new/, { timeout: 30_000 });
    for (let step = 0; step < 3 && !(await page.getByTestId('intake-care-setting-unset').isVisible()); step++) {
      await page.getByRole('button', { name: /^(Next|পরবর্তী)$/ }).click();
    }
    await expect(page.getByTestId('intake-care-setting-unset')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('intake-care-setting-outpatient').click();
    await expect(page.getByTestId('intake-care-setting-outpatient')).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: path.join(OUT, `${locale}-task1-intake-care-setting.png`) });

    // Create a case via API with care_setting=outpatient & confirm diagnosis
    const createRes = await page.request.post('/api/cases', {
      data: {
        patient_code: `P-2026-${Math.floor(1000 + Math.random() * 8999)}`,
        structured_input: {
          age: 52,
          gender: 'male',
          chief_complaint: 'Routine diabetes follow-up',
          allergies: ['No known drug allergies'],
          egfr: 78,
          care_setting: 'outpatient',
          vitals: {},
          lab_values: [],
        },
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { case: createdCase } = await createRes.json();

    await page.goto(`/${locale}/cases/${createdCase.id}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Patient Summary|রোগীর বিবরণ/i }).click();
    await expect(page.getByTestId('patient-detail-care-setting')).toBeVisible();
    await expect(page.getByTestId('patient-detail-care-setting')).toContainText(locale === 'bn' ? 'বহির্বিভাগ' : 'Outpatient');
    await page.screenshot({ path: path.join(OUT, `${locale}-task1-patient-sheet.png`) });

    // === TASK 2: Renal function context dimension (needs_information -> eGFR needed) ===
    const renalCaseRes = await page.request.post('/api/cases', {
      data: {
        patient_code: `P-2026-${Math.floor(1000 + Math.random() * 8999)}`,
        structured_input: {
          age: 55,
          gender: 'female',
          chief_complaint: 'Dysuria for 3 days',
          allergies: ['No known drug allergies'],
          is_pregnant: false,
          care_setting: 'outpatient',
          vitals: {},
          lab_values: [],
        },
      },
    });
    expect(renalCaseRes.ok()).toBeTruthy();
    const { case: renalCase } = await renalCaseRes.json();
    const patchRenal = await page.request.patch(`/api/cases/${renalCase.id}`, {
      data: { confirmedDiagnosis: 'Urinary Tract Infection' },
    });
    expect(patchRenal.ok()).toBeTruthy();
    await page.goto(`/${locale}/cases/${renalCase.id}?tab=treatment`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Build draft|খসড়া তৈরি করুন/i }).click();
    await expect(page.getByTestId('guideline-conflict')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('guideline-conflict')).toHaveAttribute('data-kind', 'needs_information');
    await expect(page.getByTestId('conflict-needs')).toContainText(/eGFR/i);
    await page.screenshot({ path: path.join(OUT, `${locale}-task2-renal-conflict.png`) });

    // === TASK 6: Localized server text (follow_up_questions codes rendered via next-intl) ===
    const unindexedRes = await page.request.post('/api/cases', {
      data: {
        patient_code: `P-2026-${Math.floor(1000 + Math.random() * 8999)}`,
        structured_input: {
          age: 40,
          gender: 'male',
          chief_complaint: 'Unusual test complaint',
          allergies: ['No known drug allergies'],
          vitals: {},
          lab_values: [],
        },
      },
    });
    expect(unindexedRes.ok()).toBeTruthy();
    const { case: unindexedCase } = await unindexedRes.json();
    const patchUnindexed = await page.request.patch(`/api/cases/${unindexedCase.id}`, {
      data: { confirmedDiagnosis: 'Synthetic Unindexed Syndrome' },
    });
    expect(patchUnindexed.ok()).toBeTruthy();
    await page.goto(`/${locale}/cases/${unindexedCase.id}?tab=treatment`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Build draft|খসড়া তৈরি করুন/i }).click();
    const followUpBox = page.getByTestId('draft-follow-up');
    await expect(followUpBox).toBeVisible({ timeout: 15000 });
    const text = await followUpBox.innerText();
    if (locale === 'bn') {
      expect(text).toContain('গাইডলাইন অংশে ওষুধের নাম পাওয়া যায়নি');
      expect(text).not.toContain('The library has no guideline passage');
    } else {
      expect(text).toContain('The library has no guideline passage');
    }
    await page.screenshot({ path: path.join(OUT, `${locale}-task6-localized-draft.png`) });

    // === TASK 7: Consolidated report download route ===
    // Verify legacy /api/patient/reports/download is removed (404)
    const legacyRes = await page.request.get('/api/patient/reports/download?id=00000000-0000-4000-8000-000000000001');
    expect(legacyRes.status()).toBe(404);

    // Patient portal view in browser
    const patientCtx = await browser.newContext();
    const patientPage = await patientCtx.newPage();
    await loginAs(patientPage.request, 'patient@docmate.ai');
    await patientPage.goto(`/${locale}/portal`);
    await patientPage.waitForLoadState('networkidle');
    await patientPage.screenshot({ path: path.join(OUT, `${locale}-task7-portal-reports.png`) });
    await patientCtx.close();

    // Student role gets 404 on report file
    const studentCtx = await browser.newContext();
    await loginAs(studentCtx.request, 'student@docmate.ai');
    const studentFileRes = await studentCtx.request.get(`/api/patient/reports/${crypto.randomUUID()}/file`);
    expect(studentFileRes.status()).toBe(404);
    await studentCtx.close();

    // Unused param guard
    expect(request).toBeDefined();
  });
}
