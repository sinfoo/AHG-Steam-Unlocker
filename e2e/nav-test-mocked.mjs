import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

/* ── Mock games data (minimal) ── */
const MOCK_GAMES = Array.from({ length: 50 }, (_, i) => ({
  appid: String(100000 + i),
  name: `Test Game ${i + 1}`,
  platform: ['win'],
  genre: i % 3 === 0 ? 'Action' : i % 3 === 1 ? 'RPG' : 'Strategy',
  cover: null,
  header: null,
}));

/* ── Mock fixes data ── */
const MOCK_FIXES = {
  "100000": { label: "Test Fix", working: true, test: "passed" },
};

async function startVite() {
  const server = await createServer({
    root: projectRoot,
    server: { port: 5181, strictPort: true },
    logLevel: 'silent',
  });
  await server.listen();
  const addr = server.httpServer.address();
  const port = typeof addr === 'object' ? addr.port : 5181;
  console.log(`Vite server started on port ${port}`);
  return { server, port };
}

async function run() {
  const { server, port } = await startVite();
  const BASE = `http://localhost:${port}/`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  /* Inject bridge mock BEFORE any page script runs */
  await context.addInitScript((mockData) => {
    window.electronAPI = {
      platform: 'win32',
      isPackaged: false,

      // ── Core Loading ──
      loadGames: async () => mockData.games,
      loadFixes: async () => mockData.fixes,
      loadCachedGames: async () => ({ found: false }),
      readCachedGames: async () => ({ found: true, data: mockData.games }),
      saveCachedGames: async () => ({ success: true }),
      filterGamesByPlatform: async (platform) => mockData.games.filter(g => g.platform.includes(platform)),

      // ── Favorites / Recent ──
      loadFavorites: async () => [],
      saveFavorites: async () => ({ success: true }),
      loadRecent: async () => [],
      saveRecent: async () => ({ success: true }),
      getRecentlyAdded: async () => [],

      // ── Installed Games ──
      getInstalledGames: async () => ({ success: true, games: [] }),
      saveInstalled: async () => ({}),

      // ── Pinned/Owned ──
      getPinnedGames: async () => [],
      getOwnedGames: async () => [],

      // ── Search History ──
      getSearchHistory: async () => [],
      saveSearchHistory: async () => ({ success: true }),

      // ── License ──
      checkLicense: async () => ({ activated: true }),

      // ── Update ──
      checkForUpdates: async () => ({
        success: true, hasUpdate: false,
        currentVersion: '0.9.0', latestVersion: '0.9.0',
        releaseNotes: '', releaseUrl: '', downloadUrl: null, downloadSize: 0,
      }),

      // ── Misc No-ops ──
      loadUISettings: async () => ({}),
      saveUISettings: async () => ({ success: true }),
      getUserStats: async () => ({}),
      getSupportLink: async () => '',
      checkDiscordAuth: async () => ({ authenticated: false }),
      getCustomSteamConfig: async () => ({}),
      checkMirrorHealth: async () => ({ healthy: true, mirrors: [] }),
      getActivityData: async () => ({ daily: [], weekly: [], monthly: [] }),
      getLastSeenVersion: async () => null,
      openExternal: async () => ({ success: true }),
      openUrl: async () => ({ success: true }),
      restartSteam: async () => ({ success: true, message: '' }),
      scanForNewGames: async () => ({ success: true, newCount: 0 }),
      fixNoGamesStream: async () => ({ success: true, output: '' }),
      fixGamesNotShowing: async () => ({ success: true, message: '' }),
      exportLibrary: async () => ({ success: true }),
      importLibrary: async () => ({ success: true }),
      getSteamStatus: async () => ({ running: false, version: '' }),
      cancelDownload: async () => ({ success: true, aborted: 0 }),
      checkFreeGames: async () => [],
      loadGameTags: async () => [],
      getAllGameTags: async () => ({}),
      getAutoFixes: async () => ({}),

      // ── Window Controls ──
      minimizeWindow: () => {},
      maximizeWindow: () => {},
      closeWindow: () => {},
      isMaximized: async () => false,
    };
  }, { games: MOCK_GAMES, fixes: MOCK_FIXES });

  const page = await context.newPage();
  const errors = [];
  const consoleLogs = [];
  page.on('pageerror', err => errors.push(`[PAGE_ERROR] ${err.message}`));
  page.on('console', msg => {
    const text = msg.text();
    if (text.length > 200) return;
    if (msg.type() === 'error' && !text.includes('favicon')) errors.push(`[console] ${text}`);
    consoleLogs.push(text);
  });

  let pass = 0;
  let fail = 0;
  const check = (name, condition) => {
    if (condition) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}`); }
  };

  try {
    console.log('\n=== 1. App Loads Fully ===');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for the React loading overlay to exit
    // Strategy: wait until the HTML #loadingScreen is marked hidden (opacity 0)
    // and the main app content area has children (pages rendered)
    await page.waitForFunction(() => {
      const ls = document.getElementById('loadingScreen');
      const root = document.getElementById('root');
      if (!ls || !root) return false;
      const lsHidden = ls.classList.contains('hidden') || parseFloat(getComputedStyle(ls).opacity) < 0.5;
      const appHasContent = root.children.length > 0 && root.textContent && !root.textContent.includes('Loading');
      return lsHidden && appHasContent;
    }, { timeout: 25000 });
    console.log('   App fully loaded, overlay exited');

    // Wait for the main content to be fully visible
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e-01-loaded.png', fullPage: true });
    console.log('   Screenshot: loaded state');

    // Check the HTML loading screen
    const lsHidden = await page.evaluate(() => {
      const ls = document.getElementById('loadingScreen');
      return ls ? (ls.classList.contains('hidden') || getComputedStyle(ls).pointerEvents === 'none') : true;
    });
    check('HTML #loadingScreen is hidden/non-interactive', lsHidden);

    // Check AnimatedLoadingScreen is gone
    const loadingScreenGone = await page.evaluate(() => {
      const el = document.querySelector('.flex.items-center.justify-center.overflow-hidden');
      return !el || getComputedStyle(el).opacity === '0' || getComputedStyle(el).display === 'none';
    });
    check('AnimatedLoadingScreen is fully gone', loadingScreenGone);

    // Check sidebar is interactive
    const sidebarInteractive = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      if (!sidebar) return false;
      return getComputedStyle(sidebar).pointerEvents !== 'none';
    });
    check('Sidebar is interactive (pointer-events: auto)', sidebarInteractive);

    // ── 2. Navigation Tests ──
    console.log('\n=== 2. Navigation Tests ===');
    const navPages = ['Browse', 'Favourites', 'Fixes', 'Settings'];
    const navIds = ['browse', 'favourites', 'fixes', 'settings'];

    for (let i = 0; i < navPages.length; i++) {
      const label = navPages[i];
      const expectedPage = navIds[i];
      const btn = page.locator(`button.sidebar-nav-btn:has-text("${label}")`).first();

      try {
        await btn.click({ timeout: 5000 });
        await page.waitForTimeout(600);

        // Verify the URL hash or currentPage changed
        const currentPage = await page.evaluate(() => {
          // Check the active nav button class to verify page changed
          const activeBtn = document.querySelector('.sidebar-nav-btn-active');
          if (activeBtn) {
            return activeBtn.textContent ? activeBtn.textContent.toLowerCase().trim() : 'unknown';
          }
          return 'unknown';
        });

        const pageOk = currentPage === expectedPage || currentPage.includes(expectedPage);
        check(`Click "${label}" navigates to ${expectedPage}`, pageOk);

        await page.screenshot({ path: `e2e-02-${expectedPage}.png`, fullPage: true });
      } catch (e) {
        check(`Click "${label}" navigates to ${expectedPage}`, false);
        errors.push(`[NAV_FAIL] ${label}: ${e.message}`);
      }
    }

    // ── 3. Home navigation ──
    console.log('\n=== 3. Home Navigation ===');
    const homeBtn = page.locator('button.sidebar-nav-btn:has-text("Home")').first();
    try {
      await homeBtn.click({ timeout: 5000 });
      await page.waitForTimeout(600);
      check('Click "Home" works', true);
    } catch (e) {
      check('Click "Home" works', false);
    }

    // ── 4. Rapid nav back-and-forth ──
    console.log('\n=== 4. Rapid Navigation ===');
    try {
      for (let i = 0; i < 3; i++) {
        await page.locator('button.sidebar-nav-btn:has-text("Browse")').first().click({ timeout: 3000 });
        await page.waitForTimeout(50);
        await page.locator('button.sidebar-nav-btn:has-text("Home")').first().click({ timeout: 3000 });
        await page.waitForTimeout(50);
      }
      check('Rapid nav back-and-forth (3 cycles)', true);
    } catch (e) {
      check('Rapid nav back-and-forth (3 cycles)', false);
    }

    await page.screenshot({ path: 'e2e-03-rapid.png', fullPage: true });

  } finally {
    console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(e => console.log(`  ${e}`));
    }

    await browser.close();
    await server.close();
  }
}

run().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
