/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const path = require('path');
const { Pool } = require('pg');

const ARTIFACT_DIR = '/Users/apple/.gemini/antigravity/brain/ad634b59-ee6b-4b56-8377-ac1fd6d7a0f3/clean_workspace_evidence';
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
    throw new Error('docmate_session cookie not found');
  }
  return match[1];
}

async function getCaseId() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://apple@localhost:5432/docmate' });
  try {
    const res = await pool.query('SELECT id FROM cases ORDER BY created_at DESC LIMIT 1');
    return res.rows[0]?.id;
  } finally {
    await pool.end();
  }
}

async function verifyCleanWorkspace() {
  console.log('--- Starting Clean Workspace Deduplication Verification ---');
  const sessionToken = await getSessionCookie('doctor@docmate.ai', 'demo123');
  console.log('✓ Doctor authenticated');

  const caseId = await getCaseId();
  if (!caseId) {
    throw new Error('No case found in database');
  }
  console.log(`✓ Testing with case: ${caseId}`);

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

  // 1. Visit case workspace
  console.log(`1. Visiting /bn/cases/${caseId}...`);
  await page.goto(`${BASE_URL}/bn/cases/${caseId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Take screenshot 1: Deduplicated Case Workspace (Desktop)
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_deduplicated_case_workspace_desktop.png'), fullPage: true });
  console.log('✓ 01_deduplicated_case_workspace_desktop.png captured');

  // 2. Click Differentials Tab to verify clean state
  console.log('2. Switching to Differentials tab...');
  await page.click('button[role="tab"]:has-text("সম্ভাব্য রোগসমূহ")');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_differentials_tab.png'), fullPage: true });
  console.log('✓ 02_differentials_tab.png captured');

  // 3. Switch back to Conversation Tab and switch to Mobile Viewport (390x844)
  console.log('3. Testing Mobile Viewport (390x844)...');
  await page.click('button[role="tab"]:has-text("বার্তালাপ")');
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_deduplicated_case_workspace_mobile.png'), fullPage: true });
  console.log('✓ 03_deduplicated_case_workspace_mobile.png captured');

  await browser.close();
  console.log('--- Deduplication Verification Complete! ---');
}

verifyCleanWorkspace().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
