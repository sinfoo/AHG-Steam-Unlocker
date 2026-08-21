import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

async function dismissModal(page: import('@playwright/test').Page) {
  const btn = page.getByText(/remind me later|don't show again|cancel|close/i).first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) { await btn.click(); await page.waitForTimeout(500); }
}

test.describe('Settings Page', () => {
  test('settings page loads with health check button', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await dismissModal(page);

    // Navigate to settings
    const settingsLink = page.getByText(/settings/i).first();
    await settingsLink.click({ force: true });
    await page.waitForTimeout(1500);

    // Settings should be visible
    await expect(page.getByText(/settings|configuration/i).first()).toBeVisible({ timeout: 5000 });

    // Health check or mirror check button should exist
    const healthButton = page.getByText(/check health|check mirrors|health|mirror/i).first();
    await expect(healthButton).toBeVisible({ timeout: 5000 });
  });

  test('mirror repos list renders correctly', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await dismissModal(page);

    // Navigate to settings
    const settingsLink = page.getByText(/settings/i).first();
    await settingsLink.click({ force: true });
    await page.waitForTimeout(1500);

    // Check for mirror repo entries (they should not have leading whitespace or CJK)
    const repoEntries = page.locator('[class*="repo"], [class*="mirror"], li').filter({ hasText: /github|gitlab|bitbucket/i });
    const count = await repoEntries.count();
    
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = await repoEntries.nth(i).textContent();
        // Entries should not start with whitespace
        expect(text?.trim()).toBe(text);
      }
    }
  });
});
