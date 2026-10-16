// ── System & utility IPC handlers ──
const path = require('path');
const fs = require('fs');
const https = require('https');
const { ipcMain, shell, Menu, BrowserWindow, Notification } = require('electron');
const state = require('../utils/state.cjs');
const { findSteamPath } = require('../utils/steamUtils.cjs');
const { withCache } = require('../utils/ttlCache.cjs');
const { wrapHandler } = require('../utils/rateLimiter.cjs');

const getSteamStatusCached = withCache(async () => {
  const steamPath = findSteamPath();
  const steamExe = path.join(steamPath, 'steam.exe');
  // async: execSync here froze the main thread on every cache miss
  const running = fs.existsSync(steamExe) && await new Promise((resolve) => {
    require('child_process').execFile('tasklist', ['/FI', 'IMAGENAME eq steam.exe', '/NH'],
      { encoding: 'utf-8', timeout: 3000, windowsHide: true },
      (err, out) => resolve(!err && String(out).includes('steam.exe')));
  });
  return { running, version: '2.0' };
}, 60_000);

const freeCache = new Map(); // appid -> { free, at }
const FREE_TTL = 24 * 60 * 60 * 1000;

function registerSystemHandlers() {
  const downloadControllers = state.downloadControllers;
  // ── Show context menu from renderer-provided items ──
  ipcMain.handle('show-context-menu', async (event, items) => {
    const template = items.map(item => ({
      label: item.label,
      enabled: item.enabled !== false,
      click: () => event.sender.send('context-menu-action', item.action)
    }));
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });

  // ── OS Notifications ──
  ipcMain.handle('send-notification', async (event, { title, body }) => {
    try {
      if (Notification.isSupported()) {
        const notif = new Notification({ title: title || 'AHG Unlocker', body: body || '' });
        notif.show();
      }
      return { success: true };
    } catch (e) {
      console.error('[MAIN] Notification error:', e.message);
      return { success: false, message: e.message };
    }
  });

  // ── Steam Status Check (TTL cache: 60s) ──
  ipcMain.handle('get-steam-status', async () => {
    try { return await getSteamStatusCached(); }
    catch (e) {
      console.error('[MAIN] get-steam-status error:', e.message);
      return { running: false, version: '0.0' };
    }
  });

  // ── Cancel active downloads (specific appid or all) ──
  ipcMain.handle('cancel-download', async (event, appid) => {
    let count = 0;
    if (appid) {
      // Cancel specific download by appid
      const targetKey = `install-${appid}`;
      const controller = downloadControllers.get(targetKey);
      if (controller) {
        controller.abort();
        downloadControllers.delete(targetKey);
        count = 1;
      } else {
        // Try fix-{appid} direct lookup (P2.3)
        const fixKey = `fix-${appid}`;
        const fixController = downloadControllers.get(fixKey);
        if (fixController) {
          fixController.abort();
          downloadControllers.delete(fixKey);
          count = 1;
        } else {
          // Fallback: iterate for fix-url- keys (started with a URL)
          for (const [id, ctrl] of downloadControllers) {
            if (id.includes(String(appid))) {
              ctrl.abort();
              downloadControllers.delete(id);
              count = 1;
              break;
            }
          }
        }
      }
    } else {
      // Cancel ALL (legacy behavior)
      for (const [id, controller] of downloadControllers) {
        controller.abort();
        count++;
      }
      downloadControllers.clear();
    }
    return { success: true, aborted: count };
  });

  // ── Launch a Steam game ──
  ipcMain.handle('launch-game', wrapHandler('launch-game', async (event, appId) => {
    try {
      // Steam app IDs are numeric. Without this, arbitrary text lands in a steam:// URL
      // handed to the OS handler — the one place a renderer value reaches shell.openExternal
      // without going through the validated 'open-external' path.
      if (!/^\d+$/.test(String(appId))) {
        return { success: false, message: 'Invalid app ID' };
      }
      const steamUrl = `steam://run/${appId}`;
      await shell.openExternal(steamUrl);
      return { success: true };
    } catch (e) {
      return { success: false, message: 'Failed to launch game: ' + e.message };
    }
  }, { windowMs: 5000, maxCalls: 2 }));

  // show-main-window → window.cjs (domain-appropriate home, overwrites this registration)

  // ── Fetch genre data from Steam Store API in batches ──
  ipcMain.handle('fetch-steam-genres', async (event, appids) => {
    if (!appids || !Array.isArray(appids) || appids.length === 0) return {};
    try {
      const results = {};
      let consecutiveErrors = 0;
      for (let i = 0; i < appids.length; i += 10) {
        const batch = appids.slice(i, i + 10);
        const ids = batch.join(',');
        const url = 'https://store.steampowered.com/api/appdetails?appids=' + ids + '&cc=us&l=en';
        try {
          const data = await new Promise((resolve, reject) => {
            const u = new URL(url);
            const req = https.get({
              hostname: u.hostname, path: u.pathname + u.search,
              headers: { 'User-Agent': 'AHG-Unlocker/1.0' }, timeout: 10000
            }, (rsp) => {
              if (rsp.statusCode !== 200) { reject(new Error('HTTP ' + rsp.statusCode)); return; }
              const buf = [];
              rsp.on('data', c => buf.push(c));
              rsp.on('end', () => resolve(JSON.parse(Buffer.concat(buf).toString())));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.end();
          });
          consecutiveErrors = 0;
          for (const [id, info] of Object.entries(data)) {
            if (info && info.success && info.data && info.data.genres) {
              results[id] = info.data.genres.map(g => g.description);
            }
          }
        } catch (e) {
          consecutiveErrors++;
          if (consecutiveErrors >= 3) { break; }
          await new Promise(r => setTimeout(r, 500));
        }
      }
      return results;
    } catch (e) {
      console.error('[MAIN] fetch-steam-genres error:', e.message);
      return {};
    }
  });

  // ── Check which appids are free on Steam ──
  // Free status rarely changes: cache per appid for 24h so boot + rescans don't re-hit
  // Steam, and query 4 batches at a time instead of 200 strictly serial requests.
  // ponytail: in-memory cache only (lost on restart); persist to userData if boot cost matters.
  ipcMain.handle('check-free-games', wrapHandler('check-free-games', async (event, appids) => {
    if (!appids || !Array.isArray(appids) || appids.length === 0) return [];
    try {
      const now = Date.now();
      const todo = appids.map(String).filter(id => !((freeCache.get(id) || {}).at > now - FREE_TTL));
      const batches = [];
      for (let i = 0; i < todo.length; i += 10) batches.push(todo.slice(i, i + 10));
      let errors = 0;
      const worker = async () => {
        while (batches.length && errors < 3) {
          const batch = batches.shift();
          const url = `https://store.steampowered.com/api/appdetails?appids=${batch.join(',')}&cc=us&l=en&filters=price_overview`;
          try {
            const data = await new Promise((resolve, reject) => {
              const u = new URL(url);
              const req = https.get({
                hostname: u.hostname, path: u.pathname + u.search,
                headers: { 'User-Agent': 'AHG-Unlocker/1.0' }, timeout: 10000
              }, (rsp) => {
                if (rsp.statusCode !== 200) { rsp.resume(); reject(new Error('HTTP ' + rsp.statusCode)); return; }
                const buf = [];
                rsp.on('data', c => buf.push(c));
                rsp.on('end', () => { try { resolve(JSON.parse(Buffer.concat(buf).toString())); } catch (e) { reject(e); } });
              });
              req.on('error', reject);
              req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            });
            errors = 0;
            for (const [id, info] of Object.entries(data || {})) {
              if (!info || !info.success) continue;
              const price = info.data && info.data.price_overview;
              freeCache.set(id, { free: !price || price.initial === 0, at: Date.now() });
            }
          } catch (e) {
            errors++; // 3 consecutive failures (e.g. Steam 429) stop all workers
            await new Promise(r => setTimeout(r, 500));
          }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      return appids.map(String).filter(id => (freeCache.get(id) || {}).free);
    } catch (e) {
      console.error('[MAIN] check-free-games error:', e.message);
      return [];
    }
  }, { windowMs: 30000, maxCalls: 2 }));
}

module.exports = { registerSystemHandlers };
