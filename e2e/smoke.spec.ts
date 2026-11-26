import { test, expect } from '@playwright/test';

test.describe('DocMate AI Smoke E2E Tests', () => {
  test('1. Doctor demo credentials login flow', async ({ page }) => {
    // Navigate to Bangla login page
    await page.goto('/bn/login');
    await expect(page).toHaveTitle(/DocMate AI/);

    // Verify login heading rendered
    await expect(page.locator('h1')).toContainText('DocMate AI');

    // Fill demo credentials
    await page.fill('input[type="email"]', 'doctor@docmate.ai');
    await page.fill('input[type="password"]', 'demo123');

    // Click submit
    await page.click('button[type="submit"]');

    // Verify navigation to dashboard
    await expect(page).toHaveURL(/\/bn\/dashboard/);
    await expect(page.locator('text=Dr. Farhana Rahman').first()).toBeVisible();
  });

  test('2. Case workspace inspection, differentials, and patient summary', async ({ page }) => {
    // Navigate to English login and login
    await page.goto('/en/login');
    await page.fill('input[type="email"]', 'doctor@docmate.ai');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/en\/dashboard/);

    // Navigate to Cases list
    await page.goto('/en/cases');
    await expect(page.locator('h1')).toContainText('Patient Cases');

    // Wait for case table to load and find P-101
    await expect(page.locator('text=P-101').first()).toBeVisible();

    // Click on P-101 row
    await page.click('text=P-101');

    // Verify workspace URL
    await expect(page).toHaveURL(/\/en\/cases\/.+/);

    // Verify patient summary details
    await expect(page.locator('text=Patient Summary').first()).toBeVisible();
    await expect(page.locator('text=P-101').first()).toBeVisible();

    // Verify chief complaint
    await expect(page.locator('text=High fever').first()).toBeVisible();

    // Verify workspace tabs
    await expect(page.locator('role=tab[name*="Differentials"]')).toBeVisible();
    await expect(page.locator('role=tab[name*="Treatment"]')).toBeVisible();
    await expect(page.locator('role=tab[name*="Safety"]')).toBeVisible();
    await expect(page.locator('role=tab[name*="Report"]')).toBeVisible();
  });

  test('3. Bilingual persistent disclaimer and language switching', async ({ page }) => {
    const session = await page.request.post('/api/auth/login', {
      data: { email: 'doctor@docmate.ai', password: 'demo123' },
    });
    expect(session.ok()).toBe(true);
    await page.goto('/en/dashboard');

    // Verify persistent disclaimer in English
    const enDisclaimer = page.locator('text=Clinical decision support only. Not a substitute for professional judgement.');
    await expect(enDisclaimer).toBeVisible();

    // Switch to Bangla
    await page.goto('/bn/dashboard');

    // Verify persistent disclaimer in Bengali
    const bnDisclaimer = page.locator('text=শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।');
    await expect(bnDisclaimer).toBeVisible();
  });
});
