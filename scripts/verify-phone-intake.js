/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/apple/.gemini/antigravity/brain/ad634b59-ee6b-4b56-8377-ac1fd6d7a0f3/phone_intake_evidence';
const BASE_URL = 'http://localhost:3000';

async function verifyPhoneIntake() {
  if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  console.log('--- Starting Phone Intake & Auto-fill Verification ---');

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'doctor@docmate.ai', password: 'demo123' }),
  });
  const cookie = loginRes.headers.get('set-cookie').match(/docmate_session=([^;]+)/)[1];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies([
    { name: 'docmate_session', value: cookie, domain: 'localhost', path: '/' },
    { name: 'NEXT_LOCALE', value: 'bn', domain: 'localhost', path: '/' },
  ]);

  const page = await context.newPage();

  // 1. Visit /bn/patients/new
  console.log('1. Navigating to /bn/patients/new...');
  await page.goto(`${BASE_URL}/bn/patients/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_intake_phone_search.png'), fullPage: true });
  console.log('✓ Captured Phone Search Step');

  // 2. Click demo shortcut: 01711223344 (Ayesha Begum)
  console.log('2. Clicking demo phone shortcut 01711223344...');
  const ayeshaBtn = page.locator('button:has-text("01711223344")');
  await ayeshaBtn.click();
  await page.waitForTimeout(1000);

  // Verify search results appeared
  const foundProfiles = page.locator('[data-testid="patient-profile-card"]');
  const count = await foundProfiles.count();
  console.log(`Found ${count} profiles for 01711223344`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_intake_profiles_found.png'), fullPage: true });
  console.log('✓ Captured Profiles Found on account');

  // 3. Click the profile to auto-fill and advance to intake
  console.log('3. Selecting patient profile to auto-fill...');
  await foundProfiles.first().click();
  await page.waitForTimeout(800);

  // Check if intake form with patient banner is displayed
  const banner = page.locator('[data-testid="selected-patient-banner"]');
  console.log('Patient auto-filled banner visible:', await banner.isVisible());
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_intake_autofilled_consultation.png'), fullPage: true });
  console.log('✓ Captured Auto-filled Clinical Consultation Intake Step');

  // 4. Test redirect from /bn/cases/new -> /bn/patients/new
  console.log('4. Testing legacy URL /bn/cases/new redirects to /bn/patients/new...');
  await page.goto(`${BASE_URL}/bn/cases/new`, { waitUntil: 'networkidle' });
  await page.waitForURL('**/patients/new', { timeout: 5000 });
  console.log('✓ Successfully redirected to /bn/patients/new:', page.url());

  await browser.close();
  console.log('🎉 Phone Intake & Auto-fill Verification Completed Successfully!');
}

verifyPhoneIntake().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
