import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function startVite() {
  const server = await createServer({
    root: projectRoot,
    server: { port: 5183, strictPort: true },
    logLevel: 'silent',
  });
  await server.listen();
  const addr = server.httpServer.address();
  const port = typeof addr === 'object' ? addr.port : 5183;
  console.log(`Vite on port ${port}`);
  return { server, port };
}

async function run() {
  const { server, port } = await startVite();
  const BASE = `http://localhost:${port}/`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Minimal mock
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
  page.on('console', msg => {
    const text = msg.text();
    if (text.length < 500) logs.push(`[${msg.type()}] ${text}`);
  });
  page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`));

  // Intercept and log splash-complete event
  await page.addInitScript(() => {
    const origDispatch = window.dispatchEvent;
    window.dispatchEvent = function(evt) {
      if (evt.type === 'splash-complete') console.log('[EVENT] splash-complete fired!');
      if (evt.type === 'hide-splash') console.log('[EVENT] hide-splash fired!');
      return origDispatch.call(this, evt);
    };
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Page loaded, waiting 10s...');
  await page.waitForTimeout(10000);

  // Check React state
  const reactState = await page.evaluate(() => {
    // Try to find the loading state indicator by checking DOM
    const loadingOverlay = document.querySelector('[class*="flex"][class*="items-center"][class*="justify-center"]');
    const rootHtml = document.getElementById('root')?.innerHTML?.substring(0, 500);
    return {
      overlayVisible: loadingOverlay ? getComputedStyle(loadingOverlay).display !== 'none' : 'not-found',
      rootContent: rootHtml
    };
  });

  console.log('\n=== All console output ===');
  logs.forEach(l => console.log(l));
  console.log('\n=== React State ===');
  console.log(JSON.stringify(reactState, null, 2));

  await browser.close();
  await server.close();
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
