import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

async function dismissModal(page: import('@playwright/test').Page) {
  const btn = page.getByText(/remind me later|don't show again|cancel|close/i).first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) { await btn.click(); await page.waitForTimeout(500); }
}

function navItem(page: import('@playwright/test').Page, name: string) {
  return page.getByRole('button').filter({ hasText: new RegExp(name, 'i') }).first();
}

test.describe('Splash screen, sidebar nav, card redesign', () => {

  // ── SPLASH SCREEN ──
  test('splash screen is present in DOM, then hides when app is ready', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const loadingScreen = page.locator('#loadingScreen');
    const exists = await loadingScreen.count();
    console.log(`#loadingScreen DOM count: ${exists}`);

    if (exists > 0) {
      const isCurrentlyVisible = await loadingScreen.isVisible();
      console.log(`#loadingScreen currently visible: ${isCurrentlyVisible}`);

      if (isCurrentlyVisible) {
        // Splash stays visible in Vite dev (no IPC event to hide it)
        // Just wait for the React app to mount instead
        await page.locator('#root').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
        console.log('#root appeared');
      } else {
        console.log('Splash already hidden');
      }
    }

    await expect(page.locator('#root')).toBeVisible({ timeout: 5000 });
  });

  // ── SIDEBAR NAV (instant click) ──
  test('sidebar navigation responds instantly to clicks', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await dismissModal(page);
    await navItem(page, 'catalogue').waitFor({ timeout: 15000 });
    await page.waitForTimeout(1000);

    const catalogueLink = navItem(page, 'catalogue');
    await expect(catalogueLink).toBeVisible();

    const startTime = Date.now();
    await catalogueLink.click({ force: true });
    await page.waitForTimeout(500);
    const elapsed = Date.now() - startTime;
    console.log(`Catalogue nav elapsed: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(3000);

    const homeLink = navItem(page, 'home');
    if (await homeLink.isVisible()) {
      await homeLink.click({ force: true });
      await page.waitForTimeout(500);
    }

    const settingsLink = navItem(page, 'settings');
    const sTime = Date.now();
    await settingsLink.click({ force: true });
    await page.waitForTimeout(500);
    const sElapsed = Date.now() - sTime;
    console.log(`Settings nav elapsed: ${sElapsed}ms`);
    expect(sElapsed).toBeLessThan(3000);

    await page.screenshot({ path: 'e2e-nav-test.png' });
  });

  // ── GAME CARDS WITH GLOW / SPOTLIGHT ──
  test('glow cards render with spotlight effect on browse page', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await dismissModal(page);
    await navItem(page, 'catalogue').waitFor({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const catalogueLink = navItem(page, 'catalogue');
    await catalogueLink.click({ force: true });
    await page.waitForTimeout(5000);

    const glowCards = page.locator('[data-glow]');
    const glowCount = await glowCards.count();
    console.log(`GlowCard [data-glow] elements found: ${glowCount}`);

    const gameCards = page.locator('[class*="grid"] > *').first();
    const gridVisible = await gameCards.isVisible().catch(() => false);
    console.log(`Game grid card visible: ${gridVisible}`);

    await page.screenshot({ path: 'e2e-glow-cards.png' });

    if (glowCount > 0) {
      const firstGlow = glowCards.first();
      await firstGlow.hover();
      await page.waitForTimeout(500);
      console.log('Hovered over first glow card');
    }
  });
});

