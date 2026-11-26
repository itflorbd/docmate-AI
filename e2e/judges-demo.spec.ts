// Judges' diagnostic demo (P-901), Bangla and English, through the browser.
//
// Needs: the reference PDF published in the library, DOCMATE_DEMO_MODE=true and
// DOCMATE_SYNTHETIC_ASSESSMENT=on on the server, and a configured chat model
// (otherwise the run records fallback mode).
//   DATABASE_URL=... DOCMATE_QA_BASE_URL=http://127.0.0.1:3150 npx playwright test e2e/judges-demo.spec.ts
// All patient data is synthetic. The answer key is not in the library.

import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

const OUT = path.join(process.cwd(), 'output', 'patient-qa', 'judges-case', 'fixed');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const results: Record<string, unknown> = {};

const PROMPTS = {
  bn: [
    'শুধু নথিভুক্ত তথ্য ও লাইব্রেরির প্রমাণ দেখে বলুন, এখন কী সিদ্ধান্তে পৌঁছানো যায়? নিশ্চিত করার জন্য কোন তথ্য দরকার?',
    'নতুন ল্যাব ফল। Day 1 laboratory HbA1c 7.4% এবং ৮ ঘণ্টা fasting-এর পর laboratory fasting plasma glucose 154 mg/dL। Day 8-এ ৮ ঘণ্টা fasting-এর পর repeat laboratory fasting plasma glucose 151 mg/dL। শুধু লাইব্রেরির প্রমাণ থেকে সবচেয়ে সমর্থিত রোগনির্ণয়, তার পক্ষে পরীক্ষার মানগুলো এবং কী অনিশ্চিত তা বলুন। উৎসের উদ্ধৃতি দিন।',
  ],
  en: [
    'Based only on the recorded information and library evidence, what can be concluded now? What information is needed to confirm?',
    'New lab results. Day 1 laboratory HbA1c 7.4% and laboratory fasting plasma glucose 154 mg/dL after an 8-hour fast. Day 8 repeat laboratory fasting plasma glucose 151 mg/dL after an 8-hour fast. Using only library evidence, give the best-supported diagnosis, the test values that support it, and what remains uncertain. Cite the source.',
  ],
} as const;

const base = (locale: 'bn' | 'en', labs: { name: string; value: number; unit: string }[]) => ({
  age: 47,
  gender: 'male',
  weight_kg: 82,
  chief_complaint: locale === 'bn' ? 'ছয় সপ্তাহ ধরে বেশি পিপাসা ও ঘন ঘন প্রস্রাব' : 'Increased thirst and frequent urination for six weeks',
  symptoms: locale === 'bn' ? ['বেশি পিপাসা', 'ঘন ঘন প্রস্রাব', 'ক্লান্তি'] : ['Increased thirst', 'Frequent urination', 'Fatigue'],
  history_of_present_illness: locale === 'bn' ? 'বমি, পেটব্যথা ও জ্বর নেই। পরিচিত ডায়াবেটিস নেই।' : 'No vomiting, abdominal pain or fever. No known diabetes.',
  past_medical_history: [],
  current_medicines: [],
  allergies: [],
  vitals: { blood_pressure_systolic: 128, blood_pressure_diastolic: 80, heart_rate: 78, respiratory_rate: 16, temperature_celsius: 36.8, spo2_percent: 98 },
  lab_values: labs,
});

async function createCase(code: string, input: object) {
  const { rows: [doc] } = await pool.query(`SELECT id FROM users WHERE email = 'doctor@docmate.ai'`);
  const { rows } = await pool.query(`INSERT INTO cases (doctor_id, patient_code, status, structured_input) VALUES ($1, $2, 'draft', $3) RETURNING id`, [doc.id, code, JSON.stringify(input)]);
  return rows[0].id as string;
}

async function send(page: Page, caseId: string, text: string) {
  const box = page.locator('textarea').first();
  await expect(box).toBeEnabled({ timeout: 120_000 });
  await box.fill(text);
  // Match the response to this prompt, not the automatic case review.
  const done = page.waitForResponse(
    (res) => res.url().includes(`/api/cases/${caseId}/chat`) && res.request().method() === 'POST' && (res.request().postData() ?? '').includes(text.slice(0, 30)),
    { timeout: 120_000 },
  );
  await box.press('Enter');
  const response = await done;
  await response.finished();
  await page.waitForTimeout(1500);
  const { rows } = await pool.query(
    `SELECT s.content FROM case_turns s JOIN case_turns d ON d.id::text = s.content->>'in_reply_to'
     WHERE s.case_id = $1 AND s.role = 'system' AND d.content->>'text' = $2 ORDER BY s.created_at DESC LIMIT 1`,
    [caseId, text],
  );
  return rows[0]?.content as Record<string, unknown>;
}

/** The workspace runs an automatic case review on first open; let it finish. */
async function waitForAutoReview(caseId: string) {
  for (let i = 0; i < 90; i++) {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM case_turns WHERE case_id = $1 AND role = 'system'`, [caseId]);
    if (rows[0].n > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

test.afterAll(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  await pool.end();
});

for (const locale of ['bn', 'en'] as const) {
  test(`P-901 ${locale}: symptoms only, complete case, structured Analyze, citation`, async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const login = await page.request.post('/api/auth/login', { data: { email: 'doctor@docmate.ai', password: 'demo123' } });
    expect(login.ok()).toBeTruthy();
    const stamp = Date.now().toString(36).toUpperCase();
    const chatCase = await createCase(`P-901-${locale.toUpperCase()}-${stamp}`, base(locale, []));
    const labs = [
      { name: 'HbA1c (Day 1)', value: 7.4, unit: '%' },
      { name: 'Fasting plasma glucose (Day 1)', value: 154, unit: 'mg/dL' },
      { name: 'Repeat fasting plasma glucose (Day 8)', value: 151, unit: 'mg/dL' },
    ];
    const analyzeCase = await createCase(`P-902-${locale.toUpperCase()}-${stamp}`, base(locale, labs));

    await page.goto(`/${locale}/cases/${chatCase}?tab=conversation`);
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 60_000 });
    await waitForAutoReview(chatCase);
    await page.waitForTimeout(1000);

    const first = await send(page, chatCase, PROMPTS[locale][0]);
    await page.screenshot({ path: path.join(OUT, `${locale}-01-symptoms-only.png`) });
    const second = await send(page, chatCase, PROMPTS[locale][1]);
    await page.screenshot({ path: path.join(OUT, `${locale}-02-complete-case.png`) });

    // Open the citation for the HbA1c criterion from the last reply.
    const chips = page.getByRole('button', { name: /\[\d+\]|^\d+$/ });
    const chipCount = await chips.count();
    if (chipCount > 0) {
      await chips.nth(Math.max(0, chipCount - 4)).click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT, `${locale}-04-citation.png`) });
      await page.keyboard.press('Escape');
    }

    // Structured Analyze on the companion case.
    await page.goto(`/${locale}/cases/${analyzeCase}?tab=differentials`);
    const analyze = page.waitForResponse((res) => res.url().includes(`/api/cases/${analyzeCase}/analyze`), { timeout: 120_000 });
    await page.getByRole('button', { name: locale === 'bn' ? 'কেস বিশ্লেষণ করুন' : 'Analyze Case' }).first().click();
    const analyzeBody = await (await analyze).json();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${locale}-03-structured-analyze.png`) });

    const text2 = String(second?.text ?? '');
    const analysis = analyzeBody.analysis;
    results[locale] = {
      model: second?.model ?? null,
      mode: analyzeBody.assessment?.mode ?? (second?.model ? 'live' : 'fallback'),
      symptoms_only: {
        status: first?.status,
        asks_for_hba1c_and_fpg: /HbA1c|A1C/i.test(String(first?.text)) && /fasting plasma glucose|FPG|ফাস্টিং/i.test(String(first?.text)),
        says_not_in_library_for_patient_data: /লাইব্রেরিতে নেই|not covered by the library/i.test(String(first?.text)),
        text: first?.text,
      },
      complete_case: {
        status: second?.status,
        assessment: (second?.verification as { assessment?: unknown })?.assessment ?? null,
        rejections: (second?.verification as { rejections?: unknown })?.rejections ?? [],
        shows_values: ['7.4%', '154 mg/dL', '151 mg/dL'].every((value) => text2.includes(value)),
        names_condition: /diabetes mellitus/i.test(text2),
        names_subtype: /type\s*(1|2)/i.test(text2),
        cites_reference_pdf: (second?.claims as { source_title?: string }[] | undefined)?.some((claim) => /Judges - Diabetes/i.test(claim.source_title ?? '')) ?? false,
        text: text2,
      },
      structured_analyze: {
        http: 200,
        status: analysis?.status,
        differentials: analysis?.differentials?.map((d: { condition: string }) => d.condition) ?? [],
        shows_values: ['7.4%', '154 mg/dL', '151 mg/dL'].every((value) => String(analysis?.summary).includes(value)),
        names_subtype: /type\s*(1|2)/i.test(String(analysis?.summary)),
        assessment: analyzeBody.assessment,
      },
    };

    const r = results[locale] as {
      symptoms_only: { status: string; asks_for_hba1c_and_fpg: boolean; says_not_in_library_for_patient_data: boolean };
      complete_case: { shows_values: boolean; names_condition: boolean; names_subtype: boolean; cites_reference_pdf: boolean };
      structured_analyze: { shows_values: boolean; names_subtype: boolean };
    };
    expect(r.symptoms_only.status).toBe('insufficient_evidence');
    expect(r.symptoms_only.asks_for_hba1c_and_fpg).toBe(true);
    expect(r.symptoms_only.says_not_in_library_for_patient_data).toBe(false);
    expect(r.complete_case.names_condition).toBe(true);
    expect(r.complete_case.shows_values).toBe(true);
    expect(r.complete_case.names_subtype).toBe(false);
    expect(r.complete_case.cites_reference_pdf).toBe(true);
    expect(analysis?.differentials?.[0]?.condition).toMatch(/diabetes mellitus/i);
    expect(r.structured_analyze.shows_values).toBe(true);
    expect(r.structured_analyze.names_subtype).toBe(false);
  });
}
