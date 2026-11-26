/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/apple/.gemini/antigravity/brain/ad634b59-ee6b-4b56-8377-ac1fd6d7a0f3/human_persona_evidence';
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

async function verifyHumanPersona() {
  console.log('--- Starting Human-Centric Persona & Assistant Verification ---');
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const sessionToken = await getSessionCookie('admin@docmate.ai', 'demo123');
  console.log('✓ Admin authenticated successfully');

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop View (1280px) - Admin Voice & Phrase Bank Governance
    console.log('1. Testing Desktop Admin Voice Governance (/bn/admin/voice) at 1280px...');
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

    const pageDesktop = await desktopContext.newPage();
    await pageDesktop.goto(`${BASE_URL}/bn/admin/voice`, { waitUntil: 'networkidle' });

    // Verify tabs
    await pageDesktop.waitForSelector('button[role="tab"]');
    const tabsCount = await pageDesktop.locator('button[role="tab"]').count();
    console.log(`✓ Admin Voice Page loaded with ${tabsCount} navigation tabs`);

    // Screenshot 1: Overview & Metrics
    const screenshot1 = path.join(ARTIFACT_DIR, '01_admin_voice_overview_1280.png');
    await pageDesktop.screenshot({ path: screenshot1, fullPage: true });
    console.log(`✓ Saved ${screenshot1}`);

    // Click Phrase Bank Tab
    console.log('2. Testing Phrase Bank Governance Tab...');
    const phrasebankTab = pageDesktop.locator('button[role="tab"]:has-text("ফ্রেজ ব্যাংক")');
    if (await phrasebankTab.isVisible()) {
      await phrasebankTab.click();
      await pageDesktop.waitForTimeout(1000);
      const screenshot2 = path.join(ARTIFACT_DIR, '02_admin_phrasebank_tab_1280.png');
      await pageDesktop.screenshot({ path: screenshot2, fullPage: true });
      console.log(`✓ Saved ${screenshot2}`);
    }

    // Click Persona & Avatar Tab and test interactive reaction pill
    console.log('3. Testing Persona & Avatar Tab...');
    const personaTab = pageDesktop.locator('button[role="tab"]:has-text("পারসোনা")');
    if (await personaTab.isVisible()) {
      await personaTab.click();
      await pageDesktop.waitForTimeout(600);
      // Click 'understood' reaction button
      const understoodBtn = pageDesktop.locator('button:has-text("understood")');
      if (await understoodBtn.isVisible()) {
        await understoodBtn.click();
        await pageDesktop.waitForTimeout(500);
      }
      const screenshot3 = path.join(ARTIFACT_DIR, '03_admin_persona_avatar_1280.png');
      await pageDesktop.screenshot({ path: screenshot3, fullPage: true });
      console.log(`✓ Saved ${screenshot3}`);
    }

    // 2. Tablet View (768px) - Settings Assistant Card
    console.log('4. Testing Tablet View (/bn/settings) at 768px...');
    const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    await tabletContext.addCookies([
      {
        name: 'docmate_session',
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const pageTablet = await tabletContext.newPage();
    await pageTablet.goto(`${BASE_URL}/bn/settings`, { waitUntil: 'networkidle' });

    await pageTablet.waitForSelector('text=সহকারী ব্যক্তিগতকরণ');
    const screenshot4 = path.join(ARTIFACT_DIR, '04_assistant_settings_tablet_768.png');
    await pageTablet.screenshot({ path: screenshot4, fullPage: true });
    console.log(`✓ Saved ${screenshot4}`);

    // 3. Mobile View (390px) - Case Conversation Tab & Empty State
    console.log('5. Testing Mobile View at 390px (/bn/cases/7e5eb7d8-f801-4ff1-bbc8-2fdde329fd0d)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
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
    await pageMobile.goto(`${BASE_URL}/bn/cases/7e5eb7d8-f801-4ff1-bbc8-2fdde329fd0d`, { waitUntil: 'networkidle' });

    // Click consultation / chat tab if present
    const chatTab = pageMobile.locator('button[role="tab"]:has-text("পরামর্শ")');
    if (await chatTab.isVisible()) {
      await chatTab.click();
      await pageMobile.waitForTimeout(800);
    }

    const screenshot5 = path.join(ARTIFACT_DIR, '05_case_chat_mobile_390.png');
    await pageMobile.screenshot({ path: screenshot5, fullPage: true });
    console.log(`✓ Saved ${screenshot5}`);

    console.log('--- All Human-Centric Persona Visual Tests Completed Successfully! ---');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

verifyHumanPersona();
