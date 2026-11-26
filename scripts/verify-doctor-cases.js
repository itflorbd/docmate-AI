/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = '/Users/apple/.gemini/antigravity/brain/ad634b59-ee6b-4b56-8377-ac1fd6d7a0f3/doctor_cases_evidence';
const BASE_URL = 'http://localhost:3000';

async function getSessionCookie(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login API failed with status ${res.status}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No set-cookie header received');
  }
  const match = setCookie.match(/docmate_session=([^;]+)/);
  if (!match) {
    throw new Error('docmate_session cookie not found in response');
  }
  return match[1];
}

async function verifyDoctorCases() {
  console.log('--- Starting Doctor Cases Verification ---');
  const sessionToken = await getSessionCookie('doctor@docmate.ai', 'demo123');
  console.log('✓ Got doctor session cookie');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  await context.addCookies([
    {
      name: 'docmate_session',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'NEXT_LOCALE',
      value: 'bn',
      domain: 'localhost',
      path: '/',
    },
  ]);

  const page = await context.newPage();

  // 1. Visit Dashboard
  console.log('1. Visiting /bn/dashboard...');
  await page.goto(`${BASE_URL}/bn/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_doctor_dashboard_running_cases.png'), fullPage: true });
  console.log('✓ Captured Dashboard with Running Cases tab');

  // 2. Switch to Solved Cases Tab on Dashboard
  const solvedTabTrigger = page.locator('button[role="tab"]:has-text("সমাধানকৃত")');
  if (await solvedTabTrigger.isVisible()) {
    await solvedTabTrigger.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_doctor_dashboard_solved_cases.png'), fullPage: true });
    console.log('✓ Captured Dashboard with Solved Cases tab');
  }

  // 3. Inspect Sidebar with Patient Cases link
  const casesNavLink = page.locator('a[href*="/cases"]:not([href*="/cases/new"])').first();
  console.log('Sidebar has cases link:', await casesNavLink.isVisible());
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_sidebar_with_cases_link.png') });

  // 4. Navigate to /cases (All Cases)
  console.log('4. Navigating to /bn/cases...');
  await page.goto(`${BASE_URL}/bn/cases`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_cases_page_all.png'), fullPage: true });
  console.log('✓ Captured /cases All Cases tab');

  // 5. Click Running Cases tab on /cases
  const runningTab = page.locator('button[role="tab"]:has-text("চলমান")');
  if (await runningTab.isVisible()) {
    await runningTab.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_cases_page_running.png'), fullPage: true });
    console.log('✓ Captured /cases Running Cases tab');
  }

  // 6. Click Solved Cases tab on /cases
  const solvedTab = page.locator('button[role="tab"]:has-text("সমাধানকৃত")');
  if (await solvedTab.isVisible()) {
    await solvedTab.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_cases_page_solved.png'), fullPage: true });
    console.log('✓ Captured /cases Solved Cases tab');
  }

  await browser.close();
  console.log('🎉 Doctor Cases Verification completed successfully!');
}

verifyDoctorCases().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
