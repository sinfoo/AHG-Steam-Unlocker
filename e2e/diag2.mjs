import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const MOCK_GAMES = Array.from({ length: 50 }, (_, i) => ({
  appid: String(100000 + i),
  name: `Test Game ${i + 1}`,
  platform: ['win'],
  genre: 'Action',
}));

async function startVite() {
  const server = await createServer({
    root: projectRoot,
    server: { port: 5182, strictPort: true },
    logLevel: 'silent',
  });
  await server.listen();
  const addr = server.httpServer.address();
  const port = typeof addr === 'object' ? addr.port : 5182;
  console.log(`Vite on port ${port}`);
  return { server, port };
}

async function run() {
  const { server, port } = await startVite();
  const BASE = `http://localhost:${port}/`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Inject bare-minimum mock
  await context.addInitScript(() => {
    window.electronAPI = {
      platform: 'win32',
      isPackaged: false,
      loadGames: async () => [],
      loadFixes: async () => ({}),
      loadCachedGames: async () => ({ found: false }),
      readCachedGames: async () => ({ found: true, data: [] }),
      saveCachedGames: async () => ({ success: true }),
      loadFavorites: async () => [],
      saveFavorites: async () => ({ success: true }),
      loadRecent: async () => [],
      saveRecent: async () => ({ success: true }),
      getInstalledGames: async () => ({ success: true, games: [] }),
      saveInstalled: async () => ({}),
      getPinnedGames: async () => [],
      getOwnedGames: async () => [],
      checkLicense: async () => ({ activated: true }),
      checkForUpdates: async () => ({ success: true, hasUpdate: false, currentVersion: '0.9.0', latestVersion: '0.9.0', releaseNotes: '', releaseUrl: '', downloadUrl: null, downloadSize: 0 }),
      loadUISettings: async () => ({}),
      saveUISettings: async () => ({ success: true }),
      getUserStats: async () => ({}),
      getRecentlyAdded: async () => [],
      getSearchHistory: async () => [],
      saveSearchHistory: async () => ({ success: true }),
      getLastSeenVersion: async () => null,
      checkDiscordAuth: async () => ({ authenticated: false }),
      getCustomSteamConfig: async () => ({}),
      checkMirrorHealth: async () => ({ healthy: true, mirrors: [] }),
      getActivityData: async () => ({ daily: [], weekly: [], monthly: [] }),
      getSupportLink: async () => '',
      loadGameTags: async () => [],
      getAllGameTags: async () => ({}),
      getAutoFixes: async () => ({}),
      minimizeWindow: () => {},
      maximizeWindow: () => {},
      closeWindow: () => {},
      isMaximized: async () => false,
      openExternal: async () => ({ success: true }),
      openUrl: async () => ({ success: true }),
      restartSteam: async () => ({ success: true, message: '' }),
      scanForNewGames: async () => ({ success: true, newCount: 0 }),
      fixNoGamesStream: async () => ({ success: true, output: '' }),
      exportLibrary: async () => ({ success: true }),
      importLibrary: async () => ({ success: true }),
      getSteamStatus: async () => ({ running: false, version: '' }),
      cancelDownload: async () => ({ success: true, aborted: 0 }),
      checkFreeGames: async () => [],
      filterGamesByPlatform: async () => [],
      onScanProgress: () => {},
      onDownloadProgress: () => {},
      onFixProgress: () => {},
      onLicenseStateChanged: () => {},
    };
  });

  const page = await context.newPage();
  const logs = [];
  page.on('console', msg => { if (msg.text().length < 300) logs.push(`[${msg.type()}] ${msg.text()}`); });
  page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Page loaded, waiting 8s...');
  await page.waitForTimeout(8000);

  const state = await page.evaluate(() => {
    const overlay = document.querySelector('.flex.items-center.justify-center.overflow-hidden');
    const sidebar = document.querySelector('aside');
    const mainContent = document.querySelector('.flex-1.flex.flex-col.relative.z-10.overflow-hidden');
    return {
      overlay: overlay ? {
        opacity: getComputedStyle(overlay).opacity,
        pointerEvents: getComputedStyle(overlay).pointerEvents,
        display: getComputedStyle(overlay).display,
      } : 'not-found',
      sidebarPointerEvents: sidebar ? getComputedStyle(sidebar).pointerEvents : 'no-sidebar',
      sidebarExists: !!sidebar,
      navButtons: document.querySelectorAll('button.sidebar-nav-btn').length,
      mainContentDisplay: mainContent ? getComputedStyle(mainContent).display : 'not-found',
      mainContentOpacity: mainContent ? getComputedStyle(mainContent).opacity : 'not-found',
      hasElectronAPI: typeof window.electronAPI !== 'undefined',
      hasLoadGames: typeof window.electronAPI?.loadGames === 'function',
    };
  });

  console.log('\nState:', JSON.stringify(state, null, 2));
  console.log('\nConsole output:');
  logs.slice(-30).forEach(l => console.log(l));

  await page.screenshot({ path: 'e2e-diag2.png', fullPage: true });
  console.log('\nScreenshot saved');

  await browser.close();
  await server.close();
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
