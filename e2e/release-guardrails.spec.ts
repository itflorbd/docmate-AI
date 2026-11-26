import { expect, test, type APIRequestContext } from '@playwright/test';

async function login(request: APIRequestContext, role: 'doctor' | 'student' | 'admin') {
  const response = await request.post('/api/auth/login', {
    data: { email: `${role}@docmate.ai`, password: 'demo123' },
  });
  expect(response.status()).toBe(200);
}

test.describe('Offline synthetic release guardrails', () => {
  test.skip(process.env.DOCMATE_QA_SYNTHETIC !== '1', 'Requires an isolated, seeded synthetic database.');

  test('physician records a synthetic case and follow-up, then gets a blocked prescription and a report preview', async ({ page }) => {
    await login(page.request, 'doctor');
    const casesResponse = await page.request.get('/api/cases');
    expect(casesResponse.ok()).toBe(true);
    const fixture = (await casesResponse.json()).cases.find((record: { patient_code: string }) => record.patient_code === 'P-103');
    expect(fixture).toBeDefined();
    const fixtureAnalysis = await page.request.post(`/api/cases/${fixture.id}/analyze`, { data: { locale: 'en' } });
    expect(await fixtureAnalysis.json()).toMatchObject({
      analysis: { status: 'insufficient_evidence', differentials: [], missing_information: [expect.anything(), expect.anything()] },
    });

    await page.goto('/en/cases/new');
    const code = `P-${Date.now().toString().slice(-8)}`;
    await page.getByLabel('Patient ID / Code').fill(code);
    await expect(page.getByLabel('Temperature (°C)')).toHaveValue('');
    await page.getByLabel('Age (years)').fill('40');
    await page.getByLabel('Biological Sex').click();
    await page.getByRole('option', { name: 'Other' }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByLabel('Chief Complaint').fill('Synthetic fatigue for workflow testing');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Run AI Diagnostic Analysis' }).click();
    await expect(page).toHaveURL(/\/en\/cases\/[0-9a-f-]+$/);
    const id = new URL(page.url()).pathname.split('/').at(-1);
    await page.getByRole('tab', { name: 'Missing Info' }).click();
    await expect(page.getByText('What findings did the physician document on examination?')).toBeVisible();
    const questionCard = page.locator('[data-slot="card"]').filter({
      hasText: 'What findings did the physician document on examination?',
    });
    await questionCard.getByRole('textbox', { name: 'What findings did the physician document on examination?' })
      .fill('Synthetic observation recorded.');
    await questionCard.getByRole('button', { name: 'Save Answer' }).click();
    await expect.poll(async () => {
      const response = await page.request.get(`/api/cases/${id}`);
      return (await response.json()).turns.length;
    }).toBeGreaterThanOrEqual(1);

    // Treatment needs a confirmed working diagnosis; an unknown one gets no draft.
    await page.getByRole('tab', { name: 'Treatment' }).click();
    await page.getByTestId('treatment-draft').or(page.getByRole('button', { name: 'Set diagnosis' })).first().waitFor();
    await page.getByRole('button', { name: 'Set diagnosis' }).first().click();
    await page.getByRole('radio', { name: 'Other / Clinical Override' }).click();
    await page.getByPlaceholder('Enter clinical condition...').fill('Synthetic physician assessment');
    const diagnosis = page.waitForResponse((response) =>
      response.url().endsWith(`/api/cases/${id}`) && response.request().method() === 'PATCH',
    );
    await page.getByRole('dialog').getByRole('button', { name: 'Proceed to Treatment Planning' }).click();
    expect((await diagnosis).ok()).toBe(true);
    await expect(page.getByText('Not enough evidence for a draft')).toBeVisible({ timeout: 30_000 });
    // No approved plan: finalizing is refused, and official printing stays off.
    const finalization = await page.request.post(`/api/cases/${id}/finalize`);
    expect(finalization.status()).toBe(409);
    await page.getByRole('tab', { name: 'Printable Report' }).click();
    await expect(page.getByTestId('official-off')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print preview' })).toBeDisabled();
  });

  test('unrelated Ask abstains, evidence search returns excerpts, and the command dialog opens and closes', async ({ page }) => {
    await login(page.request, 'doctor');
    await page.goto('/en/ask');
    const question = page.getByRole('textbox');
    await question.fill('quantum entanglement');
    await question.press('Enter');
    await expect(page.getByText('No matching answer found in the library', { exact: false })).toBeVisible();
    await question.fill('amoxicillin');
    await question.press('Enter');
    // An in-library question gets an answer with verified, clickable citations.
    await expect(page.locator('button[title*="inspect source passage"]').first()).toBeVisible({ timeout: 60_000 });

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Command Palette' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Command Palette' })).toHaveCount(0);
  });

  test('student is denied cases and admin can add source metadata', async ({ browser, page }) => {
    await login(page.request, 'student');
    expect((await page.request.get('/api/cases')).status()).toBe(403);
    const dashboard = await page.goto('/en/dashboard');
    expect(dashboard?.ok()).toBe(true);
    await expect(page.getByRole('heading', { name: 'Recent Clinical Cases' })).toHaveCount(0);
    await expect(page.getByText('P-103', { exact: true })).toHaveCount(0);
    expect(await dashboard?.text()).not.toContain('P-103');
    await page.goto('/en/cases');
    await expect(page).toHaveURL(/\/en\/study$/);

    const admin = await browser.newContext();
    try {
      await login(admin.request, 'admin');
      const view = await admin.newPage();
      await view.goto('/en/library');
      await view.getByRole('button', { name: 'Add New Source' }).click();
      await expect(view.getByRole('dialog')).toBeVisible();
      const title = `Synthetic QA source ${Date.now()}`;
      await view.locator('#source-title').fill(title);
      await view.locator('#source-year').fill('2024');
      await view.getByRole('dialog').locator('button[type=submit]').click();
      await expect(view.getByText(title)).toBeVisible();
    } finally {
      await admin.close();
    }
  });
});

test.describe('Responsive navigation and source integrity', () => {
  test.skip(process.env.DOCMATE_QA_SYNTHETIC !== '1', 'Requires an isolated, seeded synthetic database.');

  test('dashboard fits tablet widths in English and Bangla and the mobile sidebar restores focus', async ({ page }) => {
    await login(page.request, 'doctor');
    for (const locale of ['bn', 'en']) {
      for (const width of [390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}/dashboard`);
        await expect(page.getByRole('main')).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
    }

    await page.setViewportSize({ width: 390, height: 900 });
    await expect(page.locator('[data-slot="sidebar"][data-state]')).toHaveCount(0);
    const toggle = page.getByRole('button', { name: 'Toggle Sidebar' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    const sidebar = page.getByRole('dialog', { name: 'Sidebar' });
    await expect(sidebar).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sidebar).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('command search finds owned cases and library sources', async ({ page }) => {
    await login(page.request, 'doctor');
    await page.goto('/en/dashboard');
    await expect(page.getByRole('button', { name: 'Search cases and sources' })).toBeVisible();
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Command Palette' });
    if (!(await dialog.isVisible())) {
      await page.getByRole('button', { name: 'Search cases and sources' }).click();
    }
    const query = dialog.getByRole('combobox');
    await query.fill('P-103');
    await expect(page.getByRole('option', { name: 'P-103' })).toBeVisible();
    await query.fill('adult acute respiratory');
    await page.getByRole('option', { name: /National Clinical Guidelines for Adult Acute Respiratory Infections/ }).click();
    await expect(page).toHaveURL(/\/en\/library\?source=/);
    await expect(page.getByText('WHO & National Clinical Guidelines for Adult Acute Respiratory Infections', { exact: true })).toBeVisible();
  });

  test('failed source loading shows a retry state with no invented passage', async ({ page }) => {
    await login(page.request, 'doctor');
    await page.goto('/en/library');
    const chunks = '**/api/library/chunks?source_id=*';
    await page.route(chunks, (route) => route.fulfill({ status: 503 }));
    const sourceCard = page.locator('[data-slot="card"]').filter({ hasText: 'WHO & National Clinical Guidelines for Adult Acute Respiratory Infections' });
    await sourceCard.getByRole('button', { name: 'Browse Passage Chunks' }).click();
    await expect(page.getByText('Source passages could not be loaded.')).toBeVisible();
    await expect(page.getByText('Community-acquired pneumonia (CAP) in adults is defined', { exact: false })).toHaveCount(0);
    await page.unroute(chunks);
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('Section 1: Clinical Presentation & Diagnostic Criteria', { exact: true })).toBeVisible();
  });
});
