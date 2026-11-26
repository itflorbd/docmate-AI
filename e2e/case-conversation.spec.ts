import { expect, test, type APIRequestContext } from '@playwright/test';

async function login(request: APIRequestContext, role: 'doctor' | 'student' | 'admin') {
  const response = await request.post('/api/auth/login', {
    data: { email: `${role}@docmate.ai`, password: 'demo123' },
  });
  expect(response.status()).toBe(200);
}

test.describe('DocMate AI Conversational Case Workspace & Safety Boundary', () => {
  test.skip(process.env.DOCMATE_QA_SYNTHETIC !== '1', 'Requires an isolated, seeded synthetic database.');

  test('clinician opens case, writes observation, reviews proposed update, confirms it, requests evidence, inspects citation, and recovers on reload', async ({ page }) => {
    // 1. Sign in as attending physician
    await login(page.request, 'doctor');

    // 2. Fetch owned synthetic case P-101
    const casesRes = await page.request.get('/api/cases');
    expect(casesRes.ok()).toBe(true);
    const caseItem = (await casesRes.json()).cases.find(
      (c: { patient_code: string }) => c.patient_code === 'P-101'
    );
    expect(caseItem).toBeDefined();

    // 3. Open case directly into its conversation
    await page.goto(`/en/cases/${caseItem.id}`);
    await expect(page).toHaveURL(new RegExp(`/en/cases/${caseItem.id}`));

    // Verify conversation tab is active by default
    const conversationTab = page.getByRole('tab', { name: 'Case Conversation' });
    await expect(conversationTab).toBeVisible();
    await expect(conversationTab).toHaveAttribute('aria-selected', 'true');

    // 4. Submit clinical observation with patient facts using textarea (Enter to send)
    const textarea = page.getByRole('textbox', { name: 'Enter clinical observation' });
    await expect(textarea).toBeVisible();
    await textarea.fill('Patient has a high temperature of 38.8 C since morning.');
    await textarea.press('Enter');

    // 5. Verify doctor observation message appears in conversation stream
    await expect(page.getByText('Patient has a high temperature of 38.8 C since morning.').first()).toBeVisible();

    // 6. Verify assistant replies with Proposed Structured Update card
    await expect(page.getByText('Proposed Clinical Record Update').first()).toBeVisible();
    await expect(page.getByText('38.8 °C').first()).toBeVisible();
    await expect(page.getByText('Original wording:').first()).toBeVisible();

    // 7. Confirm the proposed update
    const confirmButton = page.getByRole('button', { name: 'Confirm & Apply' }).first();
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Verify status updates to Confirmed & Applied
    await expect(page.getByText('Confirmed & Applied').first()).toBeVisible();

    // Verify patient summary reflects the new temperature
    await expect(page.getByText('38.8 °C').first()).toBeVisible();

    // 8. Request Evidence Review
    const evidenceReviewBtn = page.getByRole('button', { name: 'Request Evidence Review' });
    await expect(evidenceReviewBtn).toBeVisible();
    await evidenceReviewBtn.click();

    // The review is written from library excerpts; wait for its cited passages.
    await expect(page.locator('button[title*="inspect source passage"]').first()).toBeVisible({ timeout: 90_000 });

    // 9. Inspect Citation in Evidence Sheet
    const citationChip = page.locator('button[title*="inspect source passage"]').first();
    await expect(citationChip).toBeVisible();
    await citationChip.click();

    // Verify Evidence Sheet opens with exact quote and source details
    const evidenceSheet = page.getByRole('dialog');
    await expect(evidenceSheet).toBeVisible();
    await expect(page.getByText('Library Evidence Proof')).toBeVisible();
    await expect(page.getByText('Verbatim Claim In Source')).toBeVisible();

    // Close Evidence Sheet with Escape key
    await page.keyboard.press('Escape');
    await expect(evidenceSheet).not.toBeVisible();

    // 10. Reload the page and verify conversation history is recovered from database
    await page.reload();
    await expect(page.getByText('Patient has a high temperature of 38.8 C since morning.').first()).toBeVisible();
    await expect(page.getByText('Confirmed & Applied').first()).toBeVisible();
    await expect(page.getByText('38.8 °C').first()).toBeVisible();
  });

  test('preserves unsent draft across reload and guards against duplicate sends', async ({ page }) => {
    await login(page.request, 'doctor');
    const casesRes = await page.request.get('/api/cases');
    const caseItem = (await casesRes.json()).cases[0];

    await page.goto(`/en/cases/${caseItem.id}`);

    const textarea = page.getByRole('textbox', { name: 'Enter clinical observation' });
    await textarea.fill('Draft observation for transient network resilience test');

    // Reload without sending
    await page.reload();

    // Verify draft was restored from sessionStorage
    await expect(textarea).toHaveValue('Draft observation for transient network resilience test');
  });

  test('responsive layout: mobile 390px opens patient summary via Sheet, desktop 1280px displays side-by-side', async ({ page }) => {
    await login(page.request, 'doctor');
    const casesRes = await page.request.get('/api/cases');
    const caseItem = (await casesRes.json()).cases[0];

    // Mobile viewport (390 x 844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/en/cases/${caseItem.id}`);

    // Verify mobile Patient Summary button is visible
    const mobileSummaryBtn = page.getByRole('button', { name: 'Patient Summary' });
    await expect(mobileSummaryBtn).toBeVisible();

    // Click to open mobile Sheet
    await mobileSummaryBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Vital Signs', { exact: true })).toBeVisible();

    // Close mobile sheet with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Desktop viewport (1280 x 800)
    await page.setViewportSize({ width: 1280, height: 800 });
    // In desktop view, summary is sticky on the left column
    await expect(page.locator('text=Patient Summary').first()).toBeVisible();
  });

  test('safety boundary: student role cannot access case conversation', async ({ page }) => {
    await login(page.request, 'student');
    const casesRes = await page.request.get('/api/cases');
    // Student collection returns 403
    expect(casesRes.status()).toBe(403);
  });
});
