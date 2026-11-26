import { test, expect } from '@playwright/test';

test.describe('New Patient Intake - Phone Search E2E', () => {
  test('Doctor searches patient by phone (standard, 10-digit, and Bengali numerals)', async ({ page, context }) => {
    // 1. Sign in via API to set session cookie cleanly
    const loginRes = await context.request.post('http://localhost:3000/api/auth/login', {
      data: { email: 'doctor@docmate.ai', password: 'demo123' },
    });
    expect(loginRes.ok()).toBe(true);

    // 2. Navigate to New Patient Intake in Bangla
    await page.goto('http://localhost:3000/bn/patients/new');
    await expect(page).toHaveURL(/\/bn\/patients\/new/);

    // 3. Search for 01711223344 (Ayesha Begum from database)
    const phoneInput = page.getByTestId('patient-phone-input');
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill('01711223344');

    const searchBtn = page.getByTestId('search-patient-btn');
    await searchBtn.click();

    // Verify patient profile card appears with Ayesha Begum
    const profileCard = page.getByTestId('patient-profile-card').first();
    await expect(profileCard).toBeVisible({ timeout: 8000 });
    await expect(profileCard).toContainText('আয়েশা বেগম');

    await page.screenshot({
      path: '/Users/apple/.gemini/antigravity/brain/cc53fb63-0c09-4d61-86dc-66811921a57f/patient_search_success.png',
    });

    // 4. Click profile card to select into intake
    await profileCard.click();

    // Verify active patient banner in intake shows Ayesha Begum
    const patientBanner = page.getByTestId('selected-patient-banner');
    await expect(patientBanner).toBeVisible({ timeout: 8000 });
    await expect(patientBanner).toContainText('আয়েশা বেগম');

    await page.screenshot({
      path: '/Users/apple/.gemini/antigravity/brain/cc53fb63-0c09-4d61-86dc-66811921a57f/patient_intake_prefilled.png',
    });

    // 5. Click "রোগী পরিবর্তন" (Change Patient) to search another number
    const changePatientBtn = patientBanner.getByRole('button', { name: /রোগী পরিবর্তন|Change Patient/i });
    await changePatientBtn.click();
    await expect(phoneInput).toBeVisible({ timeout: 5000 });

    // 6. Test 10-digit format without leading 0 (1819554433 -> Rafiqul Islam)
    await phoneInput.fill('1819554433');
    await searchBtn.click();
    await expect(page.getByTestId('patient-profile-card').first()).toContainText('রফিকুল ইসলাম', { timeout: 8000 });

    // 7. Test Bengali numerals (০১৭১১২২৩৩৪৪ -> Ayesha Begum)
    await phoneInput.fill('০১৭১১২২৩৩৪৪');
    await searchBtn.click();
    await expect(page.getByTestId('patient-profile-card').first()).toContainText('আয়েশা বেগম', { timeout: 8000 });

    // 8. Test third database patient 01912445566 -> Tania Sultana
    await phoneInput.fill('01912445566');
    await searchBtn.click();
    await expect(page.getByTestId('patient-profile-card').first()).toContainText('তানিয়া সুলতানা', { timeout: 8000 });
  });
});
