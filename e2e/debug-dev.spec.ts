import { test } from '@playwright/test';

test('debug dev server 500 errors', async ({ page }) => {
  // Track failed requests
  const failures: string[] = [];
  page.on('requestfailed', req => {
    failures.push(`${req.url()} => ${req.failure()?.errorText}`);
  });
  page.on('response', resp => {
    if (resp.status() >= 400) {
      failures.push(`${resp.url()} => ${resp.status()} ${resp.statusText()}`);
    }
  });

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  
  // Wait a moment, then check what loaded
  await page.waitForTimeout(3000);
  
  console.log('=== FAILURES ===');
  for (const f of failures) console.log(f);
  
  // Take screenshot
  await page.screenshot({ path: 'debug-500.png' });
  
  // Show page content
  const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500));
  console.log('Page body text:', bodyText);
});
