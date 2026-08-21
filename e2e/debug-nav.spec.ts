import { test } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

async function dismissModal(page: import('@playwright/test').Page) {
  const btn = page.getByText(/remind me later|don't show again|cancel|close/i).first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) { await btn.click(); await page.waitForTimeout(500); }
}

test('debug nav via dev server', async ({ page }) => {
  // Collect console logs
  const logs: string[] = [];
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') console.log('REALTIME ERROR:', msg.text());
  });
  page.on('pageerror', err => {
    logs.push(`[PAGE ERROR] ${err.message}`);
    console.log('REALTIME PAGEERROR:', err.message);
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await dismissModal(page);
  console.log('Page loaded');

  const catalogueBtn = page.getByText(/catalogue|browse|all games/i).first();
  await catalogueBtn.waitFor({ state: 'visible', timeout: 15000 });
  console.log('Sidebar nav visible');

  await page.waitForTimeout(1000);

  console.log('Clicking Catalogue...');
  await catalogueBtn.click({ force: true });
  await page.waitForTimeout(3000);

  console.log('=== Console log dump ===');
  for (const log of logs) {
    console.log(log);
  }
  console.log('=== End console dump ===');

  await page.screenshot({ path: 'debug-nav.png' });
  console.log('Screenshot taken');
});
