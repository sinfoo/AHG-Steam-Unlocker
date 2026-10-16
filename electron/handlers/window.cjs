// ── Window management and app lifecycle handlers ──
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, session } = require('electron');
const state = require('../utils/state.cjs');
const { getResourcePath } = require('../utils/pathUtils.cjs');
const { wrapHandler } = require('../utils/rateLimiter.cjs');
const remoteSyncManager = require('../remote-sync-manager.cjs');
const customFixesManager = require('../custom-fixes-manager.cjs');
const db = require('../db.cjs');
const { ensureRepoIndex } = require('../utils/repoUtils.cjs');
const { loadDlcInfoCache, fetchDlcInfos } = require('../utils/steamApi.cjs');
// Note: startPythonBackend and resolveGuildId were referenced from a planned
// appLifecycle.cjs extraction that was never created. Both are handled inline:
//   - Python backend: started in setupAppLifecycle() below


function createWindow() {
  const preloadPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'electron', 'preload.cjs')
    : path.join(__dirname, '..', 'preload.cjs');

  console.log('[MAIN] preloadPath:', preloadPath);
  console.log('[MAIN] preload exists:', fs.existsSync(preloadPath));

  // ── TLS Certificate Verification ──
  // All external hosts (Steam CDNs, GitHub, generator.ryuu.lol, SteamDB)
  // use valid publicly-trusted certificates. Validate normally and log
  // any failures for diagnostics — never blanket-accept.
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    if (request.errorCode !== 0) {
      console.warn(`[TLS] Cert validation failed for ${request.hostname}: ${request.errorDescription} (code=${request.errorCode})`);
      console.warn(`[TLS] Issuer: ${request.certificate?.issuerName}`);
      callback(-2);  // Reject
    } else {
      callback(0);   // Accept (Chromium already validated)
    }
  });

  session.defaultSession.setProxy({ proxyRules: 'direct://' }).then(() => {
    console.log('[MAIN] Proxy set to direct');
  }).catch(e => {
    console.log('[MAIN] Proxy config error:', e.message);
  });

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

  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  const mainWindow = new BrowserWindow({
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
      webSecurity: true, // All external assets fetched via preload Node.js HTTP — renderer never needs cross-origin fetch
      sandbox: false, // Preload uses require() for IPC bridging; sandbox:true requires moving I/O to main process — queued for future loop
      webgl: true,
      enableWebSQL: false,
    },
    autoHideMenuBar: true,
    frame: false,
  });

  state.setMainWindow(mainWindow);
  registerWindowIpc();

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[MAIN] Renderer process gone:', details.reason, 'exitCode:', details.exitCode);
    const crashLine = `${new Date().toISOString()} - Renderer process gone: ${details.reason} (exitCode: ${details.exitCode})\n`;
    fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'), crashLine);
    // Skip auto-reload for 'killed' — intentional termination, not a crash
    if (details.reason === 'killed') return;
    // Log heap stats for OOM diagnosis
    try {
      const mem = process.memoryUsage();
      fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'),
        `  Main process memory at crash: RSS=${Math.round(mem.rss / 1024 / 1024)}MB, Heap=${Math.round(mem.heapUsed / 1024 / 1024)}/${Math.round(mem.heapTotal / 1024 / 1024)}MB\n`);
    } catch (e) { /* best-effort */ }
    setTimeout(() => {
      const w = state.mainWindow;
      if (w && !w.isDestroyed()) w.reload();
    }, 2000);
  });

  console.log('[MAIN] Window created and shown');

  const execDir = path.dirname(process.execPath);
  const resourcesPath = process.resourcesPath;
  console.log('[MAIN] execDir:', execDir);
  console.log('[MAIN] resourcesPath:', resourcesPath);
  console.log('[MAIN] app.isPackaged:', app.isPackaged);

  let indexPath;
  if (app.isPackaged) {
    const possiblePaths = [
      path.join(resourcesPath, 'app', 'dist', 'index.html'),
      path.join(app.getAppPath(), 'dist', 'index.html'),
      path.join(execDir, 'resources', 'app', 'dist', 'index.html'),
      path.join(execDir, 'app', 'dist', 'index.html'),
    ];
    for (const p of possiblePaths) {
      console.log('[MAIN] Checking index path:', p, 'exists:', fs.existsSync(p));
      if (fs.existsSync(p)) { indexPath = p; break; }
    }
    if (!indexPath) indexPath = possiblePaths[0];
  } else {
    indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  }

  console.log('[MAIN] Loading from:', indexPath);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(indexPath).then(() => {
    console.log('[MAIN] loadFile succeeded');
  }).catch(err => {
    console.error('[MAIN] loadFile error:', err);
  });

  mainWindow.on('closed', () => {
    state.setMainWindow(null);
    const pp = state.pythonProcess;
    if (pp) pp.kill();
  });
}

function registerWindowIpc() {
  ipcMain.on('window-minimize', () => {
    const w = state.mainWindow;
    if (w) w.minimize();
  });
  ipcMain.on('window-maximize', () => {
    const w = state.mainWindow;
    if (!w) return;
    if (w.isMaximized() || w._isCustomMaximized) {
      w._isCustomMaximized = false;
      w.unmaximize();
    } else {
      w._preMaximizeBounds = w.getBounds();
      w._isCustomMaximized = true;
      w.maximize();
      setTimeout(() => {
        if (state.mainWindow) {
          state.mainWindow.setAlwaysOnTop(true, 'normal');
          setTimeout(() => { if (state.mainWindow) state.mainWindow.setAlwaysOnTop(false); }, 50);
        }
      }, 50);
    }
  });
  ipcMain.on('window-close', () => {
    const w = state.mainWindow;
    if (w) w.close();
  });
  ipcMain.handle('window-is-maximized', () => {
    const w = state.mainWindow;
    return w?._isCustomMaximized || w?.isMaximized() || false;
  });

  const w = state.mainWindow;
  if (w) {
    w.on('maximize', () => {
      if (!w._isCustomMaximized) {
        w._isCustomMaximized = true;
        w._preMaximizeBounds = w._preMaximizeBounds || w.getBounds();
      }
      w?.webContents.send('window-maximize-change', true);
      setTimeout(() => {
        if (state.mainWindow) {
          state.mainWindow.setAlwaysOnTop(true, 'normal');
          setTimeout(() => { if (state.mainWindow) state.mainWindow.setAlwaysOnTop(false); }, 50);
        }
      }, 50);
    });
    w.on('unmaximize', () => {
      w._isCustomMaximized = false;
      w?.webContents.send('window-maximize-change', false);
      if (state.mainWindow) {
        setTimeout(() => {
          if (state.mainWindow) {
            state.mainWindow.setAlwaysOnTop(true, 'normal');
            setTimeout(() => { if (state.mainWindow) state.mainWindow.setAlwaysOnTop(false); }, 50);
          }
        }, 50);
      }
    });
  }

  ipcMain.handle('window-toggle-fullscreen', () => {
    const w = state.mainWindow;
    if (w) { const isFull = w.isFullScreen(); w.setFullScreen(!isFull); }
  });
  ipcMain.handle('window-is-fullscreen', () => {
    return state.mainWindow?.isFullScreen() || false;
  });

  if (w) {
    w.on('enter-fullscreen', () => { w?.webContents.send('window-fullscreen-change', true); });
    w.on('leave-fullscreen', () => { w?.webContents.send('window-fullscreen-change', false); });
  }

  // Local image serving
  ipcMain.handle('get-local-image', async (event, appid, suffix) => {
    try {
      const relativePath = `resources/images/${appid}/${suffix || 'header.jpg'}`;
      const imgPath = getResourcePath(relativePath);
      if (!imgPath || !fs.existsSync(imgPath)) return null;
      const stat = fs.statSync(imgPath);
      if (stat.size < 500) return null;
      const buffer = fs.readFileSync(imgPath);
      const ext = path.extname(imgPath).slice(1) || 'jpeg';
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      return `data:image/${mime};base64,${buffer.toString('base64')}`;
    } catch (e) {
      console.error('[MAIN] get-local-image error:', e);
      return null;
    }
  });

  ipcMain.handle('get-local-image-manifest', async () => {
    try {
      const manifestPath = getResourcePath('resources/images/manifest.json');
      if (!manifestPath || !fs.existsSync(manifestPath)) return null;
      return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) { return null; }
  });

  // App path handlers
  ipcMain.handle('get-app-path', () => app.getAppPath());
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-user-data-path', () => app.getPath('userData'));
  ipcMain.handle('get-resource-path', (event, relativePath) => getResourcePath(relativePath));

  // Show main window (for tray double-click etc.)
  ipcMain.handle('show-main-window', async () => {
    const w = state.mainWindow;
    if (w) { w.show(); w.focus(); }
    return { success: true };
  });

  // Connectivity check — runs in main process via Node.js https, bypasses browser CORS
  // Online if ANY probe gets an HTTP response (any status). A single host (Steam) is often
  // blocked by DNS/ISP/VPN or slow while the main process is busy loading, which caused
  // false "no internet" modals.
  ipcMain.handle('check-connectivity', wrapHandler('check-connectivity', async () => {
    const https = require('https');
    const probes = [
      'https://www.cloudflare.com/cdn-cgi/trace',
      'https://www.gstatic.com/generate_204',
      'https://github.com',
      'https://store.steampowered.com',
    ];
    return new Promise((resolve) => {
      let pending = probes.length;
      let done = false;
      const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
      const timer = setTimeout(() => finish(false), 9000);
      for (const url of probes) {
        const req = https.get(url, { timeout: 8000 }, (res) => { res.resume(); finish(true); });
        const fail = () => { req.destroy(); if (--pending === 0) finish(false); };
        req.on('error', fail);
        req.on('timeout', fail);
      }
    });
  }, { windowMs: 10000, maxCalls: 20 }));
}

// ── App lifecycle setup ──
function setupAppLifecycle() {
  app.whenReady().then(async () => {
    // Check for pending update (.new exe file from previous update)
    try {
      const appPath = app.getAppPath();
      const appDir = app.isPackaged ? path.dirname(appPath) : appPath;
      const newExe = path.join(appDir, 'AHG Unlocker.exe.new');
      const currentExe = path.join(appDir, 'AHG Unlocker.exe');
      if (fs.existsSync(newExe)) {
        console.log('[MAIN] Found pending update exe, renaming...');
        const backupExe = path.join(appDir, 'AHG Unlocker.exe.old');
        if (fs.existsSync(currentExe)) {
          try { fs.unlinkSync(backupExe); } catch(e) {
            console.error('[WINDOW] Error removing old backup EXE:', e.message);
          }
          fs.renameSync(currentExe, backupExe);
        }
        fs.renameSync(newExe, currentExe);
        console.log('[MAIN] Update exe renamed successfully!');
      }
    } catch (e) {
      console.log('[MAIN] Pending update check skipped:', e.message);
    }

    // Dev-only — see the matching note in main.cjs.
    if (!app.isPackaged || process.argv.includes('--devtools')) {
      app.commandLine.appendSwitch('remote-debugging-port', '9222');
      console.log('[MAIN] Remote debugging enabled on 9222 (dev mode)');
    }
    console.log('[MAIN] App ready, creating window');
    customFixesManager.setApp(app);

    // Initialize SQLite databases
    try {
      await db.initialize();
      console.log('[MAIN] SQLite databases initialized');
    } catch (err) {
      console.error('[MAIN] SQLite initialization failed:', err.message);
    }

    const resourceDir = path.dirname(getResourcePath('package.json'));
    remoteSyncManager.init(resourceDir, db);
    loadDlcInfoCache();
    state.setDlcCacheLoaded(true);

    // Refresh stale DLC cache entries on startup
    try {
      const staleEntries = [...state.dlcInfoCache.entries()]
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

    createWindow();

    // Start Python backend
    try {
      const pythonScript = getResourcePath('backend/src/api/main.py');
      if (fs.existsSync(pythonScript)) {
        const { spawn } = require('child_process');
        const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
        const pythonProcess = spawn(pythonExe, [pythonScript], {
          cwd: path.dirname(pythonScript),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });
        pythonProcess.stdout.on('data', (data) => console.log('[PYTHON]', data.toString().trim()));
        pythonProcess.stderr.on('data', (data) => console.error('[PYTHON ERROR]', data.toString().trim()));
        pythonProcess.on('error', (error) => console.error('[MAIN] Failed to start Python:', error));
        state.setPythonProcess(pythonProcess);
        console.log('[MAIN] Python backend started');
      } else {
        console.log('[MAIN] Python backend not found');
      }
    } catch (error) {
      console.error('[MAIN] Error starting Python:', error);
    }

    // Pre-fetch top repos' depotkeys in background
    ensureRepoIndex().catch(e => console.log('[MAIN] Repo index init error:', e.message));

    // System Tray
    try {
      const assetsDir = path.join(__dirname, '..', 'assets');
      const trayPath = path.join(assetsDir, 'tray-icon.png');
      let trayImg;
      if (fs.existsSync(trayPath)) {
        trayImg = nativeImage.createFromPath(trayPath).resize({ width: 16, height: 16 });
      } else {
        const size = 16;
        const buf = Buffer.alloc(size * size * 4);
        for (let i = 0; i < size * size; i++) {
          const x = i % size, y = Math.floor(i / size);
          const cx = size / 2, cy = size / 2, r = size / 2 - 1;
          const inCircle = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
          buf[i * 4] = inCircle ? 180 : 0;
          buf[i * 4 + 1] = inCircle ? 180 : 0;
          buf[i * 4 + 2] = inCircle ? 180 : 0;
          buf[i * 4 + 3] = inCircle ? 255 : 0;
        }
        trayImg = nativeImage.createFromBuffer(buf, { width: size, height: size });
      }
      const tray = new Tray(trayImg);
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Show AHG Unlocker', click: () => { const w = state.mainWindow; if (w) { w.show(); w.focus(); } } },
        { type: 'separator' },
        { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
      ]));
      tray.setToolTip('AHG Unlocker');
      tray.on('double-click', () => { const w = state.mainWindow; if (w) { w.show(); w.focus(); } });
      state.setTray(tray);
    } catch (e) {
      console.error('[MAIN] Failed to create tray:', e.message);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    const pp = state.pythonProcess;
    if (pp) pp.kill();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    const pp = state.pythonProcess;
    if (pp) pp.kill();
    const t = state.tray;
    if (t) { t.destroy(); state.setTray(null); }
  });
}

module.exports = { createWindow, setupAppLifecycle, registerWindowIpc };
