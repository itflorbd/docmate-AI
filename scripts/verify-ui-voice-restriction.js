/* eslint-disable */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // 1. Sign in as doctor
  await page.goto('http://localhost:3000/bn/login');
  await page.click('text=চিকিৎসক (Doctor)');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('1. Logged in, current URL:', page.url());

  // Check dashboard: voice button must NOT exist
  const dashVoiceBtn = await page.$('[data-tour="voice-floating-btn"]');
  console.log('Dashboard voice button exists:', !!dashVoiceBtn);
  await page.screenshot({ path: '/tmp/dashboard_verified.png' });

  // 2. Check patients list
  await page.goto('http://localhost:3000/bn/patients');
  await page.waitForTimeout(1000);
  const patVoiceBtn = await page.$('[data-tour="voice-floating-btn"]');
  console.log('Patients page voice button exists:', !!patVoiceBtn);
  await page.screenshot({ path: '/tmp/patients_verified_collapsed.png' });

  // Click search icon button
  const searchBtn = await page.$('[title*="Search"], [title*="খুঁজুন"]');
  if (searchBtn) {
    await searchBtn.click();
    await page.waitForTimeout(400);
    console.log('Clicked search icon button!');
    await page.screenshot({ path: '/tmp/patients_verified_expanded.png' });
  }

  // 3. Check case workspace
  await page.goto('http://localhost:3000/bn/cases/7e5eb7d8-f801-4ff1-bbc8-2fdde329fd0d');
  await page.waitForTimeout(1500);
  const caseVoiceBtn = await page.$('[data-tour="voice-floating-btn"]');
  console.log('Case workspace voice button exists:', !!caseVoiceBtn);
  await page.screenshot({ path: '/tmp/case_workspace_verified.png' });

  if (caseVoiceBtn) {
    await caseVoiceBtn.click();
    await page.waitForTimeout(600);
    console.log('Clicked case workspace voice button!');
    await page.screenshot({ path: '/tmp/case_voice_panel_verified.png' });
  }

  await browser.close();
  console.log('All verification steps completed successfully!');
})();
