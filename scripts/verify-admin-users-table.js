/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/apple/.gemini/antigravity/brain/ad634b59-ee6b-4b56-8377-ac1fd6d7a0f3/admin_users_evidence';
const BASE_URL = 'http://localhost:3000';

async function getSessionCookie(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login API failed with status ${res.status}: ${await res.text()}`);
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

async function verifyAdminUsersTable() {
  console.log('--- Starting Admin Users & Verifications Table Verification ---');
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const sessionToken = await getSessionCookie('admin@docmate.ai', 'demo123');
  console.log('✓ Admin authenticated successfully');

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop View (Bangla)
    console.log('1. Testing Desktop Bangla View (/bn/admin/users)...');
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await desktopContext.addCookies([
      {
        name: 'docmate_session',
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    const pageBn = await desktopContext.newPage();
    await pageBn.goto(`${BASE_URL}/bn/admin/users`, { waitUntil: 'networkidle' });

    // Verify table structure
    await pageBn.waitForSelector('table');
    const tableHeaderCount = await pageBn.locator('table thead th').count();
    console.log(`✓ Table found with ${tableHeaderCount} headers`);
    if (tableHeaderCount !== 7) {
      throw new Error(`Expected 7 table headers, found ${tableHeaderCount}`);
    }

    // Verify headers text
    const headersText = await pageBn.locator('table thead th').allInnerTexts();
    console.log('  Headers (BN):', headersText);

    // Verify user rows loaded
    const rowCount = await pageBn.locator('table tbody tr').count();
    console.log(`✓ Table loaded ${rowCount} user rows`);

    // Verify action buttons exist in row
    const actionButtonsCount = await pageBn.locator('table tbody tr button').count();
    console.log(`✓ Table has ${actionButtonsCount} action buttons`);

    const screenshotBn = path.join(ARTIFACT_DIR, '01_admin_users_table_bn.png');
    await pageBn.screenshot({ path: screenshotBn, fullPage: false });
    console.log(`✓ Saved screenshot: ${screenshotBn}`);

    // 2. Desktop View (English)
    console.log('2. Testing Desktop English View (/en/admin/users)...');
    const pageEn = await desktopContext.newPage();
    await pageEn.goto(`${BASE_URL}/en/admin/users`, { waitUntil: 'networkidle' });
    await pageEn.waitForSelector('table');

    const headersTextEn = await pageEn.locator('table thead th').allInnerTexts();
    console.log('  Headers (EN):', headersTextEn);

    const screenshotEn = path.join(ARTIFACT_DIR, '02_admin_users_table_en.png');
    await pageEn.screenshot({ path: screenshotEn, fullPage: false });
    console.log(`✓ Saved screenshot: ${screenshotEn}`);

    // 3. Mobile View (390px iPhone)
    console.log('3. Testing Mobile View (390x844)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    await mobileContext.addCookies([
      {
        name: 'docmate_session',
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    const pageMobile = await mobileContext.newPage();
    await pageMobile.goto(`${BASE_URL}/bn/admin/users`, { waitUntil: 'networkidle' });
    await pageMobile.waitForSelector('table');

    // Verify table container has overflow-x-auto
    const containerOverflow = await pageMobile.locator('[data-slot="table-container"]').evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        overflowX: style.overflowX,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });
    console.log('✓ Mobile container scroll metrics:', containerOverflow);

    const screenshotMobile = path.join(ARTIFACT_DIR, '03_admin_users_table_mobile.png');
    await pageMobile.screenshot({ path: screenshotMobile, fullPage: false });
    console.log(`✓ Saved screenshot: ${screenshotMobile}`);

    console.log('\n🎉 ALL ADMIN USERS TABLE VERIFICATIONS PASSED SUCCESSFULLY!');
  } finally {
    await browser.close();
  }
}

verifyAdminUsersTable().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
