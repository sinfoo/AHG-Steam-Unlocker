import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function startVite() {
  const server = await createServer({
    root: projectRoot,
    server: { port: 5174, strictPort: true }, // avoid conflict with existing 5173
    logLevel: 'silent',
  });
  await server.listen();
  const addr = server.httpServer.address();
  const port = typeof addr === 'object' ? addr.port : 5174;
  console.log(`Vite server started on port ${port}`);
  return { server, port };
}

async function runTest() {
  const { server, port } = await startVite();
  const BASE = `http://localhost:${port}/`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });

  try {
    // === 1. Load the app ===
    console.log('\n=== 1. Loading the app ===');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e-nav-01-splash.png', fullPage: true });
    console.log('   Splash screenshot saved');

    // Wait for splash to dismiss (main content becomes visible)
    await page.waitForFunction(() => {
      const main = document.querySelector('main');
      return main && main.offsetHeight > 100;
    }, { timeout: 30000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e-nav-02-home.png', fullPage: true });
    console.log('   Home page loaded');

    // === 2. Identify navigation ===
    console.log('\n=== 2. Navigation structure ===');
    const sidebar = page.locator('aside').first();
    if (await sidebar.count() > 0) {
      const btnTexts = await sidebar.locator('button, a').allTextContents();
      console.log('   Sidebar nav items:', btnTexts.map(t => t.trim()).filter(Boolean));
    }

    // === 3. Navigate through pages ===
    const pages = ['Browse', 'Favourites', 'Fixes', 'Settings', 'Home'];
    for (const pageName of pages) {
      console.log(`\n=== Navigating to ${pageName} ===`);
      const link = page.locator(`text=${pageName}`).first();
      if (await link.count() > 0) {
        await link.click();
        await page.waitForTimeout(1200); // wait for transition
        await page.screenshot({ path: `e2e-nav-${pageName.toLowerCase()}.png`, fullPage: true });
        console.log(`   ${pageName} page screenshot saved`);
      } else {
        console.log(`   WARNING: ${pageName} button not found`);
      }
    }

    // === 4. Rapid navigation test ===
    console.log('\n=== 4. Rapid navigation (3 cycles) ===');
    const btns = pages.filter(p => p !== 'Home').map(p => page.locator(`text=${p}`).first());
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const btn of btns) {
        if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(80); }
      }
      const home = page.locator('text=Home').first();
      if (await home.count() > 0) { await home.click(); await page.waitForTimeout(80); }
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e-nav-07-rapid.png', fullPage: true });
    console.log('   After rapid nav saved');

    // === 5. Check page content after navigation ===
    console.log('\n=== 5. Current page verification ===');
    const content = await page.content();
    const activePage = content.match(/currentPage['":]\s*['"]([^'"]+)/);
    console.log(`   Current page from state: ${activePage ? activePage[1] : 'unknown'}`);

    // Check no visible errors
    const errorElements = await page.locator('text=Error, text=error, text=undefined').count();
    console.log(`   Error elements visible: ${errorElements}`);

  } finally {
    console.log('\n=== Results ===');
    if (errors.length > 0) {
      console.log('Errors captured:');
      errors.forEach(e => console.log(`  - ${e}`));
    } else {
      console.log('No errors captured');
    }

    await browser.close();
    await server.close();
    console.log('\nDone.');
  }
}

runTest().catch(err => {
  console.error('FAILED:', err.message, err.stack);
  process.exit(1);
});
