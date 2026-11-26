/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('@playwright/test');
const axe = require('axe-core');

async function runAudit() {
  const base = process.env.DOCMATE_QA_BASE_URL || 'http://localhost:3000';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  console.log('Starting Axe Accessibility & Responsive Audit on:', base);
  let totalViolations = 0;

  for (const theme of ['light', 'dark']) {
    console.log(`\n--- Theme: ${theme} ---`);
    const context = await browser.newContext();
    await context.addInitScript((t) => localStorage.setItem('theme', t), theme);
    const page = await context.newPage();

    // Authenticate
    const loginRes = await context.request.post(`${base}/api/auth/login`, {
      data: { email: 'doctor@docmate.ai', password: 'demo123' },
    });
    if (!loginRes.ok()) throw new Error('Doctor login failed: ' + loginRes.status());

    // Fetch case ID
    const casesRes = await context.request.get(`${base}/api/cases`);
    const cases = (await casesRes.json()).cases;
    const caseId = cases[0]?.id;

    const routes = [
      '/en/login',
      '/en/dashboard',
      '/en/cases',
      ...(caseId ? [`/en/cases/${caseId}`] : []),
      '/en/library',
      '/en/ask',
      '/bn/dashboard',
      ...(caseId ? [`/bn/cases/${caseId}`] : []),
    ];

    for (const route of routes) {
      await page.goto(base + route);
      await page.waitForLoadState('networkidle');
      await page.addScriptTag({ content: axe.source });

      const violations = await page.evaluate(async () => {
        const { violations } = await window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          },
        });
        return violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodesCount: v.nodes.length,
        }));
      });

      console.log(`  Route: ${route} [${theme}] -> Violations: ${violations.length}`);
      if (violations.length > 0) {
        totalViolations += violations.length;
        for (const v of violations) {
          console.log(`    - [${v.impact}] ${v.id}: ${v.description} (${v.nodesCount} nodes)`);
        }
      }
    }

    // Viewport and overflow check
    for (const width of [390, 768, 1280]) {
      for (const locale of ['en', 'bn']) {
        await page.setViewportSize({ width, height: 900 });
        const targetUrl = `${base}/${locale}/cases/${caseId}`;
        await page.goto(targetUrl);
        await page.evaluate(() => document.fonts.ready);
        const [lang, overflow] = await page.evaluate(() => [
          document.documentElement.lang,
          Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        ]);
        console.log(`  Viewport ${width}px [${locale}] case workspace -> Lang: "${lang}", Overflow: ${overflow}px`);
        if (overflow > 1) {
          console.warn(`    ⚠️ Horizontal overflow detected: ${overflow}px at ${width}px width!`);
        }
      }
    }

    await context.close();
  }

  await browser.close();
  console.log(`\nAudit completed. Total violations: ${totalViolations}`);
  return totalViolations;
}

runAudit()
  .then((violations) => {
    process.exit(violations > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Audit failed with error:', err);
    process.exit(1);
  });
