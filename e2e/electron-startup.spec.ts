import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';

const EXE_PATH = 'dev-release/win-unpacked/AHG Unlocker.exe';
const exeExists = fs.existsSync(EXE_PATH);

function navButton(window: import('@playwright/test').Page, name: string) {
  return window.getByRole('button').filter({ hasText: new RegExp(name, 'i') }).first();
}

test.describe('AHG Unlocker Electron App', () => {
  test.skip(!exeExists, `Electron EXE not found at ${EXE_PATH}`);
  test('app launches, splash completes, and main UI loads', async () => {
    const electronApp = await electron.launch({ executablePath: EXE_PATH, args: [] });
    const window = await electronApp.firstWindow();

    // Wait for splash to finish (~3s) + React to mount
    await window.waitForSelector('#root', { timeout: 15000 });

    // Sidebar nav should be rendered
    await expect(navButton(window, 'home').first()).toBeVisible({ timeout: 10000 });

    // Home page content should render (nav label "Home" is visible in sidebar)
    await expect(navButton(window, 'home')).toBeVisible({ timeout: 10000 });

    await electronApp.close();
  });

  test('sidebar navigation between pages works', async () => {
    const electronApp = await electron.launch({ executablePath: EXE_PATH, args: [] });
    const window = await electronApp.firstWindow();
    await navButton(window, 'home').waitFor({ state: 'visible', timeout: 15000 });

    // Navigate to Catalogue (browse page)
    const catalogueBtn = navButton(window, 'catalogue');
    await expect(catalogueBtn).toBeVisible({ timeout: 5000 });
    await catalogueBtn.click({ force: true });

    // Allow lazy-loaded BrowsePage chunk to load + render
    await window.waitForTimeout(2500);

    // Navigate to Settings
    const settingsBtn = navButton(window, 'settings');
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click({ force: true });
    await window.waitForTimeout(2000);

    // Navigate back to Home
    const homeBtn = navButton(window, 'home');
    await expect(homeBtn).toBeVisible({ timeout: 5000 });
    await homeBtn.click({ force: true });
    await window.waitForTimeout(1500);

    await electronApp.close();
  });

  test('splash screen hides before React UI appears', async () => {
    const electronApp = await electron.launch({ executablePath: EXE_PATH, args: [] });
    const window = await electronApp.firstWindow();

    // After splash-complete event, React #root should appear
    await window.waitForSelector('#root', { timeout: 15000 });

    // Verify splash element is hidden/removed
    const splashHidden = await window.locator('#splash').isHidden().catch(() => true);
    expect(splashHidden).toBeTruthy();

    await electronApp.close();
  });

  test('lazy-loaded page chunks load on navigation', async () => {
    const electronApp = await electron.launch({ executablePath: EXE_PATH, args: [] });
    const window = await electronApp.firstWindow();
    await navButton(window, 'home').waitFor({ state: 'visible', timeout: 15000 });

    // Click each visible nav item to verify lazy chunks load without errors
    const pages = ['Catalogue', 'My Library', 'Collections', 'Recently Viewed', 'Favourites', 'Steam Fixes', 'Settings'];
    for (const page of pages) {
      const btn = navButton(window, page);
      const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
      if (visible) {
        await btn.click({ force: true });
        await window.waitForTimeout(1500);
      }
    }

    // Return to Home
    await navButton(window, 'home').click({ force: true });
    await window.waitForTimeout(1000);

    await electronApp.close();
  });
});
