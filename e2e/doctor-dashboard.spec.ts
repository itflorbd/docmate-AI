// Doctor dashboard fits one screen on desktop, stacks on phones, and the tour
// button walks through the page. Synthetic demo account only.
//   DOCMATE_QA_BASE_URL=http://127.0.0.1:3180 npx playwright test e2e/doctor-dashboard.spec.ts
import { expect, test } from '@playwright/test';

for (const locale of ['bn', 'en'] as const) {
  test(`dashboard on one screen with a tour (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const login = await page.request.post('/api/auth/login', { data: { email: 'doctor@docmate.ai', password: 'demo123' } });
    expect(login.ok()).toBeTruthy();
    await page.goto(`/${locale}/dashboard`);
    await expect(page.getByTestId('doctor-dashboard')).toBeVisible({ timeout: 60_000 });

    // No page scroll and no sideways scroll at 1280 x 800.
    const fit = await page.evaluate(() => ({ y: document.documentElement.scrollHeight - window.innerHeight, x: document.documentElement.scrollWidth - window.innerWidth }));
    expect(fit).toEqual({ y: 0, x: 0 });
    for (const id of ['dashboard-stats', 'dashboard-cases', 'dashboard-quick', 'dashboard-recent']) {
      const box = await page.locator(`[data-tour="${id}"]`).boundingBox();
      expect(box && box.y + box.height <= 800).toBeTruthy();
    }

    // Tour: opens, moves with keys and buttons, closes with Esc and returns focus.
    await page.getByTestId('tour-button').click();
    const card = page.getByTestId('tour-card');
    await expect(card).toBeVisible();
    await expect(card).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await card.getByRole('button').last().click();
    await expect(card).toContainText(locale === 'bn' ? 'নতুন রোগী' : 'New patient');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('tour-overlay')).toBeHidden();
    await expect(page.getByTestId('tour-button')).toBeFocused();
  });
}

test('dashboard stacks on a phone without sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post('/api/auth/login', { data: { email: 'doctor@docmate.ai', password: 'demo123' } });
  await page.goto('/bn/dashboard');
  await expect(page.getByTestId('doctor-dashboard')).toBeVisible({ timeout: 60_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  await page.getByTestId('doctor-dashboard').evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await expect(page.locator('[data-tour="dashboard-recent"]')).toBeInViewport();
});
