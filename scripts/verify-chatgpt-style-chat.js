/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const path = require('path');
const { Pool } = require('pg');

const ARTIFACT_DIR = '/Users/apple/.gemini/antigravity/brain/ad634b59-ee6b-4b56-8377-ac1fd6d7a0f3/chatgpt_style_evidence';
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

async function verifyChatGPTStyleChat() {
  console.log('--- Starting ChatGPT Style Doctor Chat Verification ---');
  const sessionToken = await getSessionCookie('doctor@docmate.ai', 'demo123');
  console.log('✓ Doctor authenticated');

  const caseId = await getCaseId();
  if (!caseId) {
    throw new Error('No case found in database');
  }
  console.log(`✓ Using case: ${caseId}`);

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

  // 2. Ask a question via the bottom input bar
  console.log('2. Submitting clinical inquiry via bottom input bar...');
  await page.fill('textarea[placeholder*="পর্যবেক্ষণ"]', 'কমিউনিটি-অ্যাকওয়ার্ড নিউমোনিয়া (CAP) চিকিৎসার প্রটোকল ও ডায়াগনস্টিক ধাপ কী?');
  await page.click('button[aria-label*="পাঠান"], button:has-text("পাঠান")');
  console.log('Waiting for AI response turn...');
  await page.waitForTimeout(3500);

  // Take screenshot 1: ChatGPT-style natural question asking & suggestion pills
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_chatgpt_style_conversational_questions.png'), fullPage: true });
  console.log('✓ 01_chatgpt_style_conversational_questions.png captured');

  // 3. Click one of the ChatGPT-style quick reply suggestion pills
  console.log('3. Clicking ChatGPT-style quick reply pill...');
  const suggestionPill = page.locator('button:has-text("ক্রেপিটেশন বিদ্যমান"), button:has-text("স্বাভাবিক"), button:has-text("হুইজ")').last();
  if (await suggestionPill.count() > 0) {
    const pillText = await suggestionPill.textContent();
    console.log(`Clicking pill: ${pillText.trim()}`);
    await suggestionPill.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_chatgpt_style_pill_replied.png'), fullPage: true });
    console.log('✓ 02_chatgpt_style_pill_replied.png captured');
  } else {
    console.log('No suggestion pill found');
  }

  // 4. Test Mobile Responsive View (390x844 iPhone)
  console.log('4. Testing Mobile Viewport (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_chatgpt_style_mobile.png'), fullPage: true });
  console.log('✓ 03_chatgpt_style_mobile.png captured');

  await browser.close();
  console.log('--- ChatGPT Style Doctor Chat Verification Succeeded! ---');
}

verifyChatGPTStyleChat().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
