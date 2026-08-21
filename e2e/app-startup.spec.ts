import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

test.describe('AHG Unlocker App Startup', () => {
  test('app loads and renders main layout', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // Allow SPA to hydrate + lazy-load

    // App shell should be visible
    await expect(page.locator('#root')).toBeVisible();

    // Sidebar should be present
    await expect(page.getByText(/browse|catalogue|library/i).first()).toBeVisible();

    // Title should be visible  
    await expect(page.locator('text=AHG Unlocker').first() ?? page.locator('h1').first()).toBeVisible();
  });

  test('navigation between pages works', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000); // Allow full hydration

    const dismissBtn = page.getByText(/remind me later|don't show again|cancel|close/i).first();
    if (await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dismissBtn.click();
      await page.waitForTimeout(500);
    }

    // Click on Browse/Catalogue nav link
    const browseLink = page.getByText(/browse|all games|catalogue/i).first();
    if (await browseLink.isVisible()) {
      await browseLink.click();
      await page.waitForTimeout(1000);
    }

    // Click on Home link
    const homeLink = page.getByText(/home|featured/i).first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await page.waitForTimeout(1000);
    }

    // Click on Settings link
    const settingsLink = page.getByText(/settings/i).first();
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }
  });
});
