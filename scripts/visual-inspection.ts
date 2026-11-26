import { chromium, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const EVIDENCE_DIR = '/Users/apple/.gemini/antigravity/brain/cc53fb63-0c09-4d61-86dc-66811921a57f/visual_evidence';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

interface Issue {
  page: string;
  viewport: string;
  type: 'console_error' | 'overflow' | 'broken_image' | 'untranslated_key' | 'ui_glitch';
  detail: string;
}

const issues: Issue[] = [];

async function login(page: Page, email = 'doctor@docmate.ai', pass = 'demo123') {
  await page.goto('http://localhost:3000/en/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL('**/dashboard');
}

async function checkPageHealth(page: Page, pageName: string, viewportName: string) {
  // 1. Check horizontal overflow on body
  const overflow = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    return {
      scrollWidth: docEl.scrollWidth,
      clientWidth: docEl.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      hasOverflow: docEl.scrollWidth > docEl.clientWidth + 2,
    };
  });

  if (overflow.hasOverflow) {
    issues.push({
      page: pageName,
      viewport: viewportName,
      type: 'overflow',
      detail: `Horizontal overflow detected: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
    });
  }

  // 2. Check for untranslated keys
  const rawKeys = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const matches = text.match(/\[missing\s+"[^"]+"\s+translation\]/gi) || [];
    const missingKeys = text.match(/\b(nav|common|cases|workspace|auth|dashboard)\.[a-zA-Z0-9_]+\b/g) || [];
    return [...new Set([...matches, ...missingKeys])];
  });

  if (rawKeys.length > 0) {
    issues.push({
      page: pageName,
      viewport: viewportName,
      type: 'untranslated_key',
      detail: `Potential missing translation keys: ${rawKeys.join(', ')}`,
    });
  }
}

async function run() {
  console.log('🚀 Starting Comprehensive Visual & Workflow Inspection...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore known favicon 404 or expected test logs
      if (!text.includes('favicon.ico') && !text.includes('downloadable font')) {
        issues.push({
          page: page.url(),
          viewport: 'unknown',
          type: 'console_error',
          detail: text,
        });
      }
    }
  });

  // 1. Login Page Inspection
  console.log('📸 1. Inspecting Login Pages (Desktop, Tablet, Mobile)...');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000/en/login');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_login_en_desktop.png') });
  await checkPageHealth(page, 'Login (EN)', '1280x800');

  await page.goto('http://localhost:3000/bn/login');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_login_bn_desktop.png') });
  await checkPageHealth(page, 'Login (BN)', '1280x800');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/en/login');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_login_en_mobile.png') });
  await checkPageHealth(page, 'Login (EN)', '390x844');

  // 2. Perform Login
  console.log('🔑 Logging in as Doctor...');
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);

  // 3. Dashboard Inspection
  console.log('📸 2. Inspecting Dashboard (EN, BN, Mobile)...');
  await page.goto('http://localhost:3000/en/dashboard');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_dashboard_en_desktop.png') });
  await checkPageHealth(page, 'Dashboard (EN)', '1280x800');

  await page.goto('http://localhost:3000/bn/dashboard');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_dashboard_bn_desktop.png') });
  await checkPageHealth(page, 'Dashboard (BN)', '1280x800');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/en/dashboard');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_dashboard_en_mobile.png') });
  await checkPageHealth(page, 'Dashboard (EN)', '390x844');

  // 4. Patient Cases List
  console.log('📸 3. Inspecting Cases List...');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000/en/cases');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_cases_list_desktop.png') });
  await checkPageHealth(page, 'Cases List (EN)', '1280x800');

  // Get first case via API or table
  const casesRes = await page.request.get('http://localhost:3000/api/cases');
  const casesJson = await casesRes.json();
  const firstCase = casesJson.cases?.[0];
  const targetCaseUrl = firstCase ? `http://localhost:3000/en/cases/${firstCase.id}` : null;
  console.log(`🔎 Found case: ${firstCase?.patient_code} (${targetCaseUrl})`);

  if (targetCaseUrl) {
    // 5. Case Workspace
    console.log('📸 4. Inspecting Case Workspace...');
    await page.goto(targetCaseUrl);
    await page.waitForLoadState('networkidle');

    // Tab 1: Conversation
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_case_conversation_desktop.png') });
    await checkPageHealth(page, 'Case Conversation (1280)', '1280x800');

    // Check Mobile Case Workspace
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_case_conversation_mobile.png') });
    await checkPageHealth(page, 'Case Conversation (390)', '390x844');

    // Open Mobile Patient Summary Sheet
    const mobileSummaryBtn = page.getByRole('button', { name: /Patient Summary|রোগীর বিবরণ/ });
    if (await mobileSummaryBtn.isVisible()) {
      await mobileSummaryBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_case_mobile_patient_sheet.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Switch back to desktop
    await page.setViewportSize({ width: 1280, height: 800 });

    // Tab 2: Differentials
    const diffTab = page.getByRole('tab', { name: /Differentials|ডিফারেনশিয়াল/ });
    if (await diffTab.isVisible()) {
      await diffTab.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_case_differentials.png') });
    }

    // Tab 3: Missing Info
    const missingTab = page.getByRole('tab', { name: /Missing Info|অনুপস্থিত তথ্য/ });
    if (await missingTab.isVisible()) {
      await missingTab.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_case_missing_info.png') });
    }

    // Tab 4: Treatment
    const treatmentTab = page.getByRole('tab', { name: /Treatment|চিকিৎসা/ });
    if (await treatmentTab.isVisible()) {
      await treatmentTab.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_case_treatment.png') });
    }

    // Tab 5: Safety Checks
    const safetyTab = page.getByRole('tab', { name: /Safety Checks|নিরাপত্তা পরীক্ষা/ });
    if (await safetyTab.isVisible()) {
      await safetyTab.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_case_safety.png') });
    }

    // Tab 6: Printable Report
    const reportTab = page.getByRole('tab', { name: /Printable Report|রিপোর্ট/ });
    if (await reportTab.isVisible()) {
      await reportTab.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_case_report.png') });
    }

    // Bangla Case Workspace
    const bnCaseUrl = targetCaseUrl.replace('/en/', '/bn/');
    await page.goto(bnCaseUrl);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_case_bn_desktop.png') });
    await checkPageHealth(page, 'Case Workspace (BN)', '1280x800');
  }

  // 6. Patients Directory & New Intake
  console.log('📸 5. Inspecting Patients Directory & New Intake Form...');
  await page.goto('http://localhost:3000/en/patients');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '05_patients_directory.png') });
  await checkPageHealth(page, 'Patients Directory', '1280x800');

  await page.goto('http://localhost:3000/en/patients/new');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '05_patients_new_intake.png') });
  await checkPageHealth(page, 'New Patient Intake', '1280x800');

  // Mobile New Intake
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '05_patients_new_intake_mobile.png') });
  await checkPageHealth(page, 'New Patient Intake Mobile', '390x844');

  // 7. Medical Library & Ask Library
  console.log('📸 6. Inspecting Medical Library & Ask Library...');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000/en/library');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '06_library_desktop.png') });
  await checkPageHealth(page, 'Medical Library', '1280x800');

  await page.goto('http://localhost:3000/en/ask');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '06_ask_desktop.png') });
  await checkPageHealth(page, 'Ask Library', '1280x800');

  // 8. Prescriptions
  console.log('📸 7. Inspecting Prescriptions...');
  await page.goto('http://localhost:3000/en/prescriptions');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '07_prescriptions_desktop.png') });
  await checkPageHealth(page, 'Prescriptions', '1280x800');

  // 9. Admin Settings (Voice & AI)
  console.log('📸 8. Inspecting Admin Settings...');
  // Logout first
  await context.clearCookies();
  await page.goto('http://localhost:3000/en/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill('admin@docmate.ai');
  await page.locator('input[type="password"]').fill('demo123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL('**/admin**');

  await page.goto('http://localhost:3000/en/admin/ai');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '08_admin_ai.png') });
  await checkPageHealth(page, 'Admin AI', '1280x800');

  await page.goto('http://localhost:3000/en/admin/voice');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '08_admin_voice.png') });
  await checkPageHealth(page, 'Admin Voice', '1280x800');

  await browser.close();

  console.log('\n================================================================');
  console.log('📋 VISUAL INSPECTION SUMMARY');
  console.log(`   Captured Screenshots: ${fs.readdirSync(EVIDENCE_DIR).length}`);
  console.log(`   Total Issues Detected: ${issues.length}`);
  console.log('================================================================');
  for (const issue of issues) {
    console.log(`- [${issue.type.toUpperCase()}] on ${issue.page} (${issue.viewport}): ${issue.detail}`);
  }

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'inspection_report.json'),
    JSON.stringify(issues, null, 2)
  );
}

run().catch((err) => {
  console.error('Inspection script failed:', err);
  process.exit(1);
});
