const { contextBridge, ipcRenderer } = require('electron');
const https = require('https');
const http = require('http');

// Track active IPC listeners to prevent duplicate handler leaks
// Subscribe to a main->renderer channel; returns an unsubscribe function.
const subscribe = (channel, callback) => {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};
let _scanProgressHandler = null;
let _contextMenuHandler = null;
let _fixProgressHandler = null;
let _maximizeHandler = null;
let _fullscreenHandler = null;
let _preloaderProgressHandler = null;
let _preloaderCompleteHandler = null;
let _preloaderPausedHandler = null;
let _preloaderResumedHandler = null;
let _preloaderCancelledHandler = null;

// Fetch JSON from Steam Store API using Node.js https (bypasses CORS restrictions of browser fetch in preload)
function fetchSteamAPIData(appid) {
  return new Promise((resolve, reject) => {
    const apiUrl = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=en&filters=basic`;
    const urlObj = new URL(apiUrl);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'AHG-Steam-Unlocker/9.4',
        'Accept': 'application/json',
      },
      timeout: 10000,
    };
    const req = https.get(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Steam API HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString());
          const entry = json[appid];
          if (entry && entry.success && entry.data && entry.data.header_image) {
            resolve(entry.data.header_image);
          } else {
            reject(new Error('Steam API returned no header_image'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Steam API timeout')); });
    req.end();
  });
}

// Fetch image and return as base64 data URL
function fetchImageAsDataURL(url) {
  console.log('[PRELOAD] fetchImageAsDataURL:', url);
  
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;
  const isHttps = urlObj.protocol === 'https:';
  const protocol = isHttps ? https : http;
  
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'AHG-Steam-Unlocker/9.4',
        'Accept': 'image/*',
      },
    };
    
    const req = protocol.get(url, options, (res) => {
      console.log('[PRELOAD] Got response for', url, ':', res.statusCode);
      
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('[PRELOAD] Redirect to:', res.headers.location);
        fetchImageAsDataURL(res.headers.location).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('[PRELOAD] Got', buffer.length, 'bytes for', url);
        if (buffer.length < 500) {
          reject(new Error('Image too small'));
          return;
        }
        const contentType = res.headers['content-type'] || 'image/jpeg';
        const base64 = buffer.toString('base64');
        resolve(`data:${contentType};base64,${base64}`);
      });
      res.on('error', (e) => {
        console.log('[PRELOAD] Response error for', url, ':', e.message);
        reject(e);
      });
    });
    
    req.on('error', (e) => {
      console.log('[PRELOAD] Request error for', url, ':', e.message);
      reject(e);
    });
    
    req.setTimeout(10000, () => {
      console.log('[PRELOAD] Timeout for', url);
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  getResourcePath: (relativePath) => ipcRenderer.invoke('get-resource-path', relativePath),
  
  loadGames: () => ipcRenderer.invoke('load-games'),
  onCatalogueReady: (callback) => subscribe('catalogue-ready', callback),

  // ── SQLite paginated queries (used via bridge.ts, needed for batcher too) ──
  queryGames: (opts) => ipcRenderer.invoke('db:query-games', opts),
  getGame: (appid) => ipcRenderer.invoke('db:get-game', appid),

  // ── Batch IPC endpoints ──
  getGamesMeta: (appids) => ipcRenderer.invoke('db:get-games-meta', appids),
  batchGetGameDetails: (appids, fields) => ipcRenderer.invoke('db:batch-get-game-details', { appids, fields }),
  batchQueryGames: (queryOptsList) => ipcRenderer.invoke('db:batch-query-games', queryOptsList),
  queryGameRange: (startIndex, count) => ipcRenderer.invoke('db:query-game-range', { startIndex, count }),
  getGameCount: () => ipcRenderer.invoke('db:get-game-count'),

  // ── Local image fast path (restores dead bridge.ts calls — avoids slow multi-CDN race) ──
  getLocalImage: (appid, suffix) => ipcRenderer.invoke('get-local-image', appid, suffix),
  getLocalImageManifest: () => ipcRenderer.invoke('get-local-image-manifest'),
  gameExists: (appid) => ipcRenderer.invoke('db:game-exists', appid),
  getFix: (appid) => ipcRenderer.invoke('db:get-fix', appid),
  getAllGameIds: () => ipcRenderer.invoke('db:get-all-game-ids'),
  upsertGame: (game) => ipcRenderer.invoke('db:upsert-game', game),
  upsertGames: (games) => ipcRenderer.invoke('db:upsert-games', games),
  updateGameCover: (appid, image) => ipcRenderer.invoke('db:update-game-cover', appid, image),

  // ── API config (Ryuu auth_code / SteamGridDB key) — main-process backed ──
  getApiConfig: () => ipcRenderer.invoke('get-api-config'),
  setApiConfig: (config) => ipcRenderer.invoke('set-api-config', config),

  // ── Connectivity check (main-process https, bypasses renderer CORS) ──
  checkConnectivity: () => ipcRenderer.invoke('check-connectivity'),

  // Catalogue/fixes are served from the SQLite DBs (load-games / query-games / app:init-data).
  // The legacy JSON-backed channels (filter-games-by-platform, read/write-cached-games,
  // load-fixes) were removed — they sourced stale data from games.json/fixes.json.
  getCustomFixes: () => ipcRenderer.invoke('get-custom-fixes'),
  checkNewCustomFixes: () => ipcRenderer.invoke('check-new-custom-fixes'),
  onCustomFixesUpdated: (callback) => subscribe('custom-fixes-updated', callback),
  // ── Remote Sync ──
  checkRemoteSync: () => ipcRenderer.invoke('remote-sync:check'),
  onRemoteSyncUpdated: (callback) => subscribe('remote-sync-updated', callback),
  // ── Install Log Streaming ──
  onInstallLog: (callback) => subscribe('install-log', callback),
  setOnlineFixAuth: (username, password) => ipcRenderer.invoke('set-onlinefix-auth', username, password),
  // ── Generator Ryuu Auth ──
  setRyuuAuth: (authKey) => ipcRenderer.invoke('set-ryuu-auth', authKey),
  getRyuuAuth: () => ipcRenderer.invoke('get-ryuu-auth'),
  
  browsePath: (key) => ipcRenderer.invoke('browse-path', key),
  addToSteam: (appid) => ipcRenderer.invoke('add-to-steam', appid),
  installGame: (appid) => ipcRenderer.invoke('add-to-steam', appid),
  installGameWithLogs: (appid) => ipcRenderer.invoke('install-game-with-logs', appid),
  installGameFromZip: (appid) => ipcRenderer.invoke('install-game-from-zip', appid),
  installGameRyuu: (appid) => ipcRenderer.invoke('install-game-ryuu', appid),
  ryuuUpdateGame: (appid) => ipcRenderer.invoke('ryuu-update-game', appid),
  installRyuuDlcs: (baseAppid, dlcAppids) => ipcRenderer.invoke('install-ryuu-dlcs', baseAppid, dlcAppids),
  downloadFix: (appid, name, gameUrl) => ipcRenderer.invoke('download-fix', appid, name, gameUrl),
  extractFix: (filePath) => ipcRenderer.invoke('extract-fix', filePath),
  openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
  
  // Quick Tools
  fixNoInternet: () => ipcRenderer.invoke('fix-no-internet'),
  fixNoGames: () => ipcRenderer.invoke('fix-no-games'),
  copyManifest: (appid) => ipcRenderer.invoke('copy-manifest', appid),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  scanNewManifests: () => ipcRenderer.invoke('scan-new-manifests'),
  fixGamesNotShowing: () => ipcRenderer.invoke('fix-games-not-showing'),
  onFixGamesProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('fix-games-progress', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('fix-games-progress', handler);
  },
  scanForNewGames: () => ipcRenderer.invoke('scan-for-new-games'),
  
  // Library
  getInstalledGames: () => ipcRenderer.invoke('get-installed-games'),
  removeInstalledGame: (appid) => ipcRenderer.invoke('remove-installed-game', appid),
  saveInstalled: (appids) => ipcRenderer.invoke('save-installed', appids),
  recordInstallVersion: (appid, updatedDate) => ipcRenderer.invoke('record-install-version', appid, updatedDate),
  getInstallVersions: () => ipcRenderer.invoke('get-install-versions'),
  clearInstallVersion: (appid) => ipcRenderer.invoke('clear-install-version', appid),

  // Path operations
  restartSteam: () => ipcRenderer.invoke('restart-steam'),
  openSteamFolder: () => ipcRenderer.invoke('open-steam-folder'),
  getUnlockMode: () => ipcRenderer.invoke('get-unlock-mode'),
  setUnlockMode: (mode, reinstall) => ipcRenderer.invoke('set-unlock-mode', mode, reinstall),
  onUnlockModeProgress: (callback) => {
    const handler = (_event, step) => callback(step);
    ipcRenderer.on('unlock-mode-progress', handler);
    return () => ipcRenderer.removeListener('unlock-mode-progress', handler);
  },
  
  // Update checker
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (downloadUrl, savePath) => ipcRenderer.invoke('download-update', downloadUrl, savePath),
  cancelUpdateDownload: () => ipcRenderer.invoke('cancel-update-download'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getDownloadPath: () => ipcRenderer.invoke('get-download-path'),
  getLastSeenVersion: () => ipcRenderer.invoke('get-last-seen-version'),
  setLastSeenVersion: (version) => ipcRenderer.invoke('set-last-seen-version', version),
  
  // Favorites persistence
  saveFavorites: (favorites) => ipcRenderer.invoke('save-favorites', favorites),
  loadFavorites: () => ipcRenderer.invoke('load-favorites'),
  
  // Recent games persistence
  saveRecent: (recentGames) => ipcRenderer.invoke('save-recent', recentGames),
  loadRecent: () => ipcRenderer.invoke('load-recent'),
  getRecentlyAdded: () => ipcRenderer.invoke('get-recently-added'),
  clearRecentlyAdded: () => ipcRenderer.invoke('clear-recently-added'),
  getInitData: () => ipcRenderer.invoke('app:init-data'),
  
  // License system
  checkLicense: () => ipcRenderer.invoke('check-license'),
  activateLicense: (licenseKey) => ipcRenderer.invoke('activate-license', licenseKey),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
  onLicenseStateChanged: (callback) => subscribe('license-state-changed', callback),
  getSupportLink: () => ipcRenderer.invoke('get-support-link'),
  
  // Download progress listener
  onDownloadProgress: (callback) => subscribe('download-progress', callback),
  
  // Scan progress listener
  onScanProgress: (callback) => {
    if (_scanProgressHandler) {
      ipcRenderer.removeListener('scan-progress', _scanProgressHandler);
    }
    _scanProgressHandler = (event, data) => callback(data);
    ipcRenderer.on('scan-progress', _scanProgressHandler);
  },
  
  // Image loading - fetch Steam images as base64 data URLs
  fetchImage: async (appid, localHeaderUrl, preferredImageTypes) => {
    // Determine suffix order — preferred types first, then remaining
    const ALL_SUFFIXES = ['capsule_616x353.jpg', 'library_600x900.jpg', 'portrait.jpg', 'header.jpg', 'library_hero.jpg', 'capsule_231x87.jpg', 'capsule_sm_120.jpg'];
    let suffixOrder;
    if (preferredImageTypes && Array.isArray(preferredImageTypes) && preferredImageTypes.length > 0) {
      const remaining = ALL_SUFFIXES.filter(s => !preferredImageTypes.includes(s));
      suffixOrder = [...preferredImageTypes, ...remaining];
    } else {
      suffixOrder = ALL_SUFFIXES;
    }
    
    const ALL_HOSTS = [
      'shared.akamai.steamstatic.com', 'cdn.cloudflare.steamstatic.com',
      'cdn.akamai.steamstatic.com', 'steamcdn-a.akamaihd.net', 'i.steamstatic.com',
      'cdn.steamstatic.com', 'steamstatic-a.akamaihd.net', 'media.steampowered.com',
    ];

    // Try each suffix sequentially across all hosts in parallel.
    // Only moves to next suffix when ALL hosts fail for the current one.
    // This prevents a fast header.jpg from winning over preferred portrait.jpg.
    async function trySuffix(suffix) {
      const urls = [];
      for (const host of ALL_HOSTS) {
        urls.push(`https://${host}/store_item_assets/steam/apps/${appid}/${suffix}`);
        urls.push(`https://${host}/steam/apps/${appid}/${suffix}`);
      }
      const results = await Promise.allSettled(urls.map(url => fetchImageAsDataURL(url)));
      for (const r of results) {
        if (r.status === 'fulfilled') return r.value;
      }
      return null;
    }
    for (const suffix of suffixOrder) {
      const result = await trySuffix(suffix);
      if (result) return result;
    }

    // Fallback: non-CDN URLs (SteamDB, store, archive) — landscape only
    const fallbackUrls = [
      `https://store.steampowered.com/public/images/apps/${appid}/header.jpg`,
      `https://steamstore-a.akamaihd.net/public/images/apps/${appid}/header.jpg`,
      `https://steamdb.info/static/apps/${appid}/header.jpg`,
      `https://steamdb.info/static/apps/${appid}/capsule_616x353.jpg`,
      `https://archive.org/download/steam-capsules/${appid}.jpg`,
    ];
    const fbResults = await Promise.allSettled(fallbackUrls.map(url => fetchImageAsDataURL(url)));
    for (const r of fbResults) {
      if (r.status === 'fulfilled') return r.value;
    }

    // Final fallback: Steam API (most commonly returns header.jpg)
    try {
      const realUrl = await fetchSteamAPIData(appid);
      console.log('[PRELOAD] Steam API returned real URL for', appid, ':', realUrl);
      if (realUrl) return await fetchImageAsDataURL(realUrl);
    } catch {}
    
    throw new Error('All image URLs failed');
  },

  // ── Native Image Acceleration (C++ addon via main process) ──
  nativeGenerateLQIP: (buffer, lqipWidth = 20) =>
    ipcRenderer.invoke('native-image:generateLQIP', { buffer, lqipWidth }),
  nativeImageDecode: (buffer) =>
    ipcRenderer.invoke('native-image:decode', { buffer }),
  nativeImageHealth: () =>
    ipcRenderer.invoke('native-image:health'),

  platform: process.platform,
  isPackaged: __dirname.indexOf('app.asar') !== -1,
  
  // Open external URL in default browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // ── NEW FEATURES v0.8.0 ──
  
  // Auto-Apply Fixes
  saveAutoFix: (appid, fixData) => ipcRenderer.invoke('save-auto-fix', appid, fixData),
  loadAutoFix: (appid) => ipcRenderer.invoke('load-auto-fix', appid),
  getAllAutoFixes: () => ipcRenderer.invoke('get-all-auto-fixes'),
  
  // Game Tags
  saveGameTags: (appid, tags) => ipcRenderer.invoke('save-game-tags', appid, tags),
  loadGameTags: (appid) => ipcRenderer.invoke('load-game-tags', appid),
  getAllGameTags: () => ipcRenderer.invoke('get-all-game-tags'),
  
  // Offline Mode - Local manifest cache
  cacheManifestOffline: (appid, manifestData) => ipcRenderer.invoke('cache-manifest-offline', appid, manifestData),
  getOfflineManifest: (appid) => ipcRenderer.invoke('get-offline-manifest', appid),
  getOfflineCacheList: () => ipcRenderer.invoke('get-offline-cache-list'),
  
  // Mirror Health Check
  checkMirrorHealth: () => ipcRenderer.invoke('check-mirror-health'),

  // OS Notifications
  sendNotification: ({ title, body }) => ipcRenderer.invoke('send-notification', { title, body }),
  
  // Window size persistence
  saveWindowState: (bounds) => ipcRenderer.invoke('save-window-state', bounds),
  loadWindowState: () => ipcRenderer.invoke('load-window-state'),
  
  // Scheduled Scans
  saveSchedule: (scheduleData) => ipcRenderer.invoke('save-schedule', scheduleData),
  loadSchedule: () => ipcRenderer.invoke('load-schedule'),
  runScheduledScan: () => ipcRenderer.invoke('run-scheduled-scan'),
  
  // Manifest Verification
  verifyManifest: (appid) => ipcRenderer.invoke('verify-manifest', appid),
  
  // Secure Downloads
  secureDownload: (url, expectedHash) => ipcRenderer.invoke('secure-download', url, expectedHash),
  
  // Installation Stats
  recordInstall: (appid, size) => ipcRenderer.invoke('record-install', appid, size),
  getInstallStats: () => ipcRenderer.invoke('get-install-stats'),
  
  // Activity Heatmap
  getActivityData: () => ipcRenderer.invoke('get-activity-data'),
  
  // UI Settings (sidebar toggle)
  saveUISettings: (settings) => ipcRenderer.invoke('save-ui-settings', settings),
  loadUISettings: () => ipcRenderer.invoke('load-ui-settings'),
  
  // Right-click Context Menu
  showContextMenu: (items) => ipcRenderer.invoke('show-context-menu', items),

  // Context menu action listener
  onContextMenuAction: (callback) => {
    if (_contextMenuHandler) {
      ipcRenderer.removeListener('context-menu-action', _contextMenuHandler);
    }
    _contextMenuHandler = (event, action, data) => callback(action, data);
    ipcRenderer.on('context-menu-action', _contextMenuHandler);
  },

  // Custom Steam Path config
  getCustomSteamConfig: () => ipcRenderer.invoke('get-custom-steam-config'),
  saveCustomSteamConfig: (config) => ipcRenderer.invoke('save-custom-steam-config', config),

  // ── v0.8 NEW FEATURES ──
  
  // User Stats persistence
  saveUserStats: (stats) => ipcRenderer.invoke('save-user-stats', stats),
  getUserStats: () => ipcRenderer.invoke('get-user-stats'),
  
  // Achievements persistence
  saveAchievements: (achievements) => ipcRenderer.invoke('save-achievements', achievements),
  getAchievements: () => ipcRenderer.invoke('get-achievements'),
  
  // Pinned Games for Quick Launch
  savePinnedGames: (pinned) => ipcRenderer.invoke('save-pinned-games', pinned),
  getPinnedGames: () => ipcRenderer.invoke('get-pinned-games'),
  
  // Owned Games (Steam library sync)
  saveOwnedGames: (owned) => ipcRenderer.invoke('save-owned-games', owned),
  getOwnedGames: () => ipcRenderer.invoke('get-owned-games'),
  detectOwnedGames: () => ipcRenderer.invoke('detect-owned-games'),
  onOwnedGamesUpdated: (callback) => subscribe('owned-games-updated', callback),
  
  // Fix Health data
  saveFixHealth: (health) => ipcRenderer.invoke('save-fix-health', health),
  getFixHealth: () => ipcRenderer.invoke('get-fix-health'),
  
  // Open URL helper
  openUrl: (url) => ipcRenderer.invoke('open-external', url),
  
  // DLC support
  fetchDLCs: (appid, gameName) => ipcRenderer.invoke('fetch-dlcs', appid, gameName),
  getDlcRegistry: () => ipcRenderer.invoke('get-dlc-registry'),
  registerDlcs: (appid, dlcIds, dlcDetails, sourceRepo) => ipcRenderer.invoke('register-dlcs', appid, dlcIds, dlcDetails, sourceRepo),

  // Restart app after update
  restartApp: () => ipcRenderer.invoke('restart-app'),

  // ── Steam Status ──
  getSteamStatus: () => ipcRenderer.invoke('get-steam-status'),

  // ── v0.9 NEW FEATURES ──

  fetchMissingCovers: () => ipcRenderer.invoke('fetch-missing-covers'),
  onCoverFetchProgress: (callback) => subscribe('cover-fetch-progress', callback),
  exportLibrary: () => ipcRenderer.invoke('export-library'),
  importLibrary: () => ipcRenderer.invoke('import-library'),
  getSearchHistory: () => ipcRenderer.invoke('get-search-history'),
  saveSearchHistory: (searches) => ipcRenderer.invoke('save-search-history', searches),
  fixNoGamesStream: () => ipcRenderer.invoke('fix-no-games-stream'),
  cancelDownload: (appid) => ipcRenderer.invoke('cancel-download', appid),
  launchGame: (appId) => ipcRenderer.invoke('launch-game', appId),
  showMainWindow: () => ipcRenderer.invoke('show-main-window'),
  refreshSteam: () => ipcRenderer.invoke('refresh-steam'),
  checkFreeGames: (appids) => ipcRenderer.invoke('check-free-games', appids),
  fetchSteamGenres: (appids) => ipcRenderer.invoke('fetch-steam-genres', appids),

  onFixProgress: (callback) => {
    if (_fixProgressHandler) {
      ipcRenderer.removeListener('fix-progress', _fixProgressHandler);
    }
    _fixProgressHandler = (event, data) => callback(data);
    ipcRenderer.on('fix-progress', _fixProgressHandler);
  },

  // ── Window Controls ──
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizeChange: (callback) => {
    if (_maximizeHandler) ipcRenderer.removeListener('window-maximize-change', _maximizeHandler);
    _maximizeHandler = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window-maximize-change', _maximizeHandler);
  },

  // ── Fullscreen Controls ──
  toggleFullscreen: () => ipcRenderer.invoke('window-toggle-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('window-is-fullscreen'),
  onFullscreenChange: (callback) => {
    if (_fullscreenHandler) ipcRenderer.removeListener('window-fullscreen-change', _fullscreenHandler);
    _fullscreenHandler = (_event, isFullscreen) => callback(isFullscreen);
    ipcRenderer.on('window-fullscreen-change', _fullscreenHandler);
  },

  // ── Image Disk Cache ──
  imageCacheBatchGet: (requests) => ipcRenderer.invoke('image-cache:batchGet', requests),
  imageCacheHas: (appid, preferredImageTypes) => ipcRenderer.invoke('image-cache:has', appid, preferredImageTypes),
  imageCacheSet: (appid, preferredImageTypes, base64Data, mimeType, lqip) => ipcRenderer.invoke('image-cache:set', appid, preferredImageTypes, base64Data, mimeType, lqip),
  imageCacheClear: () => ipcRenderer.invoke('image-cache:clear'),
  imageCacheStats: () => ipcRenderer.invoke('image-cache:stats'),

  // ── Image Preloader ──
  preloaderStart: (priorityAppids, options) => ipcRenderer.invoke('preloader:start', priorityAppids, options),
  preloaderPause: () => ipcRenderer.invoke('preloader:pause'),
  preloaderResume: () => ipcRenderer.invoke('preloader:resume'),
  preloaderCancel: () => ipcRenderer.invoke('preloader:cancel'),
  preloaderStatus: () => ipcRenderer.invoke('preloader:status'),
  onPreloaderProgress: (callback) => {
    if (_preloaderProgressHandler) ipcRenderer.removeListener('preloader:progress', _preloaderProgressHandler);
    _preloaderProgressHandler = (_event, data) => callback(data);
    ipcRenderer.on('preloader:progress', _preloaderProgressHandler);
  },
  onPreloaderComplete: (callback) => {
    if (_preloaderCompleteHandler) ipcRenderer.removeListener('preloader:complete', _preloaderCompleteHandler);
    _preloaderCompleteHandler = (_event, data) => callback(data);
    ipcRenderer.on('preloader:complete', _preloaderCompleteHandler);
  },
  onPreloaderPaused: (callback) => {
    if (_preloaderPausedHandler) ipcRenderer.removeListener('preloader:paused', _preloaderPausedHandler);
    _preloaderPausedHandler = (_event, data) => callback(data);
    ipcRenderer.on('preloader:paused', _preloaderPausedHandler);
  },
  onPreloaderResumed: (callback) => {
    if (_preloaderResumedHandler) ipcRenderer.removeListener('preloader:resumed', _preloaderResumedHandler);
    _preloaderResumedHandler = (_event, data) => callback(data);
    ipcRenderer.on('preloader:resumed', _preloaderResumedHandler);
  },
  onPreloaderCancelled: (callback) => {
    if (_preloaderCancelledHandler) ipcRenderer.removeListener('preloader:cancelled', _preloaderCancelledHandler);
    _preloaderCancelledHandler = (_event, data) => callback(data);
    ipcRenderer.on('preloader:cancelled', _preloaderCancelledHandler);
  },

  // -- Native Image Processing (C++ decode addon with sharp fallback) --
  nativeProcessImage: (base64Data, mimeType) => ipcRenderer.invoke('image:nativeProcess', base64Data, mimeType),
  nativeGpuSupported: () => ipcRenderer.invoke('image:nativeGpuSupported'),
})

contextBridge.exposeInMainWorld('versions', {
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron,
})
