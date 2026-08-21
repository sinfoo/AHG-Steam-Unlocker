import { chromium } from 'playwright';

const BASE = 'http://localhost:5173/';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Capture console errors
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });

  console.log('=== 1. Loading the app ===');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000); // wait for splash + render

  await page.screenshot({ path: 'e2e-nav-01-splash.png', fullPage: true });
  console.log('   Splash screenshot saved');

  // Wait for main app to be visible (splash dismissed)
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    return main && main.offsetHeight > 100;
  }, { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e-nav-02-home.png', fullPage: true });
  console.log('   Home page loaded');

  // === Navigate to Browse ===
  console.log('\n=== 2. Navigate to Browse ===');
  const browseBtn = page.locator('button:has-text("Browse"), a:has-text("Browse"), nav:has-text("Browse"), [class*="nav"]:has-text("Browse")').first();
  const browseCount = await browseBtn.count();
  console.log(`   Found ${browseCount} Browse buttons`);
  
  // Try finding sidebar nav buttons
  const navButtons = page.locator('aside button, nav button, [class*="sidebar"] button, [class*="nav-item"]');
  const navCount = await navButtons.count();
  console.log(`   Found ${navCount} sidebar/nav buttons`);

  // Take a screenshot of the sidebar
  const sidebar = page.locator('aside').first();
  if (await sidebar.count() > 0) {
    await sidebar.screenshot({ path: 'e2e-nav-sidebar.png' });
    console.log('   Sidebar screenshot saved');
    
    // Get all sidebar button text
    const btnTexts = await sidebar.locator('button, a').allTextContents();
    console.log('   Sidebar buttons:', btnTexts.map(t => t.trim()).filter(Boolean));
  }

  // Click Browse via any visible nav link
  const browseLink = page.locator('text=Browse').first();
  if (await browseLink.count() > 0) {
    await browseLink.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e-nav-03-browse.png', fullPage: true });
    console.log('   Browse page screenshot saved');

    // Check if we're on Browse page
    const url = page.url();
    const html = await page.content();
    const onBrowse = html.includes('browse') || html.includes('Browse');
    console.log(`   URL: ${url}, On Browse: ${onBrowse}`);
  } else {
    console.log('   WARNING: Could not find Browse button!');
  }

  // === Navigate to Favourites ===
  console.log('\n=== 3. Navigate to Favourites ===');
  const favLink = page.locator('text=Favourites').first();
  if (await favLink.count() > 0) {
    await favLink.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e-nav-04-favourites.png', fullPage: true });
    console.log('   Favourites page screenshot saved');
  }

  // === Navigate to Fixes ===
  console.log('\n=== 4. Navigate to Fixes ===');
  const fixesLink = page.locator('text=Fixes').first();
  if (await fixesLink.count() > 0) {
    await fixesLink.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e-nav-05-fixes.png', fullPage: true });
    console.log('   Fixes page screenshot saved');
  }

  // === Navigate to Settings ===
  console.log('\n=== 5. Navigate to Settings ===');
  const settingsLink = page.locator('text=Settings').first();
  if (await settingsLink.count() > 0) {
    await settingsLink.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e-nav-06-settings.png', fullPage: true });
    console.log('   Settings page screenshot saved');
  }

  // === Rapid navigation test ===
  console.log('\n=== 6. Rapid navigation ===');
  // Navigate Home quickly
  const homeLink = page.locator('text=Home').first();
  for (let i = 0; i < 3; i++) {
    if (await fixesLink.count() > 0) await fixesLink.click();
    await page.waitForTimeout(100);
    if (await homeLink.count() > 0) await homeLink.click();
    await page.waitForTimeout(100);
    if (await settingsLink.count() > 0) await settingsLink.click();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e-nav-07-rapid.png', fullPage: true });
  console.log('   After rapid nav screenshot saved');

  console.log('\n=== Results ===');
  if (errors.length > 0) {
    console.log('Errors captured:');
    errors.forEach(e => console.log(`  - ${e}`));
  } else {
    console.log('No errors captured');
  }

  await browser.close();
  console.log('\nDone.');
}

run().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
