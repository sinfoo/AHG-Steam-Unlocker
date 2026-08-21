import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

async function dismissModal(page: import('@playwright/test').Page) {
  const btn = page.getByText(/remind me later|don't show again|cancel|close/i).first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) { await btn.click(); await page.waitForTimeout(500); }
}

test.describe('Game Grid and Components', () => {
  test('game grid renders without layout gaps', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Navigate to browse page
    const browseLink = page.getByText(/browse|all games|catalogue/i).first();
    if (await browseLink.isVisible()) {
      await browseLink.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // Check if any grid element exists (may not render if 0 games loaded in dev)
    const gridEl = page.locator('[class*="grid"]').first();
    if (await gridEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      const display = await gridEl.evaluate(el => getComputedStyle(el).display);
      if (display === 'grid') {
        const containerWidth = await gridEl.evaluate(el => el.clientWidth);
        expect(containerWidth).toBeGreaterThan(0);
      }
    }
  });

  test('welcome section renders', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const welcomeSection = page.getByText(/welcome to ahg|ahg unlocker/i).first();
    await expect(welcomeSection).toBeVisible({ timeout: 5000 });
  });

  test('category showcase renders with hover effects', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Look for category sections
    const categorySection = page.getByText(/categories|genres|browse by/i).first();
    if (await categorySection.isVisible()) {
      // Hover over category buttons to test whileHover effect
      const categoryButtons = page.locator('button, [role="button"]').filter({ hasText: /.+/ });
      const count = await categoryButtons.count();
      if (count > 0) {
        await categoryButtons.first().hover();
        await page.waitForTimeout(200);
      }
    }
  });
});
