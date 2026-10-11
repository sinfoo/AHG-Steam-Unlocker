const { app, BrowserWindow, ipcMain, Menu, shell, session, dialog, Tray, nativeImage, screen, protocol } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const httpsAgent = new https.Agent({ keepAlive: true });
const http = require('http');
const AdmZip = require('adm-zip');
const customFixesManager = require('./custom-fixes-manager.cjs');
const remoteSyncManager = require('./remote-sync-manager.cjs');
const db = require('./db.cjs');
const { registerInitDataHandler } = require('./handlers/init-data.cjs');
const { registerPersistenceHandlers } = require('./handlers/persistence.cjs');
const { registerWindowIpc } = require('./handlers/window.cjs');
const { registerImageNativeHandlers } = require('./handlers/imageNative.cjs');
const state = require('./utils/state.cjs');
const { getHealthyEndpoints, markHealthy, warmupHealthChecks } = require('./utils/apiHealthCheck.cjs');
const APP_VERSION = require('../package.json').version;
const { DiskCacheManager } = require('./services/imageDiskCache.cjs');
const { preloader } = require('./services/imagePreloader.cjs');
const nativeImageAddon = require('../native');
const { dlcInfoCache, DLC_CACHE_FILE, getCustomSteamConfig, saveCustomSteamConfig, loadDlcInfoCache, saveDlcInfoCache, fetchDlcInfos } = require('./utils/config.cjs');
const { getDepotDownloaderPath, DEPOT_DOWNLOADER_PATH, DEFAULT_STEAM_PATH, getResourcePath, findSteamPath, getCustomDepotCachePath, getCustomStPluginPath } = require('./utils/paths.cjs');

// ── ipcMain.handle uses the original Electron binding ──
// The duplicate-handler guard was removed after inline→module handler migration completed.

// DEPOT_DOWNLOADER_PATH imported from ./utils/paths.cjs

// ── Portable image-cache location ─────────────────────────────────────────
// When packaged, store the cover cache NEXT TO THE APP (inside the
// win-unpacked / portable folder) instead of %APPDATA%. This makes the warmed
// cache travel with the distributable: after the user browses and the covers
// are cached, zipping the win-unpacked folder and sending it gives the
// recipient the exact same instant-cover experience — no re-downloading from
// the CDN. Falls back to userData when the app dir is read-only (e.g. installed
// under Program Files) or when running unpackaged in dev.
function resolveImageCacheDir() {
  try {
    if (app.isPackaged) {
      // PORTABLE_EXECUTABLE_DIR is set by electron-builder's portable target;
      // for the win-unpacked --dir build it's unset, so use the exe's folder.
      const base = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
      const dir = path.join(base, 'ahg-data', 'image-cache');
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK); // throws if not writable → fall back
      return dir;
    }
  } catch (e) {
    console.warn('[MAIN] Portable image-cache dir unavailable, using userData:', e && e.message);
  }
  return path.join(app.getPath('userData'), 'image-cache');
}

// ── Declare image-cache:// as a privileged scheme BEFORE app.whenReady() ──
// Without this, the custom scheme registered via registerFileProtocol is treated as
// opaque/non-standard and <img> loads from it can be silently blocked — the documented
// "white box / black-box-with-letter" cover regression on the Catalogue page.
try {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'image-cache',
    privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true },
  }]);
} catch (e) {
  console.warn('[MAIN] registerSchemesAsPrivileged failed:', e && e.message);
}

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');
app.commandLine.appendSwitch('disable-features', 'CalculateWebWinVisibility');
app.commandLine.appendSwitch('enable-features', 'TaskManagerShowInExtensions');

// ── Steam cover URL fetcher ──────────────────────────────────────────────
async function fetchSteamGameCover(appid) {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=en&filters=basic`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'AHGUnlocker/1.0.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const entry = json[appid];
    if (entry && entry.success && entry.data && entry.data.header_image) {
      return entry.data.header_image;
    }
    return null;
  } catch (e) {
    console.log('[MAIN] fetchSteamGameCover error for', appid, ':', e.message);
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────

function safeLog(...args) {
  try { console.log(...args) } catch (e) { /* ignore */ }
}

// ── Buffered async renderer-log writer ──
// Previously every renderer console message triggered a synchronous fs.appendFileSync
// on the main thread — under load (hundreds of logs at startup) this blocked the UI.
// Now lines are buffered and flushed asynchronously at most every 500ms.
let _rendererLogBuffer = [];
let _rendererLogFlushTimer = null;
function flushRendererLog() {
  _rendererLogFlushTimer = null;
  if (_rendererLogBuffer.length === 0) return;
  const chunk = _rendererLogBuffer.join('');
  _rendererLogBuffer = [];
  try {
    const logPath = path.join(app.getPath('userData'), 'app.log');
    fs.appendFile(logPath, chunk, () => {});
  } catch (e) { /* ignore */ }
}
function bufferRendererLog(line) {
  _rendererLogBuffer.push(line);
  // Hard cap so a runaway renderer can't grow the buffer without bound
  if (_rendererLogBuffer.length > 1000) _rendererLogBuffer.splice(0, _rendererLogBuffer.length - 1000);
  if (!_rendererLogFlushTimer) _rendererLogFlushTimer = setTimeout(flushRendererLog, 500);
}
app.on('before-quit', flushRendererLog);

app.on('web-contents-created', (_, contents) => {
  contents.on('console-message', (_, level, message, line, sourceId) => {
    const prefix = ['DEBUG', 'LOG', 'WARN', 'ERROR'][level] || 'INFO'
    safeLog(`[RENDERER ${prefix}]`, message)
    // Log to file too — async/buffered (no main-thread stall)
    bufferRendererLog(`[${new Date().toISOString()}] [RENDERER ${prefix}] ${message}\n`)
  });
  contents.on('did-fail-load', (_, errorCode, errorDesc) => {
    safeLog('[RENDERER] Failed to load:', errorCode, errorDesc)
  });
});

app.disableHardwareAcceleration = false;

process.on('uncaughtException', (error) => {
  console.error('[MAIN] Uncaught Exception:', error);
  fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'), `${new Date().toISOString()} - Uncaught Exception: ${error.stack}\n`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MAIN] Unhandled Rejection:', reason);
});

// ── Appinfo write queue (prevents race conditions on _appinfo.json) ──
const appinfoWriteQueues = new Map();

function enqueueAppinfoWrite(appId, writeFn, appInfoPath) {
  const prev = appinfoWriteQueues.get(appId) || Promise.resolve();
  const next = prev.then(() => {
    if (appInfoPath && fs.existsSync(appInfoPath)) return;
    return writeFn();
  }).catch(err => {
    console.error(`[appinfo] Write failed for ${appId}:`, err);
  });
  appinfoWriteQueues.set(appId, next);
  // Cleanup: remove resolved promises from map
  next.finally(() => {
    if (appinfoWriteQueues.get(appId) === next) {
      appinfoWriteQueues.delete(appId);
    }
  });
  return next;
}
// ─────────────────────────────────────────────────────────────────────

// ── URL / query parameter utilities ──
function extractQueryParams(url, base) {
  const u = new URL(url, base);
  return {
    hostname: u.hostname,
    port: u.port,
    pathname: u.pathname,
    search: u.search,
    protocol: u.protocol,
    origin: u.origin,
    params: Object.fromEntries(u.searchParams.entries())
  };
}

// ──────────────────────────────────────────

let mainWindow = null;
let pythonProcess = null;
let tray = null;

const MIRROR_REPOS = [
  // Priority repos (always tried first)
  "WARDEN-DEV/Steam_ManifestHub",
  "SteamAutoCracks/ManifestHub",
  "pjy612/SteamManifestCache",
  "pjy612/ManifestAutoUpdate-bak",
  "X06W90X/pjy612",
  // Actively maintained secondary repos
  "SSMGAlt/ManifestHub2",
  "ManifestHub/ManifestHub",
  // Remaining repos
  "BlankTMing/ManifestAutoUpdate",
  "Auiowu/ManifestAutoUpdate",
  "eudaimence/OpenDepot",
  "tympanicblock61/SteamManifestMirror",
  "isurfer21/steam-manifests",
  "WoodenTiger000/SteamManifestHub",
  "TheSecondComing001/SteamManifestHub",
  "frostheaven/steam-manifest-cache",
  "SteamHome/BestManifests",
  "nuclear12345/steam_manifests",
  "legiond2/steam_manifests",
  "MaeBeStuppid/SteamManifests",
  "sergiopereira/steam-manifests",
  "DeckManifests/ManifestHub",
  "pvzcxw/cai-install_stloader",
  "wsxsdyx/ManifestHub1",
  "a60nt1/SteamManifest",
  "Confused712/SteamDeck-Keys",
  "Sora276/SteamDeckManifests",
  "NicksWorldOf/SteamManifests",
  "GHubGamer/SteamDeck-Manifests",
  "mikee251/SteamDeck-Manifests",
  "LizardMode/SteamDeck-Manifests",
  "JannikCZE/SteamDeck-Keys",
  "tenderloincoder/steam-keys",
  "thecyberphunk/steam-depot-keys",
  "RetroDECK/SteamDeck-Keys",
  "AcidRain206/steam-keys",
  "Amiitx/switch-local",
  "SPIN0ZAi/SB_manifest_DB",
  "Metastem/ManifestHub",
  "leiyang3148/ManifestHub2LYY",
  "speedstory/ManifestHub2",
  "skylayer/ManifestHub",
  "ikun0014/ManifestHub",
  "wxy1343/manifest",
  "tymolu233/ManifestAutoUpdate",
  "tymolu233/ManifestAutoUpdate-fix",
  "centricxd/ManifestHub",
  "Knuc/ManifestHub2",
  "IDoCute/ManifestHub2",
  "tmzgit/Steam-ManifestHub2",
  "zkb2006/ManifestHub",
  "IBackupStuff/ManifestHub2",
  "lifan424/ManifestHub",
  "SlowOstrich/ManifestHub2",
  "yeti-yeti/ManifestHub3",
  "zeinoux/ManifestHub",
  "mst111203/ManifestHub",
  "Chengxidaxia/ManifestHub2",
  "nykcursor/ManifestHub2",
  "r0y1z2/ManifestHub2_SteamDepot",
  "siyeqi/steam",
  "864383356/ManifestHub2",
  "shepardzby/ManifestHub2",
  "Ravex0/Ravex-ManifestHu",
  "3569372265/ManifestHub2",
  "dnasdw/ManifestHub2",
  "crybwl/ManifestHub2",
  "shakr9/ManifestHub2shakr",
  "HaiYangawa/ManifestHub2Backup",
  "highly1579/ManifestHub",
  "jinx0030/ManifestHub",
  "355055780/SteamAppImport",
  "AprDeci/ManifestAutoUpdate-bak",
  "chaosxt/ManifestHub2",
  "Chatqing/ManifestHub2",
  "Scropiouos/ManifestAutoUpdate_backup",
  "cwhhk/ManifestHub2",
  // Actively maintained — depotkeys.json + individual manifests
  "fairy-root/steam-depot-online",
  "MCbabel/Steam-Manifest-Downloader",
  "SteamTracking/SteamFileDownloader",
  "Sainan/steam-manifest-tools",
  "mysfad/depot-downloader",
  "ourevryday/ManifestHub",
  "xPaw/SteamFileDownloader",
  // Additional forks of major repos for fallback redundancy
  "Zero-wyc/ManifestHub-Steam",
  "Anckerioc/STEAM-",
  "WoodenTiger000/SteamManifestHub",
];

// LuaTools/ManifestHub free API endpoints (tried as fallback after GitHub mirrors)
const LUATOOLS_APIS = [
  // Sushi first — raw.githubusercontent.com responds in <1s whether hit or 404
  { name: 'Sushi', url: 'https://raw.githubusercontent.com/sushi-dev55-alt/sushitools-games-repo-alt/refs/heads/main/<appid>.zip' },
  { name: 'Ryuu', url: 'http://167.235.229.108/<appid>' },
];

// Speed tracking for dynamic repo ordering
const repoSpeedCache = new Map();
const repoNegativeCache = new Map();
const depotKeysCache = new Map(); // key: repo name, value: { data: Buffer, parsed: object|null, timestamp: number }
const downloadControllers = new Map(); // key: controller ID, value: AbortController
const REPO_CONCURRENCY = 15;
const REPO_TIMEOUT_MS = 1000; // Timeout per repo URL attempt (halved for faster fallback)
const NEGATIVE_CACHE_TTL = 1800000; // 30 min for failed repos (was 5 min)

// Per-repo manifest count tracking for intelligent ordering
// repos that contributed more manifests get scanned first
const repoManifestCountCache = new Map(); // key: repo name, value: { count: number, timestamp: number }
const repoHitCache = new Set(); // repos that have ever successfully found a game

// Reverse index: maps appid → repos that contain it (built from cached depotkeys)
// Avoids re-scanning all 97 repos for every game install
const repoAppIndex = new Map(); // key: appid (string), value: Array<{ repo: string, depots: object }>

// Check all cached depotkeys for an appid without any network request
function findInCachedDepotkeys(appid) {
  // Fast path: use pre-built reverse index (O(1) lookup instead of O(n) scan)
  const appidStr = String(appid);
  const indexEntries = repoAppIndex.get(appidStr);
  if (indexEntries && indexEntries.length > 0) {
    for (const entry of indexEntries) {
      const cached = depotKeysCache.get(entry.repo);
      if (cached && cached.parsed && cached.parsed[appidStr]) {
        return { repo: entry.repo, appData: cached.parsed[appidStr] };
      }
    }
  }
  // Fallback: scan depotKeysCache directly (in case index hasn't been built yet)
  for (const [repo, cached] of depotKeysCache) {
    if (!cached.parsed) continue;
    if (cached.parsed[appidStr]) {
      return { repo, appData: cached.parsed[appidStr] };
    }
  }
  return null;
}

// All repos are pre-fetched at startup so most games are found instantly
// from cached depotkeys without scanning all repos. 
// Processed in chunks at startup to avoid overwhelming the network.
const TOP_INDEX_REPOS = MIRROR_REPOS;
const INDEX_CHUNK_SIZE = 20; // repos per chunk during startup indexing

let repoIndexPromise = null;

// Pre-fetch depotkeys from top repos in parallel and build fast reverse index.
// After this completes, findInCachedDepotkeys() returns instantly for most games.
async function ensureRepoIndex(sendLog) {
  const log = sendLog || ((msg) => console.log('[MAIN] ' + msg));
  if (!repoIndexPromise) {
    repoIndexPromise = (async () => {
      const startTime = Date.now();
      log('Pre-fetching depotkeys from ' + TOP_INDEX_REPOS.length + ' repos (parallel chunks of ' + INDEX_CHUNK_SIZE + ')...');
      let succeeded = 0;
      // Process repos in chunks to avoid overwhelming the network with 80 simultaneous requests
      for (let i = 0; i < TOP_INDEX_REPOS.length; i += INDEX_CHUNK_SIZE) {
        const chunk = TOP_INDEX_REPOS.slice(i, i + INDEX_CHUNK_SIZE);
        const results = await Promise.allSettled(chunk.map(async (repo) => {
          try {
            await downloadDepotKeys(repo);
            return { repo, status: 'fulfilled' };
          } catch (e) {
            return { repo, status: 'rejected' };
          }
        }));
        succeeded += results.filter(r => r.status === 'fulfilled').length;
      }
      const elapsed = Date.now() - startTime;
      log('Repos indexed in ' + elapsed + 'ms: ' + succeeded + '/' + TOP_INDEX_REPOS.length + ' repos ready');
    })();
  }
  return repoIndexPromise;
}

// Build reverse index from a repo's parsed depotkeys
function indexRepoAppids(repo, parsed) {
  if (!parsed) return;
  const appids = Object.keys(parsed);
  for (const appid of appids) {
    if (!repoAppIndex.has(appid)) repoAppIndex.set(appid, []);
    const entries = repoAppIndex.get(appid);
    if (!entries.some(e => e.repo === repo)) {
      entries.push({ repo, depots: parsed[appid].depots || {} });
    }
  }
}
app.isQuitting = false;

function getOrderedRepos() {
  // Filter out negatively cached repos (temp failures with retry TTL)
  const now = Date.now();
  const activeRepos = MIRROR_REPOS.filter(repo => {
    const cached = repoNegativeCache.get(repo);
    return !cached || (now - cached) > NEGATIVE_CACHE_TTL;
  });
  const priorityRepos = [
    "WARDEN-DEV/Steam_ManifestHub",
    "SteamAutoCracks/ManifestHub",
    "pjy612/SteamManifestCache",
    "pjy612/ManifestAutoUpdate-bak",
    "X06W90X/pjy612",
  ];
  const rest = activeRepos.filter(repo => !priorityRepos.includes(repo));
  rest.sort((a, b) => {
    // PRIMARY: manifest count (descending) — repos with most manifests first
    const aManifest = repoManifestCountCache.get(a);
    const bManifest = repoManifestCountCache.get(b);
    const aCount = aManifest ? aManifest.count : 0;
    const bCount = bManifest ? bManifest.count : 0;
    if (aCount !== bCount) return bCount - aCount;

    // SECONDARY: hit rate — repos that have found games before
    const aHit = repoHitCache.has(a);
    const bHit = repoHitCache.has(b);
    if (aHit !== bHit) return aHit ? -1 : 1;

    // TERTIARY: speed (fastest first) — adaptive over time
    const aTime = repoSpeedCache.get(a) || Infinity;
    const bTime = repoSpeedCache.get(b) || Infinity;
    return aTime - bTime;
  });
  return [...priorityRepos, ...rest];
}

function recordRepoSpeed(repo, timeMs) {
  const prev = repoSpeedCache.get(repo);
  repoSpeedCache.set(repo, prev ? (prev * 0.7 + timeMs * 0.3) : timeMs);
}

// Track how many manifests each repo contributed for intelligent ordering
function recordRepoManifestCount(repo, count) {
  if (count > 0) {
    repoManifestCountCache.set(repo, { count, timestamp: Date.now() });
    repoHitCache.add(repo);
  }
}

const MIRROR_ALT_URLS = [
  "refs/heads/main",
  "refs/heads/master",
  "main",
  "master",
];

// Config, cache, and path functions imported from ./utils/config.cjs and ./utils/paths.cjs

function createWindow() {
  performance.mark('createWindow-start');

  const preloadPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'preload.cjs')
    : path.join(__dirname, 'preload.cjs');

  console.log('[MAIN] preloadPath:', preloadPath);
  console.log('[MAIN] preload exists:', fs.existsSync(preloadPath));

  // ── TLS Certificate Verification ──
  // This previously called callback(0) unconditionally, which accepts EVERY
  // certificate — expired, self-signed, wrong-host, attacker-supplied. That made
  // every HTTPS call (GitHub license registry, Steam)
  // trivially interceptable by anyone on the network path.
  // All hosts we talk to use publicly-trusted certs, so validate normally.
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    if (request.errorCode !== 0) {
      console.warn(`[TLS] Cert validation failed for ${request.hostname}: ${request.errorDescription} (code=${request.errorCode})`);
      callback(-2);  // Reject — use Chromium's verdict
    } else {
      callback(0);   // Accept (Chromium already validated)
    }
  });

  // Proxy config - bypass for Steam CDN
  session.defaultSession.setProxy({ proxyRules: 'direct://' }).then(() => {
    console.log('[MAIN] Proxy set to direct');
  }).catch(e => {
    console.log('[MAIN] Proxy config error:', e.message);
  });

  // Allow loading images from all origins
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET', 'POST', 'OPTIONS'],
        'Access-Control-Allow-Headers': ['Content-Type'],
      }
    });
  });

  // Get the primary display's workArea (taskbar-aware bounds)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, workArea.width),
    height: Math.min(900, workArea.height),
    minWidth: 1024,
    minHeight: 700,
    center: false,
    x: Math.max(0, Math.floor((workArea.width - Math.min(1400, workArea.width)) / 2)),
    y: Math.max(0, Math.floor((workArea.height - Math.min(900, workArea.height)) / 2)),
    backgroundColor: '#030308',
    show: false,
    fullscreenable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      // Same-origin policy stays ON. Nothing here needs it off: <img> loads aren't
      // CORS-gated, getAverageColor() sets crossOrigin='anonymous' and the
      // onHeadersReceived hook above injects Access-Control-Allow-Origin: *, and
      // image-cache:// is registered as a privileged standard scheme.
      webSecurity: true,
      sandbox: false,
      webgl: true,
      enableWebSQL: false,
      v8CacheOptions: 'code',  // Cache compiled JS bytecode between runs
    },
    autoHideMenuBar: true,
    frame: false,
    icon: path.join(__dirname, '..', 'AHG Unlocker Icon.ico'),
  });

  performance.mark('createWindow-end');
  performance.measure('window-create-duration', 'createWindow-start', 'createWindow-end');
  const createWinDuration = performance.getEntriesByName('window-create-duration')[0]?.duration || 0;
  console.log('[PERF] createWindow() took ' + createWinDuration.toFixed(0) + 'ms');

  state.setMainWindow(mainWindow);
  mainWindow.on('maximize', () => {
    // Sync custom state in case native maximize was triggered (Win+Up, titlebar dblclick, etc.)
    if (!mainWindow._isCustomMaximized) {
      mainWindow._isCustomMaximized = true;
      mainWindow._preMaximizeBounds = mainWindow._preMaximizeBounds || mainWindow.getBounds();
    }
    mainWindow?.webContents.send('window-maximize-change', true);
    // Frameless workaround: force window above taskbar after native maximize
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.setAlwaysOnTop(true, 'normal');
        setTimeout(() => {
          if (mainWindow) mainWindow.setAlwaysOnTop(false);
        }, 50);
      }
    }, 50);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow._isCustomMaximized = false;
    mainWindow?.webContents.send('window-maximize-change', false);
    // Frameless windows can lose z-order on unmaximize; force to front
    if (mainWindow) {
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(true, 'normal');
          setTimeout(() => {
            if (mainWindow) mainWindow.setAlwaysOnTop(false);
          }, 50);
        }
      }, 50);
    }
  });

  mainWindow.on('enter-fullscreen', () => {
    mainWindow?.webContents.send('window-fullscreen-change', true);
  });
  mainWindow.on('leave-fullscreen', () => {
    mainWindow?.webContents.send('window-fullscreen-change', false);
  });

  // Handle renderer process crash — log and auto-recover
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[MAIN] Renderer process gone:', details.reason);
    fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'), `${new Date().toISOString()} - Renderer process gone: ${details.reason} (exitCode: ${details.exitCode})\n`);
    // Auto-reload the window after a short delay
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    }, 2000);
  });

  console.log('[MAIN] Window created and shown')

  // Determine the correct base path for the app
  const execDir = path.dirname(process.execPath)
  const resourcesPath = process.resourcesPath
  
  console.log('[MAIN] execDir:', execDir)
  console.log('[MAIN] resourcesPath:', resourcesPath)
  console.log('[MAIN] app.isPackaged:', app.isPackaged)
  
  // Build path based on whether we're packaged
  let indexPath
  
  if (app.isPackaged) {
    // Packaged app - try multiple possible locations
    const possiblePaths = [
      path.join(resourcesPath, 'app', 'dist', 'index.html'),
      path.join(app.getAppPath(), 'dist', 'index.html'),
      path.join(execDir, 'resources', 'app', 'dist', 'index.html'),
      path.join(execDir, 'app', 'dist', 'index.html'),
    ];
    
    for (const p of possiblePaths) {
      console.log('[MAIN] Checking index path:', p, 'exists:', fs.existsSync(p))
      if (fs.existsSync(p)) {
        indexPath = p
        break
      }
    }
    
    if (!indexPath) {
      indexPath = possiblePaths[0] // fallback
    }
  } else {
    // Development
    indexPath = path.join(__dirname, '..', 'dist', 'index.html')
  }
  
  console.log('[MAIN] Loading from:', indexPath)
  // Show window only after content is loaded (prevents blank-frame flash)
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.loadFile(indexPath).then(() => {
    console.log('[MAIN] loadFile succeeded')
  }).catch(err => {
    console.error('[MAIN] loadFile error:', err)
  })
  
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (pythonProcess) {
      pythonProcess.kill();
    }
  });
  
  // Auto-open DevTools when launched with --devtools flag for debugging
  if (process.argv.includes('--devtools')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    console.log('[MAIN-TRACE] DevTools auto-opened via --devtools flag')
  }
}

function startPythonBackend() {
  const pythonScript = getResourcePath('backend/src/api/main.py');
  
  if (!fs.existsSync(pythonScript)) {
    console.log('[MAIN] Python backend not found');
    return;
  }

  const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
  
  try {
    pythonProcess = spawn(pythonExe, [pythonScript], {
      cwd: path.dirname(pythonScript),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    pythonProcess.stdout.on('data', (data) => console.log('[PYTHON]', data.toString().trim()));
    pythonProcess.stderr.on('data', (data) => console.error('[PYTHON ERROR]', data.toString().trim()));
    pythonProcess.on('error', (error) => console.error('[MAIN] Failed to start Python:', error));

    console.log('[MAIN] Python backend started');
  } catch (error) {
    console.error('[MAIN] Error starting Python:', error);
  }
}

async function downloadFromMirror(appid, onProgress) {
  return new Promise((resolve, reject) => {
    for (let i = 0; i < MIRROR_REPOS.length; i++) {
      const repo = MIRROR_REPOS[i];
      const url = `https://github.com/${repo}/archive/refs/heads/${appid}.zip`;
      
      console.log(`[MAIN] Trying ${repo} for app ${appid}...`);
      
      const req = https.get(url, { agent: httpsAgent, headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
        if (res.statusCode === 404) {
          if (i === MIRROR_REPOS.length - 1) {
            reject(new Error(`Game ${appid} not found in any mirror`));
          }
          return;
        }
        if (res.statusCode !== 200) {
          if (i === MIRROR_REPOS.length - 1) {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
          return;
        }
        
        const chunks = [];
        const contentLength = parseInt(res.headers['content-length'] || 0);
        let received = 0;
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
          received += chunk.length;
          if (contentLength && onProgress) {
            onProgress(Math.round(received * 100 / contentLength));
          }
        });
        
        res.on('end', () => {
          console.log(`[MAIN] Downloaded ${received} bytes from ${repo}`);
          resolve(Buffer.concat(chunks));
        });
      });
      
      req.on('error', (e) => {
        console.log(`[MAIN] Error from ${repo}:`, e.message);
        if (i === MIRROR_REPOS.length - 1) {
          reject(e);
        }
      });
      
      req.setTimeout(15000, () => {
        req.destroy();
        if (i === MIRROR_REPOS.length - 1) {
          reject(new Error('Timeout'));
        }
      });
      
      return;
    }
  });
}

// handled by handlers/db.cjs: ipcMain.handle('load-games', ...)

// ── Removed legacy games.json/fixes.json IPC paths ──
// `read-cached-games`, `write-cached-games` (games_cache.json), `filter-games-by-platform`
// (games.json) and `load-fixes` (fixes.json) all sourced catalogue data from static JSON
// instead of the SQLite DBs, which left them stale vs the Ryuu-synced games.db/fixes.db.
// The renderer uses the DB-backed channels instead:
//   • catalogue   → `load-games`            (db.getAllGames)      — handlers/db.cjs
//   • pagination  → `query-games`           (db.queryGames)       — handlers/db.cjs
//   • platform    → `query-games {platform}`(db.queryGames)       — store.getGamesByPlatform
//   • fixes       → `app:init-data`         (db.getAllFixes)      — handlers/init-data.cjs
// These handlers were deleted; their preload bindings were removed too.

// handled by handlers/db.cjs: ipcMain.handle('get-custom-fixes'|'check-new-custom-fixes', ...)

    // ── Initial registration for window-create (critical: window, persist, init-data) ──
registerWindowIpc();
registerInitDataHandler({ customFixesManager });
registerPersistenceHandlers();
// Native image handlers (fast decode + LQIP via C++) — lightweight, no I/O
registerImageNativeHandlers();
// Non-critical handlers (config, db, fixes, install, etc.) are
// loaded deferred after the window is visible — see the setImmediate call below.

// handled by handlers/db.cjs: ipcMain.handle('remote-sync:check', ...)
// handled by handlers/config.cjs: ipcMain.handle('browse-path'|'get-custom-steam-config'|'save-custom-steam-config', ...)

// Install game with detailed logging (delegates to installSteamGame)
ipcMain.handle('install-game-with-logs', async (event, appid) => {
  const controllerId = 'install-' + appid;
  const controller = new AbortController();
  downloadControllers.set(controllerId, controller);
  try {
    const steamPath = findSteamPath(state.customSteamConfig);
    if (!steamPath || !fs.existsSync(steamPath)) {
      return { success: false, message: 'Steam not found. Configure path in Settings.' };
    }
    
    console.log(`[MAIN] Installing app ${appid} with logs...`);
    
    // Create log collector for streaming
    const logs = [];
    const sendLog = (msg) => {
      // Strip appIDs (Steam numeric IDs) from user-visible logs
      let clean = msg
        .replace(/App \d+/gi, 'Game')
        .replace(/appid \d+/gi, '')
        .replace(/for \d+/g, '')
        // Strip repo/source names
        .replace(/from [\w.-]+/g, '')
        .replace(/via [\w.-]+/g, '')
        .replace(/in [\w.-]+/g, '')
        // Simplify common verbose patterns
        .replace(/^Scanning repos for \d+\.\.\. \d+\/\d+$/, 'Checking mirrors...')
        .replace(/^(Trying|Scanning) .+/, 'Checking mirrors...')
        .replace(/^Found in cached repo: .+/, 'Game found on mirrors')
        .replace(/^Found \d+ in cached depotkeys from .+/, 'Game found on mirrors')
        .replace(/^Found in .+ \(\d+ manifests\)$/, 'Game found on mirrors')
        .replace(/^Found via .+$/, 'Game found on mirrors')
        .replace(/^Found \d+ manifests for App \d+ via .+$/, 'Processing game files')
        .replace(/^Found \d+ depots for App \d+ in .+$/, 'Processing game files')
        .replace(/^(Got \d+KB from|ZIP has \d+ entries|Saved:) .+/, 'Downloading game files...')
        .replace(/^DONE! Restart Steam\.$/, 'Install complete! Restart Steam')
        .replace(/^DepotDownloader completed successfully$/, 'Download completed')
        .replace(/^DepotDownloader failed with code \d+: .+$/, 'Download failed')
        .replace(/^Failed to start DepotDownloader: .+$/, 'Downloader failed to start')
        .replace(/^DepotDownloader\.exe not found at: .+$/, 'Downloader not found')
        .replace(/^Checking downloaded files in: .+$/, 'Verifying downloaded files...')
        .replace(/^No manifests found after \w+ run$/, 'No game files found')
        .replace(/^Game not found on DepotBox$/, 'Game not found on CDN')
        .replace(/^DepotBox requires CAPTCHA/, 'Manual download required (CAPTCHA)')
        .replace(/^DepotBox error: .+$/, 'CDN download error')
        .replace(/^DepotDownloader error: .+$/, 'Download error')
        .replace(/^DepotDownloader integration error: .+$/, 'Download error')
        .replace(/^[\w.-]+ is currently down \(DNS error\), skipping\.\.\.$/, 'Mirror temporarily unavailable')
        .replace(/^Got fix from [\w.-]+$/, 'Downloading fix...')
        .replace(/^ERROR: Cannot write to folders!$/, 'Error: Cannot write to game folders')
        .replace(/^ERROR: Not a valid ZIP$/, 'Error: Invalid download data')
        .replace(/^Operation aborted$/, 'Cancelled')
        .replace(/^[\w-]+ returned non-ZIP, skipping$/, 'Invalid data from mirror, skipping')
        // Remove trailing artifacts
        .replace(/\s+for\s+$/, '')
        .replace(/\s+from\s+$/, '')
        .replace(/\s+in\s+$/, '')
        .trim();
      // Collapse multiple spaces
      clean = clean.replace(/\s{2,}/g, ' ');
      if (!clean) return;
      console.log(`[LOG] ${clean}`);
      logs.push(clean);
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('install-log', { appid, message: clean });
        }
      } catch (e) { /* ignore */ }
    };
    
    sendLog(`Installing game...`);
    
    // Fire-and-forget: don't block install on depotkey indexing.
    // ZIP probing in installSteamGame races all repos in parallel (~2s),
    // so waiting for 97 depotkey downloads is counterproductive.
    ensureRepoIndex(sendLog).catch(() => {});
    
    const result = await installSteamGame(appid, steamPath, sendLog, controller.signal);
    
    if (result && result.foundRepo) {
      return {
        success: true,
        message: logs.join('\n'),
        repo: result.foundRepo,
        manifests: result.manifestCount,
        totalSize: result.totalSize || 0
      };
    } else if (result && result.requested) {
      return { success: false, requested: true, message: result.requestMessage || 'Not available yet — we\'ve requested it. Try again later.' };
    } else {
      return { success: false, message: (result && result.requestMessage) || `App ${appid} not found in any manifest mirror.\n\n${logs.join('\n')}` };
    }
  } catch (error) {
    console.error('[MAIN] Install error:', error);
    return { success: false, message: error.message };
  } finally {
    downloadControllers.delete(controllerId);
  }
});

// Download depotkeys.json to get manifest info
async function downloadDepotKeys(repo) {
  const cached = depotKeysCache.get(repo);
  if (cached && (Date.now() - cached.timestamp) < NEGATIVE_CACHE_TTL) {
    console.log(`[MAIN] Using cached depotkeys from ${repo}`);
    return cached.data;
  }

  // Only try main and master — refs/heads/ variants are equivalent via redirect
  const urlFormats = [
    `https://raw.githubusercontent.com/${repo}/main/depotkeys.json`,
    `https://raw.githubusercontent.com/${repo}/master/depotkeys.json`
  ];
  
  console.log(`[MAIN] Trying depotkeys from ${repo} (racing 2 URLs)...`);
  const startTime = Date.now();
  
  // Race both URLs concurrently; first success wins
  // Uses total timeout (not idle) — aborts after REPO_TIMEOUT_MS regardless of activity
  const results = await Promise.allSettled(urlFormats.map(url =>
    new Promise((resolve, reject) => {
      const req = https.get(url, { agent: httpsAgent, headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
        if (res.statusCode === 200) {
          const chunks = [];
          const totalTimer = setTimeout(() => { req.destroy(); reject(new Error('Timeout')); }, REPO_TIMEOUT_MS);
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            clearTimeout(totalTimer);
            resolve({ data: Buffer.concat(chunks), url });
          });
          res.on('error', (e) => { clearTimeout(totalTimer); reject(e); });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
      req.on('error', reject);
      req.setTimeout(REPO_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
    })
  ));

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { data, url } = result.value;
      recordRepoSpeed(repo, Date.now() - startTime);
      console.log(`[MAIN] Got depotkeys from ${url.slice(0,80)}...`);
      // Parse and cache — stores both raw Buffer and structured JSON for fast lookups
      let parsed = null;
      try { parsed = JSON.parse(data.toString()); } catch (e) { /* not critical */ }
      depotKeysCache.set(repo, { data, parsed, timestamp: Date.now() });
      if (parsed) indexRepoAppids(repo, parsed);
      repoNegativeCache.delete(repo);
      return data;
    }
  }
  
  // All failed — log the first failure reason
  const firstError = results[0]?.reason?.message || 'Unknown';
  console.log(`[MAIN] All ${urlFormats.length} URLs failed for ${repo}: ${firstError}`);
  throw new Error(`Not found in any branch (${firstError})`);
}

// Try to get app data from Steam API
async function getSteamAppData(appid) {
  return new Promise((resolve, reject) => {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
    const req = https.get(url, { agent: httpsAgent, headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
      if (res.statusCode === 200) {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Download actual manifest files
async function downloadManifest(appid, depotid, manifestid, repo, steamPath) {
  const depotCache = getCustomDepotCachePath(state.customSteamConfig) || path.join(steamPath, 'depotcache');
  fs.mkdirSync(depotCache, { recursive: true });
  
  // Try different URL formats for manifests
  const urlFormats = [
    `https://raw.githubusercontent.com/${repo}/main/depotcache/${depotid}_${manifestid}.manifest`,
    `https://raw.githubusercontent.com/${repo}/main/manifests/${depotid}_${manifestid}.manifest`,
    `https://raw.githubusercontent.com/${repo}/master/depotcache/${depotid}_${manifestid}.manifest`,
    `https://raw.githubusercontent.com/${repo}/master/manifests/${depotid}_${manifestid}.manifest`,
    `https://raw.githubusercontent.com/${repo}/refs/heads/main/depotcache/${depotid}_${manifestid}.manifest`,
  ];
  
  for (const url of urlFormats) {
    try {
      const data = await new Promise((resolve, reject) => {
        const req = https.get(url, { agent: httpsAgent, headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
          if (res.statusCode === 200) {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
      });
      
      // Save the manifest file
      const manifestPath = path.join(depotCache, `${depotid}_${manifestid}.manifest`);
      fs.writeFileSync(manifestPath, data);
      console.log(`[MAIN] Saved manifest to ${manifestPath}`);
      return true;
    } catch (e) {
      continue;
    }
  }
  return false;
}

// Download full zip from GitHub releases for the game
async function downloadFromMirrorSingle(appid, repo) {
  return new Promise(async (resolve, reject) => {
    // First, try to get the depotkeys to find app manifests
    let depotKeysData = null;
    try {
      depotKeysData = await downloadDepotKeys(repo);
      const depotKeys = JSON.parse(depotKeysData.toString());
      
      // Look for this appid in depotkeys
      if (depotKeys[appid]) {
        const appData = depotKeys[appid];
        const depots = appData.depots || {};
        
        // Download each depot's manifest
        for (const depotId in depots) {
          const depotData = depots[depotId];
          if (depotData.manifestid) {
            await downloadManifest(appid, depotId, depotData.manifestid, repo, findSteamPath(state.customSteamConfig));
          }
        }
        
        resolve(Buffer.from(JSON.stringify({ appid, depots, installed: true })));
        return;
      }
    } catch (e) {
      console.log(`[MAIN] Could not get depotkeys: ${e.message}`);
    }
    
    // Fallback: try to get direct manifest files
    const urlFormats = [
      `https://raw.githubusercontent.com/${repo}/main/depotcache/${appid}.json`,
      `https://raw.githubusercontent.com/${repo}/main/depotcache/${appid}_manifest.json`,
      `https://raw.githubusercontent.com/${repo}/master/depotcache/${appid}.json`,
      `https://raw.githubusercontent.com/${repo}/master/manifests/${appid}.json`,
      `https://raw.githubusercontent.com/${repo}/refs/heads/main/${appid}.json`,
    ];
    
    for (const url of urlFormats) {
      try {
        const data = await new Promise((resolve, reject) => {
          const req = https.get(url, { agent: httpsAgent, headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
            if (res.statusCode === 200) {
              const chunks = [];
              res.on('data', (chunk) => chunks.push(chunk));
              res.on('end', () => resolve(Buffer.concat(chunks)));
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
          req.on('error', reject);
          req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
        });
        resolve(data);
        return;
      } catch (e) {
        continue;
      }
    }
    
    reject(new Error('Not found in any format'));
  });
}

// Copy manifest to Steam depotcache
async function copyManifestToSteam(manifestData, appid, steamPath) {
  const depotCache = getCustomDepotCachePath(state.customSteamConfig) || path.join(steamPath, 'depotcache');
  const luaPath = getCustomStPluginPath(state.customSteamConfig) || path.join(steamPath, 'config', 'stplug-in');
  
  fs.mkdirSync(depotCache, { recursive: true });
  fs.mkdirSync(luaPath, { recursive: true });
  
  try {
    const data = JSON.parse(manifestData.toString());
    
    // If we have depot info, save it
    if (data.depots) {
      for (const [depotId, depotData] of Object.entries(data.depots)) {
        if (depotData.manifestid) {
          const manifestPath = path.join(depotCache, `${depotId}_${depotData.manifestid}.manifest`);
          // The downloadManifest function already saves these
          console.log(`[MAIN] Would save ${manifestPath}`);
        }
      }
    }
    
    // Save app info
    const appInfoPath = path.join(depotCache, `${appid}_appinfo.json`);
    enqueueAppinfoWrite(appid, () => fs.writeFileSync(appInfoPath, manifestData.toString()), appInfoPath);
    
    return { success: true, saved: true };
  } catch (e) {
    // Save raw data
    const rawPath = path.join(depotCache, `${appid}_info.txt`);
    fs.writeFileSync(rawPath, manifestData.toString());
    return { success: true, warning: 'Saved as raw file' };
  }
}

// Helper: download from DepotBox.org
async function downloadFromDepotBox(appid, depotCache, luaPath, sendLog) {
  try {
    sendLog('Trying DepotBox.org for ' + appid + '...');
    // Try the direct download endpoint
    const url = 'https://depotbox.org/' + appid;
    
    // First, get the page to check if game exists
    const pageData = await httpGet(url);
    const pageStr = pageData.toString();
    
    // Check if there's a direct download link or if CAPTCHA is required
    if (pageStr.includes('Try Direct Download') || pageStr.includes('download')) {
      sendLog('Game found on DepotBox, attempting download...');
      
      // Try to get the download - this may require CAPTCHA handling
      // For now, try common download URL patterns
      const downloadUrls = [
        'https://depotbox.org/api/download?appid=' + appid,
        'https://depotbox.org/download/' + appid,
        'https://depotbox.org/' + appid + '/download'
      ];
      
      for (const dlUrl of downloadUrls) {
        try {
          const zipData = await httpGet(dlUrl);
          
          // Check if it's a valid ZIP
          if (zipData.length > 100 && zipData[0] === 0x50 && zipData[1] === 0x4B) {
            
            const zip = new AdmZip(zipData);
            const entries = zip.getEntries();
            
            let manifestCount = 0;
            let totalSize = 0;
            let hasLua = false;
            
            for (const entry of entries) {
              const fn = path.basename(entry.entryName);
              if (fn.endsWith('.manifest')) {
                const content = zip.readFile(entry);
                const destPath = path.join(depotCache, fn);
                fs.writeFileSync(destPath, content);
                manifestCount++;
                totalSize += content.length;
              } else if (fn.endsWith('.lua') && !hasLua) {
                const luaData = zip.readFile(entry);
                const luaDest = path.join(luaPath, appid + '.lua');
                fs.writeFileSync(luaDest, luaData);
                hasLua = true;
              }
            }
            
            if (manifestCount > 0 && !hasLua) {
              const lp = path.join(luaPath, appid + '.lua');
              fs.writeFileSync(lp, 'function OnStartup() Log("App ' + appid + '") end return OnStartup');
              sendLog('Lua generated');
            }
            
            if (manifestCount > 0) {
              const appInfoPath = path.join(depotCache, appid + '_appinfo.json');
              enqueueAppinfoWrite(appid, () => fs.writeFileSync(appInfoPath, JSON.stringify({ appid: appid, source: 'depotbox.org' })), appInfoPath);
              sendLog('DONE! Got ' + manifestCount + ' manifests from DepotBox');
              return { success: true, manifestCount, totalSize };
            }
          }
        } catch (err) {
          // URL failed, try next
        }
      }
    } else if (pageStr.includes('CAPTCHA') || pageStr.includes('Turnstile')) {
      sendLog('DepotBox requires CAPTCHA - skipping automated download');
    } else {
      sendLog('Game not found on DepotBox');
    }
  } catch (err) {
    sendLog('DepotBox error: ' + err.message);
  }
  return { success: false };
}

// Helper: download using DepotDownloader.exe (Steam CDN)
async function downloadWithDepotDownloader(appid, depotCache, luaPath, sendLog) {
  try {
    sendLog('Trying DepotDownloader for AppID ' + appid + '...');
    
    const ddPath = getDepotDownloaderPath();
    if (!fs.existsSync(ddPath)) {
      sendLog('DepotDownloader.exe not found at: ' + ddPath);
      return { success: false };
    }
    
    // Create temp directory for download
    const tempDir = path.join(app.getPath('temp'), 'ahg_depot_' + appid);
    fs.mkdirSync(tempDir, { recursive: true });
    
    sendLog('Downloading manifests from Steam CDN (anonymous)...');
    
    // Run DepotDownloader with anonymous login
    // Command: DepotDownloader.exe -app <appid> -dir <tempDir>
    const args = [
      '-app', appid.toString(),
      '-dir', tempDir
      // Anonymous login - no username/password needed for free games
    ];
    
    sendLog('Executing: DepotDownloader.exe ' + args.join(' '));
    
    await new Promise((resolve, reject) => {
      const proc = spawn(ddPath, args, {
        cwd: path.dirname(ddPath),
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        // Log important lines
        if (text.includes('Downloading') || text.includes('manifest') || text.includes('Error')) {
          sendLog('DD: ' + text.trim());
        }
      });
      
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          sendLog('DepotDownloader completed successfully');
          resolve();
        } else {
          sendLog('DepotDownloader failed with code ' + code + ': ' + stderr);
          reject(new Error('DepotDownloader exit code: ' + code));
        }
      });
      
      proc.on('error', (err) => {
        sendLog('Failed to start DepotDownloader: ' + err.message);
        reject(err);
      });
    });
    
    // Check for downloaded files
    sendLog('Checking downloaded files in: ' + tempDir);
    let manifestCount = 0;
    
    // Async: a large DepotDownloader temp tree froze the main process when walked sync.
    async function searchAndCopy(dir) {
      if (!fs.existsSync(dir)) return;
      const files = await fs.promises.readdir(dir, { recursive: true, withFileTypes: true });
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(file.path || dir, file.name);
          const ext = path.extname(file.name).toLowerCase();
          
          if (ext === '.manifest') {
            const destPath = path.join(depotCache, file.name);
            await fs.promises.copyFile(filePath, destPath);
            manifestCount++;
            sendLog('Copied manifest: ' + file.name);
          } else if (ext === '.lua' || file.name.endsWith('.lua')) {
            const luaDest = path.join(luaPath, appid + '.lua');
            await fs.promises.copyFile(filePath, luaDest);
            sendLog('Copied LUA: ' + file.name);
          }
        }
      }
    }
    
    await searchAndCopy(tempDir);
    
    // Clean up temp directory
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    
    if (manifestCount > 0) {
      // Generate Lua if not present
      const luaPathFinal = path.join(luaPath, appid + '.lua');
      if (!fs.existsSync(luaPathFinal)) {
        fs.writeFileSync(luaPathFinal, 'function OnStartup() Log("App ' + appid + '") end return OnStartup');
        sendLog('Lua generated');
      }
      
      const ddAppInfoPath = path.join(depotCache, appid + '_appinfo.json');
      enqueueAppinfoWrite(appid, () => fs.writeFileSync(ddAppInfoPath, JSON.stringify({ appid: appid, source: 'DepotDownloader' })), ddAppInfoPath);
      sendLog('DONE! Got ' + manifestCount + ' manifests from DepotDownloader');
      return { success: true, manifestCount, totalSize: 0 };
    } else {
      sendLog('No manifests found after DepotDownloader run');
    }
  } catch (err) {
    sendLog('DepotDownloader error: ' + err.message);
  }
  return { success: false };
}

// Try LuaTools/ManifestHub free APIs as fallback (after GitHub mirrors)
// ── Generator.ryuu.lol PRIMARY — tried before ANY mirror ──
// Uses the reseller panel API key to fetch manifests + LUA directly.
// Endpoints: secure_download (manifests ZIP) and resellerlua (LUA file)
const RYUU_API_KEY = require('./ryuuDownloader.cjs').DEFAULT_AUTH_CODE;
const RYUU_BASE = 'https://generator.ryuu.lol';

async function tryRyuuLolPrimary(appid, depotCache, luaPath, sendLog, signal) {
  if (signal && signal.aborted) { sendLog('Operation aborted'); return null; }

  const winnerAbort = new AbortController();
  if (signal) signal.addEventListener('abort', () => winnerAbort.abort());

  sendLog(`Trying generator.ryuu.lol as primary source for ${appid}...`);

  // Fire manifest and LUA requests in parallel
  const manifestUrl = `${RYUU_BASE}/secure_download?appid=${appid}&auth_code=${RYUU_API_KEY}`;
  const luaUrl = `${RYUU_BASE}/resellerlua?appid=${appid}&auth_code=${RYUU_API_KEY}`;

  const [manifestResult, luaResult] = await Promise.allSettled([
    (async () => {
      if (winnerAbort.signal.aborted) return null;
      const data = await httpGet(manifestUrl, winnerAbort.signal, 15000);
      if (winnerAbort.signal.aborted) return null;
      let zip;
      try {
        zip = new AdmZip(data);
      } catch (zipErr) {
        const preview = data.slice(0, 200).toString('utf8').replace(/\n/g, '\\n');
        sendLog('Ryuu manifest response is not a valid ZIP: ' + zipErr.message);
        console.log('[RYUU-DIAG] secure_download preview:', preview);
        return null;
      }
      const entries = zip.getEntries();
      let count = 0;
      let size = 0;
      let failed = 0;
      let zipLua = null;
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const fn = path.basename(entry.entryName);
        if (fn.endsWith('.manifest')) {
          // Per-file guard: a single bad/locked write must not abort the rest
          // (previously one throw rejected the whole stage → 0 manifests on disk
          //  while a later lua-only fallback still dropped a lone appinfo.json).
          try {
            const content = zip.readFile(entry);
            if (!content || content.length === 0) { failed++; console.log('[RYUU-DIAG] empty manifest entry:', fn); continue; }
            fs.writeFileSync(path.join(depotCache, fn), content);
            count++;
            size += content.length;
          } catch (wErr) {
            failed++;
            console.log('[RYUU-DIAG] failed to write manifest ' + fn + ': ' + wErr.message);
          }
        } else if (fn.endsWith('.lua')) {
          // The secure_download ZIP bundles the REAL SteamTools lua (addappid + setManifestid).
          // Capture it so we can prefer it over the resellerlua endpoint, which can return
          // an empty body → no-op stub lua that never mounts the manifests.
          try {
            const luaData = zip.readFile(entry);
            if (luaData && luaData.length > 0) zipLua = luaData;
          } catch (lErr) {
            console.log('[RYUU-DIAG] failed to read zip lua ' + fn + ': ' + lErr.message);
          }
        }
      }
      if (failed > 0) sendLog('Ryuu: ' + count + ' manifests saved, ' + failed + ' failed to write');
      return { manifestCount: count, totalSize: size, zipLua };
    })(),

    (async () => {
      if (winnerAbort.signal.aborted) return null;
      const data = await httpGet(luaUrl, winnerAbort.signal, 15000);
      if (winnerAbort.signal.aborted) return null;
      // Try ZIP first (some endpoints return ZIP with LUA inside)
      if (data.length >= 4 && data[0] === 0x50 && data[1] === 0x4B) {
        const zip = new AdmZip(data);
        const entries = zip.getEntries();
        let hasLua = false;
        let luaCount = 0;
        for (const entry of entries) {
          const fn = path.basename(entry.entryName);
          if (fn.endsWith('.lua')) {
            const luaData = zip.readFile(entry);
            const luaDest = path.join(luaPath, appid + '.lua');
            fs.writeFileSync(luaDest, luaData);
            hasLua = true;
            luaCount++;
          }
        }
        return { hasLua, luaCount };
      }
      // Not a ZIP — resellerlua returns plain text Lua code (addappid(...) etc.)
      const luaText = data.toString('utf8').trim();
      if (luaText.length > 0) {
        const luaDest = path.join(luaPath, appid + '.lua');
        fs.writeFileSync(luaDest, luaText);
        sendLog(`Saved LUA for App ${appid} from plain text (${luaText.length} bytes)`);
        return { hasLua: true, luaCount: 1 };
      }
      sendLog('Ryuu LUA response is empty, skipping');
      return null;
    })(),
  ]);

  // Sum up results
  const manifests = manifestResult.status === 'fulfilled' && manifestResult.value
    ? manifestResult.value : { manifestCount: 0, totalSize: 0, zipLua: null };
  const luaInfo = luaResult.status === 'fulfilled' && luaResult.value
    ? luaResult.value : { hasLua: false, luaCount: 0 };

  // At least some manifests found == success
  if (manifests.manifestCount > 0) {
    winnerAbort.abort();
    // Prefer the real lua bundled in the manifest ZIP over the resellerlua endpoint.
    // The resellerlua body is often empty, which would otherwise leave hasLua=false →
    // installSteamGame writes a no-op stub lua and the game never unlocks despite
    // having all its manifests on disk.
    let hasLua = luaInfo.hasLua;
    if (manifests.zipLua) {
      try {
        fs.writeFileSync(path.join(luaPath, appid + '.lua'), manifests.zipLua);
        hasLua = true;
      } catch (e) {
        console.log('[RYUU-DIAG] failed to write zip lua: ' + e.message);
      }
    }
    sendLog(`Found ${manifests.manifestCount} manifests for App ${appid} via generator.ryuu.lol` + (hasLua ? ' (with LUA)' : ''));
    return {
      foundRepo: 'generator.ryuu.lol',
      manifestCount: manifests.manifestCount,
      totalSize: manifests.totalSize,
      hasLua,
    };
  }

  sendLog('generator.ryuu.lol did not have ' + appid + ' — falling back to mirrors');
  return null;
}

async function tryLuaToolsApis(appid, depotCache, luaPath, sendLog, signal) {
  const apis = [...LUATOOLS_APIS];

  if (apis.length === 0) return null;
  if (signal && signal.aborted) { sendLog('Operation aborted'); return null; }

  // ── Pre-flight health check ──
  const healthyApis = await getHealthyEndpoints(apis, sendLog);
  if (healthyApis.length === 0) {
    sendLog('All LuaTools APIs are unreachable, skipping');
    return null;
  }
  if (healthyApis.length < apis.length) {
    sendLog(`Proceeding with ${healthyApis.length}/${apis.length} healthy APIs`);
  }

  // Shared abort: first successful API cancels all others immediately.
  // Also wired to the external signal so user cancellation kills in-flight requests.
  const winnerAbort = new AbortController();
  if (signal) signal.addEventListener('abort', () => winnerAbort.abort());

  sendLog('Trying ' + healthyApis.length + ' APIs in parallel for ' + appid + '...');

  const results = await Promise.allSettled(healthyApis.map(async (api) => {
    if (winnerAbort.signal.aborted) return null;

    const url = api.url.replace('<appid>', String(appid));
    sendLog('Trying ' + api.name + ' for ' + appid + '...');

    try {
      // 10s timeout per API — Sushi (raw GitHub) responds in <1s, others are unreachable
      const zipData = await httpGetWithProgress(url, null, winnerAbort.signal, 10000);

      if (winnerAbort.signal.aborted) return null;

      // Validate ZIP header
      if (zipData.length < 4 || zipData[0] !== 0x50 || zipData[1] !== 0x4B) {
        sendLog(api.name + ' returned non-ZIP, skipping');
        return null;
      }

      sendLog('Got ' + Math.round(zipData.length / 1024) + 'KB from ' + api.name);

      const zip = new AdmZip(zipData);
      const entries = zip.getEntries();
      sendLog('ZIP has ' + entries.length + ' entries');

      let manifestCount = 0;
      let totalSize = 0;
      let hasLua = false;

      for (const entry of entries) {
        const fn = path.basename(entry.entryName);
        if (fn.endsWith('.manifest')) {
          const content = zip.readFile(entry);
          const destPath = path.join(depotCache, fn);
          fs.writeFileSync(destPath, content);
          manifestCount++;
          totalSize += content.length;
          sendLog('Saved: ' + fn + ' (' + content.length + ' bytes)');
        } else if (fn.endsWith('.lua') && !hasLua) {
          const luaData = zip.readFile(entry);
          const luaDest = path.join(luaPath, appid + '.lua');
          fs.writeFileSync(luaDest, luaData);
          hasLua = true;
          sendLog('Lua saved');
        }
      }

      sendLog('Found ' + manifestCount + ' manifests for App ' + appid + ' via ' + api.name);
      markHealthy(api.name); // Update health cache
      winnerAbort.abort(); // Cancel all other in-flight requests immediately
      return { foundRepo: 'LuaTools: ' + api.name, manifestCount, totalSize, hasLua };
    } catch (err) {
      if (winnerAbort.signal.aborted) return null; // cancelled by another API's success, ignore
      sendLog(api.name + ' unavailable: ' + (err.message || err).slice(0, 80));
      return null;
    }
  }));

  // Return first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) return result.value;
  }
  return null;
}

// Install game - checks GitHub mirrors (Warden/SteamAutoCracks priority) first, then LuaTools APIs
async function installSteamGame(appid, steamPath, sendLog, signal) {
  // Honor custom depot/stplugin folders from Settings. Every other install path
  // (install-helpers, install.cjs, installed.cjs) resolves these; this copy
  // previously hardcoded <steamPath>/depotcache + <steamPath>/config/stplug-in,
  // so when those custom paths were configured the game's manifest + lua landed
  // in the wrong folder and SteamTools never mounted it → game absent from the
  // Steam library. Root-cause fix: resolve the same way the siblings do.
  const depotCache = getCustomDepotCachePath(state.customSteamConfig) || path.join(steamPath, 'depotcache');
  const luaPath = getCustomStPluginPath(state.customSteamConfig) || path.join(steamPath, 'config', 'stplug-in');
  
  try {
    fs.mkdirSync(depotCache, { recursive: true });
    fs.mkdirSync(luaPath, { recursive: true });
  } catch (e) {
    sendLog('ERROR: Cannot write to folders!');
    return { foundRepo: null, manifestCount: 0 };
  }
  
  // INSTANT EXIT: Check if game is already installed
  const luaFile = path.join(luaPath, appid + '.lua');
  if (fs.existsSync(luaFile)) {
    sendLog('App ' + appid + ' is already installed');
    return { foundRepo: 'already-installed', manifestCount: 0 };
  }
  
  sendLog('Installing App ' + appid + '...');
  
  let foundRepo = null;
  let manifestCount = 0;
  let totalSize = 0;
  let hasLua = false;
  
  console.log('[INSTALL-DIAG] installSteamGame called for appid=' + appid + ' steamPath=' + steamPath + ' depotCache=' + depotCache);
  
  // STEP 0 ⭐: Try generator.ryuu.lol as PRIMARY source (fastest, most reliable).
  // This runs BEFORE any mirror scanning or depotkey cache lookups.
  // Uses reseller panel API key for secure_download + resellerlua endpoints.
  if (!foundRepo) {
    console.log('[INSTALL-DIAG] STAGE 0: trying ryuu.lol primary');
    const ryuuResult = await tryRyuuLolPrimary(appid, depotCache, luaPath, sendLog, signal);
    if (ryuuResult) {
      console.log('[INSTALL-DIAG] STAGE 0 result: foundRepo=' + ryuuResult.foundRepo + ' manifestCount=' + ryuuResult.manifestCount);
      foundRepo = ryuuResult.foundRepo;
      manifestCount = ryuuResult.manifestCount;
      totalSize = ryuuResult.totalSize || 0;
      hasLua = ryuuResult.hasLua;
      sendLog('✓ Game added via generator.ryuu.lol');
    } else {
      console.log('[INSTALL-DIAG] STAGE 0 result: null (no result from ryuu primary)');
    }
  }
  
  // FIRST: Check cached depotkeys (instant, no network) — avoids scanning 97 repos
  if (!foundRepo) {
    console.log('[INSTALL-DIAG] STAGE 1: checking cached depotkeys');
    const cachedHit = findInCachedDepotkeys(appid);
    if (cachedHit) {
      sendLog(`Found ${appid} in cached depotkeys from ${cachedHit.repo} — downloading manifests directly`);
      // Download manifests from the cached repo immediately
      try {
        const result = await tryRepoForGame(appid, cachedHit.repo, depotCache, luaPath, sendLog);
        if (result) {
          foundRepo = cachedHit.repo;
          manifestCount = result.manifestCount;
          totalSize = result.totalSize || 0;
          hasLua = result.hasLua;
          repoHitCache.add(cachedHit.repo);
          recordRepoManifestCount(cachedHit.repo, manifestCount);
          sendLog('Found in cached repo: ' + foundRepo + ' (' + manifestCount + ' manifests)');
        }
      } catch (e) {
        sendLog(`Cached repo ${cachedHit.repo} failed to serve manifests: ${e.message.slice(0, 60)}, falling back to scan`);
      }
    } else {
      console.log('[INSTALL-DIAG] STAGE 1: no cached depotkeys hit for appid ' + appid);
    }
  }

  // Second: Parallel ZIP branch probing across ALL repos with shared abort.
  // The old approach tried depotkeys.json first (404 for most repos), then fell
  // through to ZIP — wasting 5s per repo on the dead-end depotkeys step.
  // Now we probe ZIP branches directly. When ANY worker finds the game,
  // a shared AbortController cancels ALL other in-flight requests immediately.
  if (!foundRepo) {
    const orderedRepos = getOrderedRepos();
    if (orderedRepos.length > 0) {
      sendLog(`ZIP-scanning all ${orderedRepos.length} repos for ${appid} in parallel...`);
      const zipAbort = new AbortController();
      
      // Race ALL repos simultaneously with individual 2s timeouts.
      // First success aborts all others, making this as fast as the fastest successful response.
      await Promise.allSettled(orderedRepos.map(async (repo) => {
        if (foundRepo || zipAbort.signal.aborted) return;
        
        const url = `https://github.com/${repo}/archive/refs/heads/${appid}.zip`;
        const startTime = Date.now();
        
        let zipData;
        try {
          zipData = await httpGet(url, zipAbort.signal, REPO_TIMEOUT_MS);
        } catch (e) {
          recordRepoSpeed(repo, Date.now() - startTime);
          return;
        }
        
        if (foundRepo || zipAbort.signal.aborted) return;
        
        // Must be a real ZIP (starts with PK)
        if (zipData.length < 4 || zipData[0] !== 0x50 || zipData[1] !== 0x4B) return;
        
        // Extract manifests from ZIP
        const zip = new AdmZip(zipData);
        const entries = zip.getEntries();
        let foundManifests = false;
        
        for (const entry of entries) {
          const fn = path.basename(entry.entryName);
          if (fn.endsWith('.manifest')) {
            const content = zip.readFile(entry);
            const destPath = path.join(depotCache, fn);
            fs.writeFileSync(destPath, content);
            manifestCount++;
            totalSize += content.length;
            foundManifests = true;
          } else if (fn.endsWith('.lua') && !hasLua) {
            const luaData = zip.readFile(entry);
            fs.writeFileSync(path.join(luaPath, appid + '.lua'), luaData);
            hasLua = true;
          }
        }
        
        if (foundManifests && !foundRepo && !zipAbort.signal.aborted) {
          foundRepo = repo;
          repoHitCache.add(repo);
          repoNegativeCache.delete(repo);
          recordRepoManifestCount(repo, manifestCount);
          sendLog(`Found in ${repo} (${manifestCount} manifests)`);
          zipAbort.abort();  // Cancel ALL other in-flight requests
        }
      }));
      // Safety net: ensure abort if foundRepo was set without abort being called
      if (foundRepo) {
        zipAbort.abort();
      }
    }
    console.log('[INSTALL-DIAG] STAGE 2 (ZIP probing) result: foundRepo=' + foundRepo + ' manifestCount=' + manifestCount);

    // Fallback to LuaTools/ManifestHub APIs only if mirrors didn't find it
    if (!foundRepo) {
      console.log('[INSTALL-DIAG] STAGE 3: trying LuaTools APIs');
      const luaToolsResult = await tryLuaToolsApis(appid, depotCache, luaPath, sendLog, signal);
      if (luaToolsResult) {
        console.log('[INSTALL-DIAG] STAGE 3 result: foundRepo=' + luaToolsResult.foundRepo + ' manifestCount=' + luaToolsResult.manifestCount);
        foundRepo = luaToolsResult.foundRepo;
        manifestCount = luaToolsResult.manifestCount;
        totalSize = luaToolsResult.totalSize || 0;
        hasLua = luaToolsResult.hasLua;
        sendLog('Found via ' + foundRepo);
        sendLog('✓ Game added using LuaTools API');
      } else {
        console.log('[INSTALL-DIAG] STAGE 3 result: null');
      }
    }
    
    // If not found in mirrors, try ryuu.lol fixes
    if (!foundRepo) {
      console.log('[INSTALL-DIAG] STAGE 4: trying ryuu.lol fallback');
      try {
        const ryuuUrl = 'https://generator.ryuu.lol/download?appid=' + appid + '&file_type=manifest';
        console.log('[MAIN] Trying ryuu.lol:', ryuuUrl);
        const zipData = await httpGet(ryuuUrl, signal);
        console.log('[MAIN] Got ryuu.lol data:', zipData.length);
        sendLog('Got fix from ryuu.lol');
        
        const zip = new AdmZip(zipData);
        const entries = zip.getEntries();
        
        let foundAny = false;
        for (const entry of entries) {
          const fn = path.basename(entry.entryName);
          if (fn.endsWith('.manifest')) {
            const content = zip.readFile(entry);
            const destPath = path.join(depotCache, fn);
            fs.writeFileSync(destPath, content);
            manifestCount++;
            totalSize += content.length;
            foundAny = true;
          } else if (fn.endsWith('.lua') && !hasLua) {
            const luaData = zip.readFile(entry);
            const luaDest = path.join(luaPath, appid + '.lua');
            fs.writeFileSync(luaDest, luaData);
            hasLua = true;
            foundAny = true;
          }
        }
        if (foundAny) {
          foundRepo = 'ryuu.lol';
          console.log('[INSTALL-DIAG] STAGE 4: found manifestCount=' + manifestCount + ' lua=' + hasLua);
        } else {
          console.log('[INSTALL-DIAG] STAGE 4: ZIP had no manifests or lua files, not setting foundRepo');
          sendLog('ryuu.lol ZIP was empty, skipping');
        }
      } catch (err) {
        if (err.message && err.message.includes('ENOTFOUND')) {
          sendLog('ryuu.lol is currently down (DNS error), skipping...');
        } else {
          sendLog('ryuu.lol error: ' + err.message);
        }
      }
    }
    
    // If still not found, try DepotBox.org
    if (!foundRepo) {
      console.log('[INSTALL-DIAG] STAGE 5: trying DepotBox');
      try {
        const depotBoxResult = await downloadFromDepotBox(appid, depotCache, luaPath, sendLog);
        if (depotBoxResult.success) {
          foundRepo = 'depotbox.org';
          manifestCount = depotBoxResult.manifestCount;
          totalSize = depotBoxResult.totalSize || 0;
          console.log('[INSTALL-DIAG] STAGE 5: success manifestCount=' + depotBoxResult.manifestCount);
        } else {
          console.log('[INSTALL-DIAG] STAGE 5: no success');
        }
      } catch (err) {
        sendLog('DepotBox integration error: ' + err.message);
      }
    }
    
    // Last resort: try DepotDownloader (Steam CDN)
    if (!foundRepo) {
      console.log('[INSTALL-DIAG] STAGE 6: trying DepotDownloader');
      try {
        const ddResult = await downloadWithDepotDownloader(appid, depotCache, luaPath, sendLog);
        if (ddResult.success) {
          foundRepo = 'DepotDownloader';
          manifestCount = ddResult.manifestCount;
          totalSize = ddResult.totalSize || 0;
          console.log('[INSTALL-DIAG] STAGE 6: success manifestCount=' + ddResult.manifestCount);
        } else {
          console.log('[INSTALL-DIAG] STAGE 6: no success');
        }
      } catch (err) {
        sendLog('DepotDownloader error: ' + err.message);
      }
    }
  }
  
  console.log('[INSTALL-DIAG] FINAL: foundRepo=' + foundRepo + ' manifestCount=' + manifestCount + ' totalSize=' + totalSize + ' hasLua=' + hasLua);
  console.log('[INSTALL-DIAG] depotCache path exists=' + fs.existsSync(depotCache));
  
  // A real install REQUIRES manifests on disk. If a stage set foundRepo but wrote
  // zero manifests (e.g. a lua-only fallback), treat it as NOT installed — otherwise
  // we'd drop a lone <appid>_appinfo.json into depotcache and falsely report success.
  // This is the "only appinfo.json gets there, no manifests" symptom.
  if (foundRepo && manifestCount === 0) {
    console.log('[INSTALL-DIAG] foundRepo=' + foundRepo + ' but 0 manifests on disk — clearing foundRepo (not a valid install)');
    sendLog('No game files were downloaded — cannot add this game.');
    foundRepo = null;
  }

  if (!hasLua && foundRepo) {
    const lp = path.join(luaPath, appid + '.lua');
    // Minimal valid SteamTools lua. The previous `function OnStartup()...` body was a
    // no-op that never mounted depots; `addappid` is the documented activation call.
    fs.writeFileSync(lp, 'addappid(' + appid + ')\n');
    sendLog('Lua generated');
  }

  if (foundRepo) {
    const isgAppInfoPath = path.join(depotCache, appid + '_appinfo.json');
    enqueueAppinfoWrite(appid, () => fs.writeFileSync(isgAppInfoPath, JSON.stringify({ appid: appid })), isgAppInfoPath);
    sendLog('DONE! Restart Steam.');
  }

  return { foundRepo, manifestCount, totalSize };
}

// Helper: try a single repo for the game
async function tryRepoForGame(appid, repo, depotCache, luaPath, sendLog) {
  // PRIMARY: Try depotkeys.json -> individual manifest downloads
  // Race 2 primary URL formats concurrently (main/depotcache + main/manifests)
  // Fallback to master variants if both fail — avoids 6 sequential attempts at 10s each

  let depotKeysFailed = false;

  try {
    const depotKeysData = await downloadDepotKeys(repo);
    const depotKeys = JSON.parse(depotKeysData.toString());

    if (depotKeys[appid]) {
      const appData = depotKeys[appid];
      const depots = appData.depots || {};
      const depotIds = Object.keys(depots);
      sendLog('Found ' + depotIds.length + ' depots for App ' + appid + ' in ' + repo);

      let manifestCount = 0;
      let totalSize = 0;
      let hasLua = false;

      // Total timeout wrapper: aborts after REPO_TIMEOUT_MS regardless of activity
      const tryUrls = async (urls) => {
        const results = await Promise.allSettled(urls.map(url =>
          new Promise((resolve, reject) => {
            const req = https.get(url, { agent: httpsAgent, headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
              if (res.statusCode === 200) {
                const chunks = [];
                const totalTimer = setTimeout(() => { req.destroy(); reject(new Error('Timeout')); }, REPO_TIMEOUT_MS);
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => { clearTimeout(totalTimer); resolve(Buffer.concat(chunks)); });
                res.on('error', (e) => { clearTimeout(totalTimer); reject(e); });
              } else {
                reject(new Error('HTTP ' + res.statusCode));
              }
            });
            req.on('error', reject);
            req.setTimeout(REPO_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
          })
        ));
        for (const r of results) {
          if (r.status === 'fulfilled') return r.value;
        }
        return null;
      };
      
      // Parallel manifest downloads across all depots using Promise.allSettled
      const manifestResults = await Promise.allSettled(depotIds.map(async (depotId) => {
        const depotData = depots[depotId];
        if (!depotData.manifestid) return null;
        
        const depotid = depotId;
        const manifestid = depotData.manifestid;
        
        // Race primary URLs concurrently (main/depotcache + main/manifests)
        const primaryUrls = [
          `https://raw.githubusercontent.com/${repo}/main/depotcache/${depotid}_${manifestid}.manifest`,
          `https://raw.githubusercontent.com/${repo}/main/manifests/${depotid}_${manifestid}.manifest`,
        ];
        const fallbackUrls = [
          `https://raw.githubusercontent.com/${repo}/master/depotcache/${depotid}_${manifestid}.manifest`,
          `https://raw.githubusercontent.com/${repo}/master/manifests/${depotid}_${manifestid}.manifest`,
        ];
        
        let data = await tryUrls(primaryUrls);
        if (!data) data = await tryUrls(fallbackUrls);
        
        if (data) {
          const fn = depotid + '_' + manifestid + '.manifest';
          fs.writeFileSync(path.join(depotCache, fn), data);
          sendLog('Saved: ' + fn + ' (' + data.length + ' bytes)');
          return { size: data.length };
        }
        return null;
      }));
      
      // Collect results from parallel depot downloads
      for (const r of manifestResults) {
        if (r.status === 'fulfilled' && r.value) {
          manifestCount++;
          totalSize += r.value.size;
        }
      }

      // After manifests, try to fetch a lua/config.vcf for this appid
      if (!hasLua) {
        const luaUrls = [
          'https://raw.githubusercontent.com/' + repo + '/main/' + appid + '.lua',
          'https://raw.githubusercontent.com/' + repo + '/master/' + appid + '.lua',
          'https://raw.githubusercontent.com/' + repo + '/main/config.vcf',
          'https://raw.githubusercontent.com/' + repo + '/master/config.vcf',
          'https://raw.githubusercontent.com/' + repo + '/main/stplug-in/' + appid + '.lua',
          'https://raw.githubusercontent.com/' + repo + '/master/stplug-in/' + appid + '.lua',
        ];
        // Race Lua URLs concurrently (main + master) with total timeout
        const luaResults = await Promise.allSettled(luaUrls.map(luaUrl =>
          new Promise((resolve, reject) => {
            const req = https.get(luaUrl, { agent: httpsAgent, headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
              if (res.statusCode === 200) {
                const chunks = [];
                const totalTimer = setTimeout(() => { req.destroy(); reject(new Error('Timeout')); }, REPO_TIMEOUT_MS);
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => { clearTimeout(totalTimer); resolve({ data: Buffer.concat(chunks), url: luaUrl }); });
                res.on('error', (e) => { clearTimeout(totalTimer); reject(e); });
              } else {
                reject(new Error('HTTP ' + res.statusCode));
              }
            });
            req.on('error', reject);
            req.setTimeout(REPO_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
          })
        ));
        for (const r of luaResults) {
          if (r.status === 'fulfilled' && !hasLua) {
            const luaDest = path.join(luaPath, appid + '.lua');
            fs.writeFileSync(luaDest, r.value.data);
            hasLua = true;
            sendLog('Lua saved from repo');
            break;
          }
        }
      }

      if (manifestCount > 0) {
        sendLog('Found ' + manifestCount + ' manifests for ' + depotIds.length + ' depots via depotkeys');
        return { manifestCount, totalSize, hasLua };
      }
    }
  } catch (e) {
    depotKeysFailed = true;
    sendLog('depotkeys approach failed for ' + repo + ': ' + (e.message || e).slice(0, 80));
  }

  // If depotkeys was found and parsed but game not in it: game is definitely not here
  // Skip the ZIP fallback (saves 3-30s per dead repo)
  if (!depotKeysFailed) {
    return null;
  }

  // FALLBACK: ZIP branch approach — only for repos without depotkeys.json
  // The game might still be in the repo as a branch named after the appid
  const url = 'https://github.com/' + repo + '/archive/refs/heads/' + appid + '.zip';
  sendLog('Falling back to ZIP: ' + url.slice(0, 80) + '...');
  
  // Cap ZIP fallback at 5s total (httpGet defaults to 30s idle timeout)
  let zipData;
  try {
    zipData = await Promise.race([
      httpGet(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ZIP fallback timeout')), 5000))
    ]);
  } catch (e) {
    sendLog('ZIP fallback failed: ' + (e.message || e).slice(0, 80));
    return null;
  }
  
  sendLog('Got ' + Math.round(zipData.length / 1024) + 'KB from ' + repo);

  if (zipData.length < 4 || zipData[0] !== 0x50 || zipData[1] !== 0x4B) {
    sendLog('ERROR: Not a valid ZIP');
    return null;
  }

  const zip = new AdmZip(zipData);
  const entries = zip.getEntries();
  sendLog('ZIP has ' + entries.length + ' entries');

  const depots = {};
  let manifestCount = 0;
  let totalSize = 0;
  let hasLua = false;
  let luaData = null;

  for (const entry of entries) {
    const fn = path.basename(entry.entryName);
    if (fn.endsWith('.manifest')) {
      const parts = fn.slice(0, -9).split('_');
      if (parts.length === 2 && parts.every(function(p) { return /^\d+$/.test(p); })) {
        const did = parts[0];
        const mid = parts[1];
        if (!depots[did] || parseInt(mid) > parseInt(depots[did])) {
          depots[did] = mid;
        }
        const content = zip.readFile(entry);
        const destPath = path.join(depotCache, fn);
        fs.writeFileSync(destPath, content);
        manifestCount++;
        totalSize += content.length;
        sendLog('Saved: ' + fn + ' (' + content.length + ' bytes)');
      }
    } else if (fn.endsWith('.lua') && !luaData) {
      luaData = zip.readFile(entry);
      const luaDest = path.join(luaPath, appid + '.lua');
      fs.writeFileSync(luaDest, luaData);
      hasLua = true;
      sendLog('Lua saved');
    }
  }

  sendLog('Found ' + manifestCount + ' manifests for ' + Object.keys(depots).length + ' depots');
  return { manifestCount, totalSize, hasLua };
}

function httpGetWithProgress(url, onProgress, signal, timeoutMs) {
  if (timeoutMs === undefined) timeoutMs = 30000;
  return new Promise(function(res, rej) {
    if (signal && signal.aborted) {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      rej(err);
      return;
    }
    var extracted = extractQueryParams(url);
    var opts = {
      hostname: extracted.hostname,
      port: extracted.port || (extracted.protocol === 'https:' ? 443 : 80),
      path: extracted.pathname + extracted.search,
      method: 'GET',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/zip,application/octet-stream,*/*',
        'Referer': 'https://generator.ryuu.lol/',
        'Origin': 'https://generator.ryuu.lol'
      }
    };
    var mod = extracted.protocol === 'https:' ? https : http;
    var req = mod.request(opts, function(rsp) {
      if (rsp.statusCode === 301 || rsp.statusCode === 302 || rsp.statusCode === 303 || rsp.statusCode === 307 || rsp.statusCode === 308) {
        var loc = rsp.headers.location;
        if (loc) {
          if (!loc.startsWith('http')) loc = extracted.origin + loc;
          httpGetWithProgress(loc, onProgress, signal, timeoutMs).then(res).catch(rej);
          return;
        }
      }
      if (rsp.statusCode == 404) { rej(new Error('404')); return; }
      if (rsp.statusCode != 200) { rej(new Error('HTTP ' + rsp.statusCode + ' ' + (http.STATUS_CODES[rsp.statusCode] || 'Unknown'))); return; }
      var totalSize = parseInt(rsp.headers['content-length'], 10) || 0;
      var downloaded = 0;
      var startTime = Date.now();
      var buf = [];
      rsp.on('data', function(c) { 
        if (signal && signal.aborted) {
          req.destroy();
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          rej(err);
          return;
        }
        buf.push(c);
        downloaded += c.length;
        var elapsed = (Date.now() - startTime) / 1000;
        var speed = elapsed > 0 ? downloaded / elapsed : 0;
        if (onProgress) {
          onProgress({ totalSize: totalSize, downloaded: downloaded, speed: speed, percent: totalSize > 0 ? (downloaded / totalSize) * 100 : 0 });
        }
      });
      rsp.on('end', function() { 
        var data = Buffer.concat(buf);
        if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4B) {
          console.log('[HTTP] Got non-ZIP:', data.slice(0, 100).toString().slice(0, 200));
          rej(new Error('404'));
          return;
        }
        res(data); 
      });
    });
    req.on('error', function(e) {
      if (signal && signal.aborted) {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        rej(err);
        return;
      }
      rej(e);
    });
    req.setTimeout(timeoutMs, function() { req.destroy(); rej(new Error('timeout')); });
    if (signal) {
      signal.addEventListener('abort', function() {
        req.destroy();
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        rej(err);
      }, { once: true });
    }
    req.end();
  });
}

function httpGet(url, signal, timeoutMs) {
  return httpGetWithProgress(url, null, signal, timeoutMs);
}

function execCmd(cmd) {
  return new Promise(function(res, rej) {
    console.log('[EXEC] ' + cmd);
    var c = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-Command', cmd], { shell: false });
    var err = '';
    c.stderr.on('data', function(d) { err += d.toString(); });
    c.on('close', function(code) { 
      console.log('[EXEC] Exit code: ' + code);
      if (code === 0) res(); 
      else rej(new Error(err || 'Exit code ' + code)); 
    });
    c.on('error', function(e) { console.log('[EXEC] Error: ' + e.message); rej(e); });
  });
}

// End of install function

ipcMain.handle('add-to-steam', async (event, appid) => {
  console.log('[MAIN] add-to-steam called for:', appid, 'type:', typeof appid);
  
  // Safety check - convert to string if number
  if (!appid) {
    return { success: false, message: 'Invalid app ID: missing' };
  }
  
  // Convert to string
  const appidStr = String(appid).trim();
  if (!appidStr || appidStr === '0') {
    return { success: false, message: 'Invalid app ID: empty or zero' };
  }
  
  // Validate appid is numeric
  if (!/^\d+$/.test(appidStr)) {
    return { success: false, message: 'Invalid app ID: not numeric - ' + appidStr };
  }
  
  console.log('[MAIN] Validated appid:', appidStr);
  
  const controllerId = 'install-' + appidStr;
  const controller = new AbortController();
  downloadControllers.set(controllerId, controller);
  try {
    const steamPath = findSteamPath(state.customSteamConfig);
    console.log('[MAIN] add-to-steam: steamPath=' + steamPath + ' exists=' + fs.existsSync(steamPath) + ' state.customSteamConfig=' + JSON.stringify(state.customSteamConfig));
    if (!steamPath || !fs.existsSync(steamPath)) {
      return { success: false, message: 'Steam not found. Configure path in Settings.' };
    }
    
    const depotCache = getCustomDepotCachePath(state.customSteamConfig) || path.join(steamPath, 'depotcache');
    const luaPath = getCustomStPluginPath(state.customSteamConfig) || path.join(steamPath, 'config', 'stplug-in');
    
    // Create folders
    fs.mkdirSync(depotCache, { recursive: true });
    fs.mkdirSync(luaPath, { recursive: true });
    console.log('[MAIN] add-to-steam: depotCache=' + depotCache + ' luaPath=' + luaPath);
    
    // Create a log collector and stream to renderer
    const logs = [];
    let lastSentMsg = '';  // dedup guard — skip sending if same as previous
    const sendLog = (msg) => {
      // Strip technical details from user-visible logs
      let clean = msg
        // Strip appids, paths, technical identifiers
        .replace(/App \d+/gi, 'Game')
        .replace(/appid \d+/gi, '')
        .replace(/for \d+/g, '')
        .replace(/for \d+\./g, '.')
        .replace(/from [\w.-]+/g, '')
        .replace(/via [\w.-]+/g, '')
        .replace(/in [\w.-]+/g, '')
        .replace(/[\w.-]+\.(com|org|net|io)[\w./-]*/g, '')
        .replace(/[\w.-]+\\[\w.\-\\]+/g, '')
        // Collapse scanning/repo progress into a single generic message
        .replace(/^Scanning repos for \d+\.\.\. \d+\/\d+$/, 'Checking mirrors...')
        .replace(/^(Trying|Scanning) .+/, 'Checking mirrors...')
        // Remove all repo/mirror technical language
        .replace(/\d+\/\d+ repos?/g, '')
        .replace(/repos? ready/g, '')
        .replace(/indexed in \d+ms/g, '')
        .replace(/pre-fetching depotkeys/i, '')
        .replace(/cached depotkeys/i, '')
        .replace(/depotkeys?/gi, '')
        .replace(/manifest[s]?/gi, '')
        .replace(/depot[s]?/gi, '')
        .replace(/mirror[s]?/gi, '')
        .replace(/repo[s]?/gi, '')
        .replace(/cdn/i, '')
        .replace(/aborted/i, 'Cancelled')
        // Simplify file download patterns
        .replace(/^(Got \d+KB from|ZIP has \d+ entries|Saved:) .+/, 'Downloading game files...')
        .replace(/^Lua saved/, 'Game configured')
        .replace(/^Found \d+ manifests for App \d+ via .+$/, 'Processing game files')
        .replace(/^Found \d+ depots for App \d+ in .+$/, 'Processing game files')
        .replace(/^DONE! Restart Steam\.$/, 'Install complete! Restart Steam')
        .replace(/^[\w.-]+ is currently down \(DNS error\), skipping\.\.\.$/, 'Mirror temporarily unavailable')
        .replace(/^Got fix from [\w.-]+$/, 'Downloading fix...')
        .replace(/^ERROR: Cannot write to folders!$/, 'Error: Cannot write to game folders')
        .replace(/^ERROR: Not a valid ZIP$/, 'Error: Invalid download data')
        .replace(/^Operation aborted$/, 'Cancelled')
        .replace(/^[\w-]+ returned non-ZIP, skipping$/, 'Invalid data from mirror, skipping')
        .replace(/^Trying \d+ APIs in parallel for \d+\.\.\.$/, 'Checking mirrors...')
        .replace(/^Trying \w+ for \d+\.\.\.$/, 'Checking source...')
        // Collapse and clean
        .replace(/\s+/g, ' ')
        .trim();
      if (!clean || clean.length < 3) return;
      // Skip if this is a repeat of the last sent message (dedup progress logs)
      if (clean === lastSentMsg) return;
      lastSentMsg = clean;
      console.log(`[LOG] ${clean}`);
      logs.push(clean);
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('install-log', { appid: appidStr, message: clean });
        }
      } catch (e) { /* ignore */ }
    };
    
    sendLog('Installing game...');
    
    // Fire-and-forget: don't block install on depotkey indexing.
    // ZIP probing in installSteamGame races all repos in parallel (~2s).
    ensureRepoIndex(sendLog).catch(() => {});
    
    // Add timeout - max 120 seconds
    const installPromise = installSteamGame(appidStr, steamPath, sendLog, controller.signal);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ foundRepo: null, manifestCount: 0, timedOut: true }), 120000));
    
    const result = await Promise.race([installPromise, timeoutPromise]).catch(err => {
      sendLog('Error: ' + err.message);
      return { foundRepo: null, manifestCount: 0 };
    });
    
    if (result && result.timedOut) {
      return { success: false, message: 'Installation timed out. Please try again.' };
    }
    
    if (result && result.foundRepo) {
      return {
        success: true,
        message: logs.join('\n'),
        repo: result.foundRepo,
        manifests: result.manifestCount,
        totalSize: result.totalSize || 0
      };
    } else if (result && result.requested) {
      // Not on any source, but Ryuu accepted an add request for it.
      return { success: false, requested: true, message: result.requestMessage || 'Not available yet — we\'ve requested it. Try again later.' };
    } else {
      return {
        success: false,
        message: (result && result.requestMessage) || `App ${appid} not found.\n\nTry: Check log for details.`
      };
    }
  } catch (error) {
    console.error('[MAIN] Install error:', error);
    return { success: false, message: error.message };
  } finally {
    downloadControllers.delete(controllerId);
  }
});

// Install game from local ZIP file
ipcMain.handle('install-game-from-zip', async (event, appid) => {
  try {
    const steamPath = findSteamPath(state.customSteamConfig);
    if (!steamPath || !fs.existsSync(steamPath)) {
      return { success: false, message: 'Steam not found. Configure path in Settings.' };
    }
    
    const depotCache = getCustomDepotCachePath(state.customSteamConfig) || path.join(steamPath, 'depotcache');
    const luaPath = getCustomStPluginPath(state.customSteamConfig) || path.join(steamPath, 'config', 'stplug-in');
    fs.mkdirSync(depotCache, { recursive: true });
    fs.mkdirSync(luaPath, { recursive: true });
    
    // Open file dialog to select ZIP
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Fix ZIP File',
      properties: ['openFile'],
      filters: [
        { name: 'ZIP Files', extensions: ['zip'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'Cancelled' };
    }
    
    const zipFilePath = result.filePaths[0];
    const logs = [];
    const sendLog = (msg) => {
      console.log(`[LOG] ${msg}`);
      logs.push(msg);
    };
    
    sendLog(`Installing App ${appid} from local ZIP...`);
    sendLog(`File: ${path.basename(zipFilePath)}`);
    
    const zipBuffer = await fs.promises.readFile(zipFilePath);
    
    // Check for valid ZIP (starts with PK)
    if (zipBuffer.length < 4 || zipBuffer[0] !== 0x50 || zipBuffer[1] !== 0x4B) {
      return { success: false, message: 'Not a valid ZIP file' };
    }
    
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    
    let manifestCount = 0;
    let totalSize = 0;
    let hasLua = false;
    
    for (const entry of entries) {
      const fn = path.basename(entry.entryName);
      if (fn.endsWith('.manifest')) {
        const content = zip.readFile(entry);
        const destPath = path.join(depotCache, fn);
        fs.writeFileSync(destPath, content);
        manifestCount++;
        totalSize += content.length;
      } else if (fn.endsWith('.lua') && !hasLua) {
        const luaData = zip.readFile(entry);
        const luaDest = path.join(luaPath, appid + '.lua');
        fs.writeFileSync(luaDest, luaData);
        hasLua = true;
      }
    }
    
    if (!hasLua) {
      // Must be addappid() — the legacy `OnStartup` stub is a no-op that never mounts
      // the depot, so the game shows as installed but Steam never unlocks it. This is
      // the same fallback installSteamGame writes; the ZIP-import path had no backstop.
      const lp = path.join(luaPath, appid + '.lua');
      fs.writeFileSync(lp, `addappid(${appid})\n`);
      sendLog('Lua generated');
    }
    
    if (manifestCount > 0) {
      const zipAppInfoPath = path.join(depotCache, appid + '_appinfo.json');
      enqueueAppinfoWrite(appid, () => fs.writeFileSync(zipAppInfoPath, JSON.stringify({ appid: appid })), zipAppInfoPath);
      sendLog(`DONE! ${manifestCount} manifests saved. Restart Steam.`);
      return { success: true, message: logs.join('\n'), manifestCount, totalSize };
    } else {
      return { success: false, message: logs.join('\n') + '\n\nNo .manifest files found in ZIP' };
    }
  } catch (error) {
    console.error('[MAIN] Install from ZIP error:', error);
    return { success: false, message: error.message };
  }
});

// Fetch DLCs from Steam API
ipcMain.handle('fetch-dlcs', async (event, appid, gameName) => {
  try {
    console.log('[MAIN] fetch-dlcs for appid:', appid);
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=en`;
    
    const data = await new Promise((resolve, reject) => {
      const req = https.get(url, {
        agent: httpsAgent,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      }, (rsp) => {
        if (rsp.statusCode !== 200) { reject(new Error('HTTP ' + rsp.statusCode)); return; }
        const buf = [];
        rsp.on('data', (c) => buf.push(c));
        rsp.on('end', () => resolve(JSON.parse(Buffer.concat(buf).toString())));
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    });
    
    const appData = data[appid];
    if (!appData || !appData.success || !appData.data) {
      return { count: 0, dlcs: [], dlcNames: {}, dlcDetails: {} };
    }
    
    // Primary source: standard DLC array from Steam API
    let dlcIds = [];
    if (appData.data.dlc && Array.isArray(appData.data.dlc)) {
      dlcIds = appData.data.dlc.map(String);
    }

    // Steam's appdetails `dlc` array is unreliable — it comes back EMPTY for many
    // games (GTA V, RDR2, …) that clearly have DLC. Merge the local catalogue's dlc
    // map (real DLC app IDs from the Ryuu games feed), which covers games the API
    // misses; its values are names, so they also pre-fill dlcNames with no extra
    // API calls. Store `packages` sub-IDs are still excluded — they aren't app IDs.
    const catalogNames = {};
    try {
      const g = db.getGame(appid);
      const catDlc = (g && g.dlc && typeof g.dlc === 'object') ? g.dlc : null;
      if (catDlc) {
        for (const [id, nm] of Object.entries(catDlc)) {
          const sid = String(id);
          if (!/^\d+$/.test(sid)) continue;
          if (!dlcIds.includes(sid)) dlcIds.push(sid);
          if (nm && !String(nm).startsWith('App ')) catalogNames[sid] = String(nm);
        }
      }
    } catch (e) { console.log('[MAIN] catalogue DLC merge error:', e.message); }
    console.log('[MAIN] Found ' + dlcIds.length + ' DLCs for ' + appid + ' (Steam API + catalogue)');
    
    // Fetch DLC names — check cache FIRST, only hit API for uncached DLCs
    const dlcNames = {};
    const dlcDetails = {};
    const MAX_CONCURRENT = 5;
    const DLC_FETCH_TIMEOUT = 5000; // 5s per DLC (was 15s)
    const DLC_FETCH_TOTAL_CAP = 20000; // 20s overall cap for all DLC fetches
    
    // Pre-fill from persistent cache — instant, no network
    const uncachedIds = [];
    for (const id of dlcIds) {
      if (dlcInfoCache.has(id)) {
        const cached = dlcInfoCache.get(id);
        dlcNames[id] = cached.name || ('App ' + id);
        dlcDetails[id] = { name: cached.name, header_image: cached.header_image };
      } else if (catalogNames[id]) {
        // Name already known from the catalogue — skip the per-DLC Steam API call.
        const header_image = `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`;
        dlcNames[id] = catalogNames[id];
        dlcDetails[id] = { name: catalogNames[id], header_image };
        dlcInfoCache.set(id, { name: catalogNames[id], header_image });
      } else {
        uncachedIds.push(id);
      }
    }
    if (uncachedIds.length < dlcIds.length) {
      console.log('[MAIN] Pre-filled ' + (dlcIds.length - uncachedIds.length) + ' DLC names from cache, fetching ' + uncachedIds.length + ' uncached');
    }
    
    // Only hit Steam API for truly uncached DLCs
    if (uncachedIds.length > 0) {
      const overallStart = Date.now();
      for (let i = 0; i < uncachedIds.length; i += MAX_CONCURRENT) {
        // Check overall timeout before each batch
        if (Date.now() - overallStart > DLC_FETCH_TOTAL_CAP) {
          console.log('[MAIN] DLC fetch overall timeout reached (' + DLC_FETCH_TOTAL_CAP + 'ms), stopping early');
          break;
        }
        
        const batch = uncachedIds.slice(i, i + MAX_CONCURRENT);
        const results = await Promise.allSettled(batch.map(async (id) => {
          try {
            const dlcUrl = `https://store.steampowered.com/api/appdetails?appids=${id}&cc=us&l=en`;
            const d = await new Promise((resolve, reject) => {
              const req = https.get(dlcUrl, {
                agent: httpsAgent,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
              }, (rsp) => {
                if (rsp.statusCode !== 200) { reject(new Error('HTTP ' + rsp.statusCode)); return; }
                const buf = [];
                rsp.on('data', (c) => buf.push(c));
                rsp.on('end', () => {
                  try { resolve(JSON.parse(Buffer.concat(buf).toString())); }
                  catch (e) { reject(e); }
                });
              });
              req.on('error', reject);
              req.setTimeout(DLC_FETCH_TIMEOUT, () => { req.destroy(); reject(new Error('timeout')); });
            });
            return { id, data: d[id] };
          } catch (e) {
            console.log('[MAIN] Error fetching DLC ' + id + ':', e.message);
            return { id, data: null };
          }
        }));
        
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.data && r.value.data.success && r.value.data.data) {
            const id = r.value.id;
            const name = r.value.data.data.name || ('App ' + id);
            dlcNames[id] = name;
            dlcDetails[id] = { 
              name,
              header_image: r.value.data.data.header_image || `https://i.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`
            };
          }
        }
      }
      console.log('[MAIN] DLC fetch took ' + (Date.now() - overallStart) + 'ms for ' + uncachedIds.length + ' uncached DLCs');
    }
    
    // Cache any newly-fetched DLC details into persistent dlcInfoCache
    let newCachedCount = 0;
    for (const [id, details] of Object.entries(dlcDetails)) {
      if (!dlcInfoCache.has(id)) {
        dlcInfoCache.set(id, details);
        newCachedCount++;
      }
    }
    if (newCachedCount > 0) {
      saveDlcInfoCache();
      console.log('[MAIN] Cached ' + newCachedCount + ' new DLC infos from fetch-dlcs');
    }
    
    // Fill remaining missing DLC names from cache (Steam API may fail, timeout cap may cut short)
    for (const id of dlcIds) {
      if (!dlcNames[id] && dlcInfoCache.has(id)) {
        const cached = dlcInfoCache.get(id);
        dlcNames[id] = cached.name || ('App ' + id);
        dlcDetails[id] = { name: cached.name, header_image: cached.header_image };
      }
    }
    
    return { count: dlcIds.length, dlcs: dlcIds, dlcNames, dlcDetails };
  } catch (error) {
    console.error('[MAIN] fetch-dlcs error:', error);
    return { count: 0, dlcs: [], dlcNames: {}, dlcDetails: {} };
  }
});

// Background DLC manifest downloader — best-effort, never blocks registration
// Tries top-N repos (by manifest count) to find and download existing manifests for DLCs
const DLC_MANIFEST_SEARCH_REPOS = 3;

async function tryDlcManifests(dlcIds, depotCache, sourceRepo) {
  if (!dlcIds || dlcIds.length === 0) return 0;
  
  // Build repo list: sourceRepo first (same repo that found the game), then top repos
  const repos = [];
  if (sourceRepo && MIRROR_REPOS.includes(sourceRepo)) {
    repos.push(sourceRepo);
  }
  const topRepos = getOrderedRepos().slice(0, DLC_MANIFEST_SEARCH_REPOS);
  for (const r of topRepos) {
    if (!repos.includes(r)) repos.push(r);
  }
  console.log(`[MAIN] Searching ${repos.length} repos for ${dlcIds.length} DLC manifests (sourceRepo: ${sourceRepo || 'none'})...`);
  
  let totalFound = 0;
  
  // ── Try Ryuu for DLC manifests FIRST (primary source) ──
  (async () => {
    const RYUU_DLC_TIMEOUT = 10000;
    for (const dlcId of dlcIds) {
      if (totalFound > 0) break; // one successful Ryuu DLC is enough to prove the pattern works
      try {
        const url = `${RYUU_BASE}/secure_download?appid=${dlcId}&auth_code=${RYUU_API_KEY}`;
        const data = await httpGet(url, null, RYUU_DLC_TIMEOUT);
        if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4B) continue;
        const zip = new AdmZip(data);
        const entries = zip.getEntries();
        let count = 0;
        for (const entry of entries) {
          const fn = path.basename(entry.entryName);
          if (fn.endsWith('.manifest')) {
            const content = zip.readFile(entry);
            fs.writeFileSync(path.join(depotCache, fn), content);
            count++;
            totalFound++;
          }
        }
        if (count > 0) console.log(`[MAIN] DLC manifest: ${dlcId} from generator.ryuu.lol (${count} manifests)`);
      } catch (_) { /* Ryuu doesn't have this DLC — continue to repos */ }
    }
  })().catch(e => console.log('[MAIN] Ryuu DLC manifest error:', e.message));
  
  for (const repo of repos) {
    if (totalFound >= dlcIds.length) break; // already found all DLC manifests
    try {
      const depotKeysData = await downloadDepotKeys(repo);
      const depotKeys = JSON.parse(depotKeysData.toString());
      
      for (const dlcId of dlcIds) {
        if (!depotKeys[dlcId]) continue;
        const appData = depotKeys[dlcId];
        const depots = appData.depots || {};
        const depotIds = Object.keys(depots);
        
        const urlFormats = [
          `https://raw.githubusercontent.com/${repo}/main/depotcache/%depotid%_%manifestid%.manifest`,
          `https://raw.githubusercontent.com/${repo}/master/depotcache/%depotid%_%manifestid%.manifest`,
        ];
        
        for (const depotId of depotIds) {
          const depotData = depots[depotId];
          if (!depotData.manifestid) continue;
          const manifestid = depotData.manifestid;
          let saved = false;
          
          for (const urlTemplate of urlFormats) {
            if (saved) break;
            const url = urlTemplate.replace('%depotid%', depotId).replace('%manifestid%', manifestid);
            try {
              const data = await new Promise((resolve, reject) => {
                const req = https.get(url, { agent: httpsAgent, headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
                  if (res.statusCode === 200) {
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                  } else {
                    reject(new Error('HTTP ' + res.statusCode));
                  }
                });
                req.on('error', reject);
                req.setTimeout(REPO_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
              });
              const fn = `${depotId}_${manifestid}.manifest`;
              fs.writeFileSync(path.join(depotCache, fn), data);
              totalFound++;
              console.log(`[MAIN] DLC manifest: ${fn} from ${repo}`);
              saved = true;
            } catch (_) { /* try next URL format */ }
          }
        }
      }
      // Track this repo's manifest contribution for future DLC searches
      if (totalFound > 0) {
        recordRepoManifestCount(repo, totalFound);
      }
    } catch (e) {
      console.log(`[MAIN] DLC manifest search failed for ${repo}: ${e.message.slice(0, 60)}`);
    }
  }
  
  console.log(`[MAIN] DLC manifest search complete: found ${totalFound} manifests across ${repos.length} repos`);
  return totalFound;
}

// Register DLCs (create lua/appinfo files) - batched per game
ipcMain.handle('register-dlcs', async (event, appid, dlcIds, dlcDetails, sourceRepo) => {
  try {
    console.log('[MAIN] register-dlcs for appid:', appid, 'dlcs:', dlcIds.length, 'sourceRepo:', sourceRepo || '(none)');
    const steamPath = findSteamPath(state.customSteamConfig);
    const depotCache = getCustomDepotCachePath(state.customSteamConfig) || path.join(steamPath, 'depotcache');
    const luaPath = getCustomStPluginPath(state.customSteamConfig) || path.join(steamPath, 'config', 'stplug-in');
    
    fs.mkdirSync(depotCache, { recursive: true });
    fs.mkdirSync(luaPath, { recursive: true });
    
    // Write a SINGLE batch Lua file per game, containing all DLC addappid calls
    const batchLua = path.join(luaPath, appid + '_dlcs.lua');
    const luaLines = dlcIds.map(id => `addappid(${id})`).join('\n');
    fs.writeFileSync(batchLua, luaLines);
    
    // Also write individual lua files (SteamTools may need them) and appinfo.json for each
    for (const dlcId of dlcIds) {
      try {
        const indivLua = path.join(luaPath, dlcId + '.lua');
        fs.writeFileSync(indivLua, `addappid(${dlcId})`);
        
        const appInfoPath = path.join(depotCache, dlcId + '_appinfo.json');
        const detail = dlcDetails?.[dlcId];
        enqueueAppinfoWrite(dlcId, () => fs.writeFileSync(appInfoPath, JSON.stringify({ 
          appid: parseInt(dlcId), 
          name: detail?.name || '', 
          type: 'DLC',
          header_image: detail?.header_image || ''
        })), appInfoPath);
      } catch (e) {
        console.log('[MAIN] register-dlc error for', dlcId, ':', e.message);
      }
    }
    
    // Save DLC registry so frontend can filter DLCs from library
    try {
      const regPath = path.join(app.getPath('userData'), 'dlc_registry.json');
      let registry = {};
      try { registry = JSON.parse(await fs.promises.readFile(regPath, 'utf-8')); } catch (e) {}
      registry[appid] = dlcIds;
      await fs.promises.writeFile(regPath, JSON.stringify(registry));
    } catch (e) {
      console.log('[MAIN] dlc registry error:', e.message);
    }
    
    // Proactively fetch and cache DLC names immediately after registration
    fetchDlcInfos(dlcIds).then(fetched => {
      const ok = Object.keys(fetched).length;
      if (ok > 0) console.log('[MAIN] Pre-fetched', ok, 'DLC names after registration');
    }).catch(e => console.log('[MAIN] DLC name fetch after register error:', e.message));
    
    // Best-effort background DLC manifest + key-lua download — prioritize sourceRepo, then top repos.
    // luaPath lets it upgrade each DLC's ownership-only stub to a key-bearing lua so
    // content-depot DLCs actually mount.
    tryDlcManifests(dlcIds, depotCache, sourceRepo, luaPath).catch(e =>
      console.log('[MAIN] DLC manifest background download error:', e.message)
    );
    
    const message = 'Registered ' + dlcIds.length + ' DLCs';
    console.log('[MAIN]', message);
    return { success: true, message, count: dlcIds.length };
  } catch (error) {
    console.error('[MAIN] register-dlcs error:', error);
    return { success: false, message: error.message, count: 0 };
  }
});

// Restart Steam
// handled by handlers/steam.cjs: ipcMain.handle('restart-steam', ...)

// Open Steam folder
// handled by handlers/steam.cjs: ipcMain.handle('open-steam-folder', ...)

// handled by handlers/fixes.cjs: ipcMain.handle('download-fix', ...)

// Quick Tools
console.log('[MAIN] Registering quick tool handlers...');
// handled by handlers/fixes.cjs: ipcMain.handle('fix-no-internet', ...)

// handled by handlers/fixes.cjs: ipcMain.handle('fix-no-games', ...)

// handled by handlers/fixes.cjs: ipcMain.handle('copy-manifest', ...)

// handled by handlers/fixes.cjs: ipcMain.handle('clear-cache', ...)

// Fix Games Not Showing - AHG Script: runs install script then lets user restart Steam
// handled by handlers/fixes.cjs: ipcMain.handle('fix-games-not-showing', ...)

// Scan for New Games - checks manifest repos for new entries
// handled by handlers/scan.cjs: ipcMain.handle('scan-for-new-games', ...)

// Fetch missing game covers — scans ALL games for empty/missing header_image and fetches from Steam API
// handled by handlers/scan.cjs: ipcMain.handle('fetch-missing-covers', ...)

// ── Image Disk Cache IPC ──────────────────────────────────────────────

ipcMain.handle('image-cache:batchGet', async (event, requests) => {
  try {
    const cache = globalThis._imageDiskCache;
    if (!cache) return { success: false, message: 'Cache not initialized' };
    const results = await cache.batchGet(requests);
    // Convert Map to array of {cacheKey, dataUrl, mimeType, lqip}
    const entries = [];
    for (const [cacheKey, result] of results) {
      if (result) {
        entries.push({
          cacheKey,
          dataUrl: `image-cache://img/${encodeURIComponent(cacheKey)}`,
          mimeType: result.mimeType,
          lqip: result.lqip,
        });
      } else {
        entries.push({ cacheKey, dataUrl: null, mimeType: null, lqip: null });
      }
    }
    return { success: true, entries };
  } catch (err) {
    console.error('[MAIN] image-cache:batchGet error:', err.message);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('image-cache:has', async (event, appid, preferredImageTypes) => {
  try {
    const cache = globalThis._imageDiskCache;
    if (!cache) return { success: false, exists: false };
    const exists = await cache.has(appid, preferredImageTypes);
    return { success: true, exists };
  } catch (err) {
    return { success: false, exists: false, message: err.message };
  }
});

ipcMain.handle('image-cache:set', async (event, appid, preferredImageTypes, base64Data, mimeType, lqip) => {
  try {
    const cache = globalThis._imageDiskCache;
    if (!cache) return { success: false, message: 'Cache not initialized' };
    const buffer = Buffer.from(base64Data, 'base64');
    await cache.set(appid, preferredImageTypes, buffer, mimeType, lqip);
    return { success: true };
  } catch (err) {
    console.error('[MAIN] image-cache:set error:', err.message);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('image-cache:clear', async () => {
  try {
    const cache = globalThis._imageDiskCache;
    if (!cache) return { success: false, message: 'Cache not initialized' };
    await cache.clear();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('image-cache:stats', async () => {
  try {
    const cache = globalThis._imageDiskCache;
    if (!cache) return { success: false, message: 'Cache not initialized' };
    return { success: true, stats: cache.getStats() };
  } catch (err) {
    return { success: false, message: err.message };
  }
});


// -- Native Image Processing (C++ decode addon with sharp fallback) ---

ipcMain.handle('image:nativeProcess', async (event, rawBase64, mimeType) => {
  try {
    const rawBuffer = Buffer.from(rawBase64, 'base64');
    let decoded;
    if (mimeType && (mimeType.includes('webp') || mimeType.includes('jpeg') || mimeType.includes('jpg'))) {
      decoded = mimeType.includes('webp')
        ? await nativeImageAddon.decodeWebP(rawBuffer)
        : await nativeImageAddon.decodeJPEG(rawBuffer);
    } else {
      // Auto-detect: try WebP first, fall back to JPEG
      try {
        decoded = await nativeImageAddon.decodeWebP(rawBuffer);
      } catch {
        decoded = await nativeImageAddon.decodeJPEG(rawBuffer);
      }
    }
    const webpBuffer = await nativeImageAddon.encodeWebP(decoded.data, decoded.width, decoded.height, 82);
    const lqip = await nativeImageAddon.generateLQIP(decoded.data, decoded.width, decoded.height, 20);
    return {
      success: true,
      webpBase64: webpBuffer.toString('base64'),
      lqip,
      width: decoded.width,
      height: decoded.height,
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('image:nativeGpuSupported', async () => {
  try {
    return { success: true, supported: await nativeImageAddon.isGPUSupported() };
  } catch (err) {
    return { success: false, supported: false, message: err.message || 'Unknown error' };
  }
});

// ── Image Preloader IPC ──────────────────────────────────────────────

ipcMain.handle('preloader:start', async (event, priorityAppids, options) => {
  try {
    const result = await preloader.start(priorityAppids, options || {});
    return { success: true, ...result };
  } catch (err) {
    console.error('[MAIN] preloader:start error:', err.message);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('preloader:pause', () => {
  preloader.pause();
  return { success: true };
});

ipcMain.handle('preloader:resume', () => {
  preloader.resume();
  return { success: true };
});

ipcMain.handle('preloader:cancel', () => {
  preloader.cancel();
  return { success: true };
});

ipcMain.handle('preloader:status', () => {
  return { success: true, status: preloader.status() };
});

// Get installed games from stplug-in folder (like Python app)
console.log('[MAIN] get-installed-games handler called');
// handled by handlers/installed.cjs: ipcMain.handle('get-installed-games', ...)

// Save installed games IDs
// handled by handlers/installed.cjs: ipcMain.handle('save-installed', ...)

// Remove installed game
// handled by handlers/installed.cjs: ipcMain.handle('remove-installed-game', ...)

// GitHub Update Checker
const GITHUB_REPO = 'sinfoo/AHG-Steam-Unlocker';

// handled by handlers/updates.cjs: ipcMain.handle('check-for-updates', ...)

// ── Helper ──
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// handled by handlers/updates.cjs: ipcMain.handle('download-update', ...)

// handled by handlers/updates.cjs: ipcMain.handle('install-update', ...)

// Extract fix ZIP to a folder next to it
// handled by handlers/misc.cjs: ipcMain.handle('extract-fix', ...)

// Open file location in Explorer
// handled by handlers/misc.cjs: ipcMain.handle('open-file-location', ...)

// Restart app (used after update)
// handled by handlers/misc.cjs: ipcMain.handle('restart-app', ...)

// handled by handlers/misc.cjs: ipcMain.handle('get-download-path', ...)

// Store last seen version for changelog trigger
// handled by handlers/misc.cjs: ipcMain.handle('get-last-seen-version', ...)

// handled by handlers/misc.cjs: ipcMain.handle('set-last-seen-version', ...)

// Favorites persistence
// handled by handlers/misc.cjs: ipcMain.handle('save-favorites', ...)

// handled by handlers/misc.cjs: ipcMain.handle('load-favorites', ...)

// Recent games persistence
// handled by handlers/misc.cjs: ipcMain.handle('save-recent', ...)

// handled by handlers/misc.cjs: ipcMain.handle('load-recent', ...)

// Get recently added games (from scan)
// handled by handlers/misc.cjs: ipcMain.handle('get-recently-added', ...)

// Clear recently added games file (called after renderer acknowledges new games)
// handled by handlers/misc.cjs: ipcMain.handle('clear-recently-added', ...)

// Scan for new manifests
// handled by handlers/misc.cjs: ipcMain.handle('scan-new-manifests', ...)

app.whenReady().then(async () => {
  // Check for pending update (.new exe file from previous update)
  try {
    const appPath = app.getAppPath();
    const appDir = app.isPackaged ? path.dirname(appPath) : appPath;
    const newExe = path.join(appDir, 'AHG Unlocker.exe.new');
    const currentExe = path.join(appDir, 'AHG Unlocker.exe');
    
    if (fs.existsSync(newExe)) {
      console.log('[MAIN] Found pending update exe, renaming...');
      // On Windows, we can't rename the running exe, so copy it to a backup and rename .new to exe
      const backupExe = path.join(appDir, 'AHG Unlocker.exe.old');
      if (fs.existsSync(currentExe)) {
        try { fs.unlinkSync(backupExe); } catch(e) {}
        fs.renameSync(currentExe, backupExe);
      }
      fs.renameSync(newExe, currentExe);
      console.log('[MAIN] Update exe renamed successfully!');
    }

    // Check for pending app.asar update
    const newAsar = path.join(appDir, 'app.asar.new');
    const currentAsar = path.join(appDir, 'app.asar');
    if (fs.existsSync(newAsar)) {
      console.log('[MAIN] Found pending app.asar update, renaming...');
      const backupAsar = path.join(appDir, 'app.asar.old');
      if (fs.existsSync(currentAsar)) {
        try { fs.unlinkSync(backupAsar); } catch(e) {}
        fs.renameSync(currentAsar, backupAsar);
      }
      fs.renameSync(newAsar, currentAsar);
      console.log('[MAIN] app.asar renamed successfully!');
    }
  } catch (e) {
    console.log('[MAIN] Pending update check skipped:', e.message);
  }
  
  // Debug port is dev-only. Left on in packaged builds it let anything on the machine
  // attach to the DevTools protocol and run arbitrary JS in the renderer — reading the
  // license file, driving IPC, and lifting the embedded GitHub token.
  if (!app.isPackaged || process.argv.includes('--devtools')) {
    app.commandLine.appendSwitch('remote-debugging-port', '9222');
    console.log('[MAIN] Remote debugging enabled on 9222 (dev mode)');
  }
  console.log('[MAIN] App ready, creating window');
  // Create the window FIRST so the splash paints instantly, THEN load the 54 MB SQLite DB
  // while the splash is already on screen (previously the DB load blocked the window from
  // even appearing). `load-games` awaits _dbReadyPromise, so a renderer request that lands
  // before the DB finishes loading simply waits instead of failing.
  createWindow();
  globalThis._dbReadyPromise = db.initialize()
    .then(() => console.log('[MAIN] SQLite databases initialized'))
    .catch((err) => console.error('[MAIN] SQLite initialization failed:', err.message));
  await globalThis._dbReadyPromise;
  customFixesManager.setApp(app);
  // Remote sync writes only a tiny `.sync-state.json` marker (Last-Modified values) —
  // keep it in userData, which is always writable (resources/ next to the exe may be RO).
  remoteSyncManager.init(app.getPath('userData'));
  loadDlcInfoCache();
  dlcCacheLoaded = true;
  
  // Refresh stale DLC cache entries on startup (those with "App {id}" placeholder names)
  try {
    const staleEntries = [...dlcInfoCache.entries()]
      .filter(([id, info]) => !info || !info.name || info.name.startsWith('App '))
      .map(([id]) => id);
    if (staleEntries.length > 0) {
      console.log('[MAIN] Refreshing', staleEntries.length, 'stale DLC cache entries on startup');
      fetchDlcInfos(staleEntries).then(fetched => {
        if (Object.keys(fetched).length > 0) console.log('[MAIN] Startup DLC refresh got', Object.keys(fetched).length, 'names');
      }).catch(e => console.log('[MAIN] Startup DLC refresh error:', e.message));
    }
  } catch (e) {
    console.log('[MAIN] Startup DLC stale check error:', e.message);
  }
  
  // Enable V8 code caching — stores compiled JS bytecode between runs
  // Target: cuts JS parse/compile time by 30-40% on subsequent launches
  try {
    const codeCacheDir = path.join(app.getPath('userData'), 'code-cache');
    session.defaultSession.setCodeCachePath(codeCacheDir);
    const cacheExists = fs.existsSync(codeCacheDir);
    if (cacheExists) {
      const files = fs.readdirSync(codeCacheDir);
      console.log('[PERF] V8 code cache dir exists at ' + codeCacheDir + ' with ' + files.length + ' file(s)');
    } else {
      console.log('[PERF] V8 code cache dir does not yet exist — will be created on first run at ' + codeCacheDir);
    }
  } catch (e) {
    console.log('[MAIN] V8 code cache setup skipped:', e.message);
  }

  // (window already created above, before the DB load, so the splash shows instantly)

  // ── Deferred handler registration — loads ~3,900 lines of handler code
  // after the window is visible so the UI appears faster.
  console.log('[MAIN-TRACE] Queuing deferred handler registration via setImmediate...')
  const deferStart = Date.now()
  try {
    setImmediate(() => {
      console.log('[MAIN-TRACE] setImmediate fired at +' + (Date.now() - deferStart) + 'ms — registering deferred handlers')
      const { registerDeferredHandlers } = require('./handlers/deferred-loader.cjs');
      registerDeferredHandlers();
      console.log('[MAIN-TRACE] Deferred handlers registered at +' + (Date.now() - deferStart) + 'ms')
    });
  } catch (e) {
    console.error('[MAIN] Deferred handler load error:', e.message);
  }

  startPythonBackend();

  // ── Disk Cache Manager: image caching with LRU eviction ──
  globalThis._imageDiskCache = new DiskCacheManager({
    cacheDir: resolveImageCacheDir(),  // portable: travels with the zipped app folder
    maxSize: 500 * 1024 * 1024,  // 500 MB
    ttlMs: 30 * 24 * 60 * 60 * 1000,  // 30 days
    lruIntervalMs: 5 * 60 * 1000,  // 5 min
  });
  // Register the protocol SYNCHRONOUSLY, before init() resolves. The window already
  // exists by this point, so a cover requested during a slow cold start used to hit
  // net::ERR_UNKNOWN_URL_SCHEME — an unrecoverable load error, not just a slow one.
  // The handler awaits initialisation itself, so early requests wait instead of failing.
  globalThis._imageDiskCache.registerProtocol();
  globalThis._imageDiskCache.init().then(() => {
    console.log('[MAIN] Image disk cache ready');
  }).catch(err => {
    console.error('[MAIN] Image disk cache init failed:', err.message);
  });
  
  // Pre-fetch top repos' depotkeys in background for instant game lookup
  // By the time the user browses and clicks install, the index is ready
  ensureRepoIndex().catch(e => console.log('[MAIN] Repo index init error:', e.message));

  // Warm up LuaTools API health cache so first install doesn't pay probe penalty
  warmupHealthChecks().catch(e => console.log('[MAIN] API health warmup error:', e.message));

  // ── Remote Sync: check for new games/fixes after startup, then periodically ──
  // A single startup check meant games added on Ryuu while the app stayed open never
  // appeared until a restart. The interval re-check is cheap: fixes.json revalidates
  // via 304 and games.json transfers gzipped (~4.5 MB).
  const runRemoteSync = async () => {
    try {
      const wasEmpty = db.getGameCount() === 0;
      const result = await remoteSyncManager.checkForUpdates();
      // Persist new + updated GAMES into games.db so they survive a restart and appear in
      // the catalogue on next load (the renderer reads games.db).
      try {
        const toUpsert = [...(result.newGames || []), ...(result.updatedGames || [])];
        if (toUpsert.length > 0 && typeof db.upsertGames === 'function') {
          const n = db.upsertGames(toUpsert);
          // Persist to disk (sql.js is in-memory; without this they'd vanish on restart).
          try { if (n > 0 && typeof db.persist === 'function') db.persist(); } catch (e) { console.warn('[MAIN] persist after sync failed:', e.message); }
          console.log('[MAIN] Remote sync: upserted', n, 'new/updated games into games.db (persisted)');
        }
      } catch (e) { console.warn('[MAIN] Remote sync db upsert failed:', e.message); }
      // Persist new + updated FIXES into fixes.db (parity with games — the renderer reads
      // fixes.db via app:init-data, not fixes.json).
      try {
        const fixesToUpsert = [...(result.newFixes || []), ...(result.updatedFixes || [])];
        if (fixesToUpsert.length > 0 && typeof db.upsertFixes === 'function') {
          const nf = db.upsertFixes(fixesToUpsert);
          try { if (nf > 0 && typeof db.persistFixes === 'function') db.persistFixes(); } catch (e) { console.warn('[MAIN] persistFixes after sync failed:', e.message); }
          console.log('[MAIN] Remote sync: upserted', nf, 'new/updated fixes into fixes.db (persisted)');
        }
      } catch (e) { console.warn('[MAIN] Remote sync fixes upsert failed:', e.message); }
      console.log('[MAIN] Remote sync result:', result.newGames?.length || 0, 'new games,', result.newFixes?.length || 0, 'new fixes');
      const wc = mainWindow?.webContents;
      if (wasEmpty && db.getGameCount() > 0 && wc && !wc.isDestroyed()) {
        console.log('[MAIN] First-run catalogue built — reloading window to load it');
        wc.reload();
        return;
      }
      if (wc && !wc.isDestroyed()) {
        wc.send('remote-sync-updated', {
          newGames: result.newGames || [],
          newFixes: result.newFixes || [],
          updatedGames: result.updatedGames || [],
          updatedFixes: result.updatedFixes || [],
          errors: result.errors || [],
        });
      }
    } catch (e) {
      console.warn('[MAIN] Remote sync failed:', e.message);
    }
  };
  // In-flight guard: the first-run catalogue bootstrap can outlast the interval.
  let remoteSyncRunning = false;
  const guardedRemoteSync = async () => {
    if (remoteSyncRunning) return;
    remoteSyncRunning = true;
    try { await runRemoteSync(); } finally { remoteSyncRunning = false; }
  };
  setTimeout(guardedRemoteSync, 3000); // 3s delay to let the app finish loading
  setInterval(guardedRemoteSync, 5 * 60 * 1000); // re-check while the app stays open

  // ── Custom Fixes: check GitHub releases after startup ──
  setTimeout(async () => {
    try {
      const result = await customFixesManager.checkForNewCustomFixes();
      if (result.newFixes && result.newFixes.length > 0) {
        console.log('[MAIN] New custom fixes found:', result.newFixes.length);
        const wc = mainWindow?.webContents;
        if (wc && !wc.isDestroyed()) {
          wc.send('custom-fixes-updated', result.newFixes);
        }
      }
    } catch (e) {
      console.warn('[MAIN] Custom fixes check failed:', e.message);
    }
  }, 6000); // 6s delay — runs AFTER remote sync completes

  // ── Background Steam Library Scan: detect new games silently ──
  let lastOwnedGames = [];
  try {
    const ownedPath = path.join(app.getPath('userData'), 'owned_games.json');
    if (fs.existsSync(ownedPath)) {
      lastOwnedGames = JSON.parse(fs.readFileSync(ownedPath, 'utf-8'));
    }
  } catch (_) {}
  // Async I/O: a sync scan of every library folder blocked the main loop every 2 min.
  const exists = (p) => fs.promises.access(p).then(() => true, () => false);
  setInterval(async () => {
    try {
      const steamPath = findSteamPath(state.customSteamConfig);
      if (!steamPath || !(await exists(steamPath))) return;

      const libraryFolders = [];
      const mainSteamApps = path.join(steamPath, 'steamapps');
      if (await exists(mainSteamApps)) libraryFolders.push(mainSteamApps);

      const libraryVdf = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
      if (await exists(libraryVdf)) {
        const vdfContent = await fs.promises.readFile(libraryVdf, 'utf-8');
        const pathMatches = vdfContent.match(/"path"\s+"([^"]+)"/g);
        if (pathMatches) {
          for (const match of pathMatches) {
            const libPath = match.match(/"path"\s+"([^"]+)"/)?.[1];
            if (libPath) {
              const appsDir = path.join(libPath, 'steamapps');
              if (await exists(appsDir)) libraryFolders.push(appsDir);
            }
          }
        }
      }

      const detectedAppids = new Set();
      for (const folder of libraryFolders) {
        try {
          const files = await fs.promises.readdir(folder);
          for (const file of files) {
            const m = file.match(/^appmanifest_(\d+)\.acf$/i);
            if (m) detectedAppids.add(String(m[1]));
          }
        } catch (_) {}
      }

      const detected = Array.from(detectedAppids);
      const lastSet = new Set(lastOwnedGames.map(id => String(id)));
      const newGames = detected.filter(id => !lastSet.has(id));

      if (newGames.length > 0) {
        console.log('[MAIN] Background Steam scan found', newGames.length, 'new games');
        lastOwnedGames = detected;
        try {
          const ownedPath = path.join(app.getPath('userData'), 'owned_games.json');
          await fs.promises.writeFile(ownedPath, JSON.stringify(detected));
        } catch (_) {}
        const wc = mainWindow?.webContents;
        if (wc && !wc.isDestroyed()) {
          wc.send('owned-games-updated', newGames);
        }
      }
    } catch (e) {
      // Silently ignore scan errors — don't spam console
    }
  }, 120000); // Every 2 minutes

  // System Tray
  try {
    const assetsDir = path.join(__dirname, 'assets');
    const trayPath = path.join(assetsDir, 'tray-icon.png');
    if (fs.existsSync(trayPath)) {
      tray = new Tray(nativeImage.createFromPath(trayPath).resize({ width: 16, height: 16 }));
    } else {
      // Create a minimal 16x16 tray icon from a buffer
      const size = 16;
      const buf = Buffer.alloc(size * size * 4);
      for (let i = 0; i < size * size; i++) {
        const x = i % size;
        const y = Math.floor(i / size);
        // Simple filled circle shape (dark gray icon)
        const cx = size / 2, cy = size / 2, r = size / 2 - 1;
        const inCircle = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
        buf[i * 4] = inCircle ? 180 : 0;     // R
        buf[i * 4 + 1] = inCircle ? 180 : 0; // G
        buf[i * 4 + 2] = inCircle ? 180 : 0; // B
        buf[i * 4 + 3] = inCircle ? 255 : 0; // A
      }
      const img = nativeImage.createFromBuffer(buf, { width: size, height: size });
      tray = new Tray(img);
    }
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show AHG Unlocker', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setToolTip('AHG Unlocker');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
  } catch (e) {
    console.error('[MAIN] Failed to create tray:', e.message);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) { pythonProcess.kill(); }
  if (process.platform !== 'darwin') { app.quit(); }
});

app.on('before-quit', () => {
  if (pythonProcess) { pythonProcess.kill(); }
  if (tray) { tray.destroy(); tray = null; }
  if (globalThis._imageDiskCache) {
    globalThis._imageDiskCache.close().catch(() => {});
  }
});

// ── v0.8 NEW FEATURES ──

// User Stats persistence
ipcMain.handle('save-user-stats', async (event, stats) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'user_stats.json');
    await fs.promises.writeFile(filePath, JSON.stringify(stats));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('get-user-stats', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'user_stats.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
    }
    return { totalInstalls: 0, fixesApplied: 0, gamesViewed: 0, firstLaunch: Date.now() };
  } catch (e) {
    return { totalInstalls: 0, fixesApplied: 0, gamesViewed: 0, firstLaunch: Date.now() };
  }
});

// Achievements persistence
ipcMain.handle('save-achievements', async (event, achievements) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'achievements.json');
    await fs.promises.writeFile(filePath, JSON.stringify(achievements));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('get-achievements', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'achievements.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
    }
    return [];
  } catch (e) {
    return [];
  }
});

// Pinned Games for Quick Launch
ipcMain.handle('save-pinned-games', async (event, pinned) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'pinned_games.json');
    await fs.promises.writeFile(filePath, JSON.stringify(pinned));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('get-pinned-games', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'pinned_games.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
    }
    return [];
  } catch (e) {
    return [];
  }
});

// Owned Games (Steam library sync)
ipcMain.handle('save-owned-games', async (event, owned) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'owned_games.json');
    await fs.promises.writeFile(filePath, JSON.stringify(owned));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('get-owned-games', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'owned_games.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
    }
    return [];
  } catch (e) {
    return [];
  }
});

// Fix Health data
ipcMain.handle('save-fix-health', async (event, health) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'fix_health.json');
    await fs.promises.writeFile(filePath, JSON.stringify(health));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('get-fix-health', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'fix_health.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
    }
    return {};
  } catch (e) {
    return {};
  }
});

// ── LuaTools / Multi-Source Import System ──

// Parse a .lua activation file to extract app IDs and depot info
function parseLuaFile(luaContent) {
  const result = { appid: null, depots: [] };
  
  // Match patterns like: appid = 730 or appid="730"
  const appidMatch = luaContent.match(/appid\s*[=:]\s*["']?(\d+)["']?/i);
  if (appidMatch) result.appid = appidMatch[1];
  
  // Match depot entries: { depot = 731, manifest = 1234567890123456789 }
  const depotRegex = /depot\s*[=:]\s*["']?(\d+)["']?[^}]*?manifest\s*[=:]\s*["']?(\d+)["']?/gi;
  let match;
  while ((match = depotRegex.exec(luaContent)) !== null) {
    result.depots.push({ depot: match[1], manifest: match[2] });
  }
  
  // Also match addappid(appid) calls
  const addappidRegex = /addappid\s*\(\s*["']?(\d+)["']?\s*\)/gi;
  while ((match = addappidRegex.exec(luaContent)) !== null) {
    result.depots.push({ depot: match[1], manifest: null, isDlc: true });
  }
  
  return result;
  }

// ── Save onlinefix auth credentials ──
ipcMain.handle('set-onlinefix-auth', async (event, data) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'onlinefix_auth.json');
    await fs.promises.writeFile(filePath, JSON.stringify(data));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// ── Generator Ryuu auth key ──
ipcMain.handle('set-ryuu-auth', async (event, authKey) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'ryuu_auth.json');
    await fs.promises.writeFile(filePath, JSON.stringify({ key: authKey }));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});
ipcMain.handle('get-ryuu-auth', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'ryuu_auth.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      return { success: true, key: data.key || '' };
    }
    return { success: true, key: '' };
  } catch (e) {
    return { success: false, key: '', message: e.message };
  }
});

// ── Open external URL ──
// handled by handlers/persistence.cjs: ipcMain.handle('open-external', ...)

// ── Save auto-fix data for a specific appid ──
// handled by handlers/persistence.cjs: ipcMain.handle('save-auto-fix', ...)

// ── Load auto-fix data for a specific appid ──
// handled by handlers/persistence.cjs: ipcMain.handle('load-auto-fix', ...)

// ── Get all auto-fixes ──
// handled by handlers/persistence.cjs: ipcMain.handle('get-all-auto-fixes', ...)

// ── Save game tags for a specific appid ──
// handled by handlers/persistence.cjs: ipcMain.handle('save-game-tags', ...)

// ── Load game tags for a specific appid ──
// handled by handlers/persistence.cjs: ipcMain.handle('load-game-tags', ...)

// ── Get all game tags ──
// handled by handlers/persistence.cjs: ipcMain.handle('get-all-game-tags', ...)

// ── Cache manifest data for offline use ──
// handled by handlers/persistence.cjs: ipcMain.handle('cache-manifest-offline', ...)

// ── Get offline manifest for a specific appid ──
// handled by handlers/persistence.cjs: ipcMain.handle('get-offline-manifest', ...)

// ── Get list of appids with cached offline manifests ──
// handled by handlers/persistence.cjs: ipcMain.handle('get-offline-cache-list', ...)

// ── Check health of mirror repos via GitHub API ──
// handled by handlers/persistence.cjs: ipcMain.handle('check-mirror-health', ...)

// ── Save window state ──
ipcMain.handle('save-window-state', async (event, state) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'window_state.json');
    await fs.promises.writeFile(filePath, JSON.stringify(state));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// ── Load window state ──
ipcMain.handle('load-window-state', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'window_state.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
    }
    return null;
  } catch (e) {
    return null;
  }
});

// ── Save scheduled scan configuration ──
ipcMain.handle('save-schedule', async (event, schedule) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'schedule.json');
    await fs.promises.writeFile(filePath, JSON.stringify(schedule));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// ── Load scheduled scan configuration ──
ipcMain.handle('load-schedule', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'schedule.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
    }
    return null;
  } catch (e) {
    return null;
  }
});

// ── Run a scheduled scan (stub for now) ──
ipcMain.handle('run-scheduled-scan', async () => {
  return { success: true, message: 'Scheduled scan triggered' };
});

// ── Verify if manifest files exist for an appid ──
// handled by handlers/persistence.cjs: ipcMain.handle('verify-manifest', ...)

// ── Secure download with hash verification ──
// handled by handlers/persistence.cjs: ipcMain.handle('secure-download', ...)

// ── Record a game installation ──
// handled by handlers/persistence.cjs: ipcMain.handle('record-install', ...)

// ── Get installation statistics ──
// handled by handlers/persistence.cjs: ipcMain.handle('get-install-stats', ...)

// ── Get activity data grouped by date ──
// handled by handlers/persistence.cjs: ipcMain.handle('get-activity-data', ...)

// ── Save UI settings ──
ipcMain.handle('save-ui-settings', async (event, settings) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'ui_settings.json');
    await fs.promises.writeFile(filePath, JSON.stringify(settings));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// ── Load UI settings ──
ipcMain.handle('load-ui-settings', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'ui_settings.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
    }
    return {};
  } catch (e) {
    return {};
  }
});

// ── Show context menu from renderer-provided items ──
// handled by handlers/system.cjs: ipcMain.handle('show-context-menu', ...)

// ── v0.9 Stub Handlers ──

ipcMain.handle('export-library', async () => {
  return { success: false, message: 'Not implemented' };
});

ipcMain.handle('import-library', async () => {
  return { success: false, message: 'Not implemented' };
});

ipcMain.handle('get-search-history', async () => {
  return [];
});

ipcMain.handle('save-search-history', async (event, searches) => {
  return { success: true };
});

ipcMain.handle('fix-no-games-stream', async () => {
  return { success: false, output: '' };
});

// ── OS Notifications ──
// handled by handlers/system.cjs: ipcMain.handle('send-notification', ...)

// ── Steam Status Check ──
// handled by handlers/system.cjs: ipcMain.handle('get-steam-status', ...)

// handled by handlers/system.cjs: ipcMain.handle('cancel-download', ...)

// handled by handlers/system.cjs: ipcMain.handle('launch-game', ...)

ipcMain.handle('refresh-steam', async () => {
  return { success: true, message: 'Steam refreshed' };
});

// handled by handlers/system.cjs: ipcMain.handle('fetch-steam-genres', ...)

// handled by handlers/system.cjs: ipcMain.handle('check-free-games', ...)

console.log('[MAIN] Electron main process initialized');
