/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

const ROLES = [
  {
    role: 'doctor',
    email: 'doctor@docmate.ai',
    password: 'demo123',
    expectedHome: '/bn/dashboard',
    routes: [
      '/bn/dashboard',
      '/en/dashboard',
      '/bn/patients',
      '/bn/patients/new',
      '/bn/prescriptions',
      '/bn/prescriptions/new',
      '/bn/cases',
      '/bn/cases/new',
      '/bn/library',
      '/bn/ask',
      '/bn/settings',
      '/bn/study',
      '/bn/research',
    ],
  },
  {
    role: 'super_admin',
    email: 'admin@docmate.ai',
    password: 'demo123',
    expectedHome: '/bn/admin',
    routes: [
      '/bn/admin',
      '/bn/admin/users',
      '/bn/admin/patients',
      '/bn/admin/plans',
      '/bn/admin/access',
      '/bn/admin/audit',
      '/bn/admin/ai',
      '/bn/admin/library',
      '/bn/dashboard',
      '/bn/patients',
      '/bn/prescriptions',
      '/bn/cases',
      '/bn/library',
      '/bn/ask',
      '/bn/settings',
      '/bn/controller',
      '/bn/portal',
      '/bn/study',
      '/bn/research',
    ],
  },
  {
    role: 'student',
    email: 'student@docmate.ai',
    password: 'demo123',
    expectedHome: '/bn/study',
    routes: [
      '/bn/study',
      '/bn/library',
      '/bn/ask',
      '/bn/settings',
    ],
  },
  {
    role: 'researcher',
    email: 'researcher@docmate.ai',
    password: 'demo123',
    expectedHome: '/bn/research',
    routes: [
      '/bn/research',
      '/bn/library',
      '/bn/ask',
      '/bn/settings',
    ],
  },
  {
    role: 'medicine_controller',
    email: 'controller@docmate.ai',
    password: 'demo123',
    expectedHome: '/bn/controller',
    routes: [
      '/bn/controller',
      '/bn/library',
      '/bn/ask',
      '/bn/settings',
    ],
  },
  {
    role: 'patient',
    email: 'patient@docmate.ai',
    password: 'demo123',
    expectedHome: '/bn/portal',
    routes: [
      '/bn/portal',
      '/bn/prescriptions',
      '/bn/settings',
    ],
  },
];

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

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

async function runAudit() {
  console.log('--- Starting Next.js Production Server for Audit ---');

  // Check if Next.js server is already running on port
  let nextServer = null;
  let isRunning = false;
  try {
    const res = await fetch(`${BASE_URL}/bn/login`);
    if (res.status < 500) isRunning = true;
  } catch {}

  if (!isRunning) {
    console.log('Spawning Next.js server child process on port', PORT);
    nextServer = spawn('./node_modules/.bin/next', ['start', '-p', String(PORT)], {
      stdio: 'pipe',
    });

    nextServer.stderr.on('data', (d) => process.stderr.write(d));
    nextServer.on('error', (err) => console.error('Next server error:', err));

    console.log('Waiting for Next.js server to be ready on port', PORT);
    await waitForServer(`${BASE_URL}/bn/login`);
    console.log('✓ Next.js server is ready!');
  } else {
    console.log('✓ Next.js server is already running on port', PORT);
  }

  const cleanup = () => {
    if (nextServer) {
      try {
        nextServer.kill('SIGTERM');
      } catch {}
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const allIssues = [];

  for (const user of ROLES) {
    console.log(`\n==============================================`);
    console.log(`Auditing Role: [${user.role}] (${user.email})`);
    console.log(`==============================================`);

    let sessionToken;
    try {
      sessionToken = await getSessionCookie(user.email, user.password);
      console.log(`✓ Obtained session cookie`);
    } catch (e) {
      console.error(`✗ Could not obtain session cookie: ${e.message}`);
      allIssues.push({ role: user.role, error: e.message });
      continue;
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    await context.addCookies([
      {
        name: 'docmate_session',
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    const page = await context.newPage();

    for (const route of user.routes) {
      const pageErrors = [];
      const consoleErrors = [];
      const failedRequests = [];

      const pageErrorHandler = (err) => pageErrors.push(err.message || String(err));
      const consoleHandler = (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('Failed to load resource: the server responded with a status of 404')) {
            consoleErrors.push(text);
          }
        }
      };
      const responseHandler = (res) => {
        if (res.status() >= 500 || (res.status() === 404 && res.url().includes('_next/static'))) {
          failedRequests.push(`${res.status()} ${res.url()}`);
        }
      };

      page.on('pageerror', pageErrorHandler);
      page.on('console', consoleHandler);
      page.on('response', responseHandler);

      try {
        const fullUrl = `${BASE_URL}${route}`;
        const response = await page.goto(fullUrl, { waitUntil: 'load', timeout: 12000 });
        await page.waitForTimeout(600);

        const status = response ? response.status() : 'no-response';
        const bodyText = await page.locator('body').innerText();

        const hasCouldNotLoad = bodyText.includes('This page couldn') ||
                                bodyText.includes('Reload to try again') ||
                                bodyText.includes('পৃষ্ঠাটি লোড হতে সমস্যা হয়েছে');

        if (hasCouldNotLoad || status >= 500 || failedRequests.length > 0) {
          console.error(`  ❌ FAILED: ${route} [status: ${status}] shows "This page couldn’t load" or failed requests: ${failedRequests.join(', ')}`);
          allIssues.push({
            role: user.role,
            url: route,
            status,
            error: 'Shows "This page couldn’t load" or asset failure',
            failedRequests: [...failedRequests],
            pageErrors: [...pageErrors],
            consoleErrors: [...consoleErrors],
          });
        } else if (pageErrors.length > 0) {
          console.error(`  ❌ RUNTIME ERROR on ${route}: ${pageErrors.join(' | ')}`);
          allIssues.push({
            role: user.role,
            url: route,
            status,
            error: `Page runtime error: ${pageErrors.join(' | ')}`,
          });
        } else {
          console.log(`  ✓ PASSED: ${route} [status: ${status}]`);
        }
      } catch (err) {
        console.error(`  ❌ EXCEPTION on ${route}: ${err.message}`);
        allIssues.push({
          role: user.role,
          url: route,
          error: err.message,
        });
      } finally {
        page.off('pageerror', pageErrorHandler);
        page.off('console', consoleHandler);
        page.off('response', responseHandler);
      }
    }

    await context.close();
  }

  // Check unauthenticated visitor
  console.log(`\n==============================================`);
  console.log(`Auditing Unauthenticated Access`);
  console.log(`==============================================`);
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  try {
    await anonPage.goto(`${BASE_URL}/`, { waitUntil: 'load' });
    console.log(`  ✓ Root / navigated to: ${anonPage.url()}`);

    await anonPage.goto(`${BASE_URL}/bn/login`, { waitUntil: 'load' });
    const text = await anonPage.locator('body').innerText();
    if (text.includes('This page couldn')) {
      console.error(`  ❌ Login page failed with error`);
      allIssues.push({ role: 'anon', url: '/bn/login', error: 'Login shows error' });
    } else {
      console.log(`  ✓ /bn/login passed cleanly`);
    }

    await anonPage.goto(`${BASE_URL}/en/login`, { waitUntil: 'load' });
    const textEn = await anonPage.locator('body').innerText();
    if (textEn.includes('This page couldn')) {
      console.error(`  ❌ Login EN page failed with error`);
      allIssues.push({ role: 'anon', url: '/en/login', error: 'Login EN shows error' });
    } else {
      console.log(`  ✓ /en/login passed cleanly`);
    }
  } catch (e) {
    allIssues.push({ role: 'anon', error: e.message });
  }
  await anonContext.close();

  await browser.close();
  cleanup();

  console.log('\n==============================================');
  console.log('               AUDIT RESULTS                  ');
  console.log('==============================================');
  if (allIssues.length === 0) {
    console.log('🎉 100% CLEAN: All routes across all roles rendered with 0 errors and NO "This page couldn’t load"!');
  } else {
    console.log(`❌ ENCOUNTERED ${allIssues.length} ISSUES:`);
    console.log(JSON.stringify(allIssues, null, 2));
  }

  process.exit(allIssues.length > 0 ? 1 : 0);
}

runAudit().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
