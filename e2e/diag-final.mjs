import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function startVite() {
  const server = await createServer({
    root: projectRoot,
    server: { port: 5184, strictPort: true },
    logLevel: 'silent',
  });
  await server.listen();
  const addr = server.httpServer.address();
  const port = typeof addr === 'object' ? addr.port : 5184;
  console.log(`Vite on port ${port}`);
  return { server, port };
}

async function run() {
  const { server, port } = await startVite();
  const BASE = `http://localhost:${port}/`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

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

  // Log key events
  page.on('console', msg => {
    const t = msg.text();
    if (t.includes('[APP]') || t.includes('[BRIDGE]') || t.includes('[EVENT]') || t.includes('[PAGE_ERROR]') || t.includes('[log] [RENDERER]'))
      console.log(`  ${t}`);
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

  console.log('Waiting for loading to complete + exit animation (6s)...');
  await page.waitForTimeout(6000);

  // Check state repeatedly after loading should be done
  for (let i = 0; i < 5; i++) {
    const state = await page.evaluate(() => {
      // Find the AnimatedLoadingScreen wrapper
      const all = document.querySelectorAll('body > div');
      // The loadingScreen element
      const htmlSplash = document.getElementById('loadingScreen');
      // React overlay - look for the outer wrapper that shows/hides the loading
      const appRoot = document.getElementById('root');
      const hasOverlayText = appRoot?.textContent?.includes('Loading');
      // Check main content visibility
      const main = document.querySelector('[class*="flex-1"]');
      return {
        htmlSplashHidden: htmlSplash?.classList.contains('hidden'),
        htmlSplashOpacity: htmlSplash ? getComputedStyle(htmlSplash).opacity : 'no-element',
        hasOverlayText,
        mainContentExists: !!main,
        rootChildCount: appRoot?.children.length,
      };
    });
    console.log(`  check ${i}: ${JSON.stringify(state)}`);
    await page.waitForTimeout(1000);
  }

  await browser.close();
  await server.close();
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
