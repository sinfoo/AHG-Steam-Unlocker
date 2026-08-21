import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function startVite() {
  const server = await createServer({
    root: projectRoot,
    server: { port: 5180, strictPort: true },
    logLevel: 'silent',
  });
  await server.listen();
  const addr = server.httpServer.address();
  const port = typeof addr === 'object' ? addr.port : 5180;
  console.log(`Vite server started on port ${port}`);
  return { server, port };
}

async function run() {
  const { server, port } = await startVite();
  const BASE = `http://localhost:${port}/`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Page loaded, waiting 15s for app to settle...');
  await page.waitForTimeout(15000);

  // Check state
  const state = await page.evaluate(() => {
    const sidebar = document.querySelector('aside');
    const ls = document.getElementById('loadingScreen');
    const animatedLs = document.querySelector('.flex.items-center.justify-center.overflow-hidden');
    const mainContent = document.querySelector('[style*="opacity"]');
    return {
      sidebarPointerEvents: sidebar ? getComputedStyle(sidebar).pointerEvents : 'no-sidebar',
      loadingScreenHidden: ls ? ls.classList.contains('hidden') : 'no-element',
      loadingScreenPointerEvents: ls ? getComputedStyle(ls).pointerEvents : 'no-element',
      animatedLoadingScreen: animatedLs ? {
        pointerEvents: getComputedStyle(animatedLs).pointerEvents,
        opacity: getComputedStyle(animatedLs).opacity,
        display: getComputedStyle(animatedLs).display,
      } : 'not-found',
      mainContent: mainContent ? {
        opacity: mainContent.style.opacity,
        pointerEvents: mainContent.style.pointerEvents,
      } : 'not-found',
    };
  });

  console.log('\n=== State after 15s ===');
  console.log(JSON.stringify(state, null, 2));

  console.log('\n=== Console output (last 50) ===');
  const last50 = logs.slice(-50);
  last50.forEach(l => console.log(l));

  await browser.close();
  await server.close();
  console.log('\nDone.');
}

run().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
