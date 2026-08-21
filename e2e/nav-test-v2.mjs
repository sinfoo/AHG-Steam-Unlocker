import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function startVite() {
  const server = await createServer({
    root: projectRoot,
    server: { port: 5175, strictPort: true },
    logLevel: 'silent',
  });
  await server.listen();
  const addr = server.httpServer.address();
  const port = typeof addr === 'object' ? addr.port : 5175;
  console.log(`Vite server started on port ${port}`);
  return { server, port };
}

async function run() {
  const { server, port } = await startVite();
  const BASE = `http://localhost:${port}/`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(`[error] ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
    if (msg.text().includes('hide-splash') || msg.text().includes('main')) console.log(`   CONSOLE: ${msg.text()}`);
  });

  try {
    // ── 1. Load the app ──
    console.log('\n=== 1. Loading the app ===');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('   Page loaded, waiting for app to become interactive...');

    // Wait for the HTML #loadingScreen to be dismissed
    // (It gets the .hidden class when hide-splash fires on React mount)
    await page.waitForFunction(() => {
      const ls = document.getElementById('loadingScreen');
      return ls && (ls.classList.contains('hidden') || getComputedStyle(ls).opacity === '0');
    }, { timeout: 15000 }).catch(() => console.log('   WARNING: #loadingScreen did not get hidden class'));
    console.log('   HTML loading screen dismissed');

    // Whacky: wait for AnimatedLoadingScreen to stop covering the sidebar
    // showMainApp -> true means sidebar gets pointerEvents: auto
    await page.waitForFunction(() => {
      const sidebar = document.querySelector('aside');
      if (!sidebar) return false;
      const style = getComputedStyle(sidebar);
      return style.pointerEvents !== 'none';
    }, { timeout: 60000 }).catch(() => console.log('   WARNING: sidebar still has pointer-events:none'));
    console.log('   App is fully interactive');

    await page.screenshot({ path: 'e2e-v2-01-loaded.png', fullPage: true });
    console.log('   Screenshot: loaded state');

    // ── 2. Verify HTML loading screen has pointer-events: none ──
    const lsPointerEvents = await page.evaluate(() => {
      const ls = document.getElementById('loadingScreen');
      return ls ? getComputedStyle(ls).pointerEvents : 'not-found';
    });
    console.log(`   #loadingScreen pointer-events: ${lsPointerEvents}`);

    // ── 3. Navigate through each page ──
    const pages = ['Browse', 'Favourites', 'Fixes', 'Settings', 'Home'];
    for (const pageName of pages) {
      console.log(`\n=== Navigating to ${pageName} ===`);
      const link = page.locator(`button:has-text("${pageName}"), a:has-text("${pageName}")`).first();
      const count = await link.count();
      console.log(`   Found ${count} link(s) for "${pageName}"`);
      if (count > 0) {
        await link.click({ timeout: 10000 });
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `e2e-v2-${pageName.toLowerCase()}.png`, fullPage: true });
        console.log(`   Screenshot: ${pageName}`);
      }
    }

    // ── 4. Quick back-and-forth nav test ──
    console.log('\n=== 4. Rapid navigation test ===');
    const homeBtn = page.locator('button:has-text("Home"), a:has-text("Home")').first();
    const browseBtn = page.locator('button:has-text("Browse"), a:has-text("Browse")').first();
    const fixesBtn = page.locator('button:has-text("Steam Fixes"), button:has-text("Fixes"), a:has-text("Fixes")').first();

    for (let i = 0; i < 5; i++) {
      if (await browseBtn.count() > 0) { await browseBtn.click({ timeout: 5000 }); await page.waitForTimeout(100); }
      if (await homeBtn.count() > 0) { await homeBtn.click({ timeout: 5000 }); await page.waitForTimeout(100); }
      if (await fixesBtn.count() > 0) await fixesBtn.click({ timeout: 5000 }).catch(() => {});
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e-v2-rapid.png', fullPage: true });
    console.log('   After rapid nav: OK');

    // ── 5. Check page content after navigation ──
    console.log('\n=== 5. Content verification ===');
    const content = await page.content();
    const activePage = content.match(/currentPage['":]\s*['"]([^'"]+)/);
    console.log(`   currentPage from state: ${activePage ? activePage[1] : 'unknown'}`);

    // Check DOM for any visible error states
    const errCount = await page.locator('text=Error, text=crash, text=undefined').count();
    console.log(`   Error indicators visible: ${errCount}`);

  } finally {
    console.log('\n=== RESULTS ===');
    if (errors.length > 0) {
      console.log(`Errors captured (${errors.length}):`);
      errors.forEach(e => console.log(`  - ${e}`));
    } else {
      console.log('No errors captured ✓');
    }

    await browser.close();
    await server.close();
    console.log('\nDone.');
  }
}

run().catch(err => {
  console.error('FAILED:', err.message, err.stack);
  process.exit(1);
});
