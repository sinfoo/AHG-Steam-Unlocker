// ── Data Persistence IPC Handlers ──
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { ipcMain, app, shell } = require('electron');
const state = require('../utils/state.cjs');
const { wrapHandler } = require('../utils/rateLimiter.cjs');
const { findSteamPath } = require('../utils/steamUtils.cjs');

// ── Parse a .lua activation file to extract app IDs and depot info ──
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

function registerPersistenceHandlers() {
  // ── Generic Save/Load Handlers ──

  ipcMain.handle('db:save', async (event, key, data) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      console.error('[PERSISTENCE] db:save blocked — invalid key:', key);
      return { success: false, error: 'Invalid key' };
    }
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, key + '.json');
      await fs.promises.writeFile(filePath, JSON.stringify(data));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:load', async (event, key, defaultVal) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      console.error('[PERSISTENCE] db:load blocked — invalid key:', key);
      return defaultVal;
    }
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, key + '.json');
      if (fs.existsSync(filePath)) {
        return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      }
      return defaultVal;
    } catch (e) {
      console.error('[PERSISTENCE] db:load error reading', key, ':', e.message);
      return defaultVal;
    }
  });

  // Detect owned games by scanning Steam library folders
  ipcMain.handle('detect-owned-games', wrapHandler('detect-owned-games', async () => {
    try {
      const steamPath = findSteamPath();
      if (!steamPath || !fs.existsSync(steamPath)) return [];

      const libraryFolders = [];
      const mainSteamApps = path.join(steamPath, 'steamapps');
      if (fs.existsSync(mainSteamApps)) libraryFolders.push(mainSteamApps);

      // Parse libraryfolders.vdf for additional library paths
      const libraryVdf = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
      if (fs.existsSync(libraryVdf)) {
        const vdfContent = fs.readFileSync(libraryVdf, 'utf-8');
        // Extract paths from VDF entries like "1" "D:\\SteamLibrary"
        const pathMatches = vdfContent.match(/"path"\s+"([^"]+)"/g);
        if (pathMatches) {
          for (const match of pathMatches) {
            const libPath = match.match(/"path"\s+"([^"]+)"/)?.[1];
            if (libPath) {
              const appsDir = path.join(libPath, 'steamapps');
              if (fs.existsSync(appsDir)) libraryFolders.push(appsDir);
            }
          }
        }
      }

      // Scan appmanifest_*.acf files in all found library folders
      const ownedAppids = new Set();
      for (const folder of libraryFolders) {
        try {
          const files = fs.readdirSync(folder);
          for (const file of files) {
            const match = file.match(/^appmanifest_(\d+)\.acf$/i);
            if (match) {
              ownedAppids.add(parseInt(match[1], 10));
            }
          }
        } catch (e) {
          // Skip folders we can't read
        }
      }

      return Array.from(ownedAppids).sort((a, b) => a - b);
    } catch (e) {
      return [];
    }
  }, { windowMs: 30000, maxCalls: 1 }));

  // ── Open external URL ──
  ipcMain.handle('open-external', async (event, url) => {
    try {
      // Only allow safe, web-facing protocols. A crafted file:/smb:/javascript: URL
      // handed straight to shell.openExternal can trigger OS handlers — reject those.
      let parsed;
      try { parsed = new URL(String(url)); } catch { return { success: false, error: 'Invalid URL' }; }
      const allowed = ['https:', 'http:', 'mailto:'];
      if (!allowed.includes(parsed.protocol)) {
        return { success: false, error: `Blocked protocol: ${parsed.protocol}` };
      }
      await shell.openExternal(parsed.href);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Save auto-fix data for a specific appid ──
  ipcMain.handle('save-auto-fix', async (event, appid, fixData) => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'auto_fixes.json');
      let fixes = {};
      if (fs.existsSync(filePath)) {
        fixes = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      }
      fixes[appid] = fixData;
      await fs.promises.writeFile(filePath, JSON.stringify(fixes));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Load auto-fix data for a specific appid ──
  ipcMain.handle('load-auto-fix', async (event, appid) => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'auto_fixes.json');
      if (fs.existsSync(filePath)) {
        const fixes = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
        return fixes[appid] || null;
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  // ── Get all auto-fixes ──
  ipcMain.handle('get-all-auto-fixes', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'auto_fixes.json');
      if (fs.existsSync(filePath)) {
        return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      }
      return {};
    } catch (e) {
      return {};
    }
  });

  // ── Save game tags for a specific appid ──
  ipcMain.handle('save-game-tags', async (event, appid, tags) => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'game_tags.json');
      let allTags = {};
      if (fs.existsSync(filePath)) {
        allTags = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      }
      allTags[appid] = tags;
      await fs.promises.writeFile(filePath, JSON.stringify(allTags));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Load game tags for a specific appid ──
  ipcMain.handle('load-game-tags', async (event, appid) => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'game_tags.json');
      if (fs.existsSync(filePath)) {
        const allTags = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
        return allTags[appid] || [];
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  // ── Get all game tags ──
  ipcMain.handle('get-all-game-tags', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'game_tags.json');
      if (fs.existsSync(filePath)) {
        return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      }
      return {};
    } catch (e) {
      return {};
    }
  });

  // ── Cache manifest data for offline use ──
  ipcMain.handle('cache-manifest-offline', async (event, appid, manifestData) => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'offline_manifests.json');
      let manifests = {};
      if (fs.existsSync(filePath)) {
        manifests = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
      manifests[appid] = manifestData;
      fs.writeFileSync(filePath, JSON.stringify(manifests));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Get offline manifest for a specific appid ──
  ipcMain.handle('get-offline-manifest', async (event, appid) => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'offline_manifests.json');
      if (fs.existsSync(filePath)) {
        const manifests = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return manifests[appid] || null;
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  // ── Get list of appids with cached offline manifests ──
  ipcMain.handle('get-offline-cache-list', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'offline_manifests.json');
      if (fs.existsSync(filePath)) {
        const manifests = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return Object.keys(manifests);
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  // ── Check health of mirror repos via GitHub API ──
  ipcMain.handle('check-mirror-health', wrapHandler('check-mirror-health', async () => {
    const { MIRROR_REPOS } = state;
    const results = [];
    const repoTimeout = 8000;
    const BATCH_SIZE = 10;

    // Check a single repo and return a status object (never throws)
    async function checkRepo(repo) {
      const start = Date.now();
      try {
        const data = await new Promise((resolve, reject) => {
          const req = https.get(`https://api.github.com/repos/${repo}`, {
            headers: { 'User-Agent': 'AHG-Unlocker/1.0', 'Accept': 'application/vnd.github.v3+json' },
            timeout: repoTimeout
          }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
              resolve({ status: res.statusCode, latency: Date.now() - start });
            });
          });
          req.on('error', (err) => reject(err));
          req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
          req.end();
        });
        return {
          name: repo,
          status: data.status === 200 ? 'healthy' : 'unhealthy',
          latency: data.latency,
          lastChecked: new Date().toISOString(),
          error: 'HTTP ' + data.status
        };
      } catch (e) {
        return {
          name: repo,
          status: 'error',
          error: e.message,
          latency: Date.now() - start,
          lastChecked: new Date().toISOString()
        };
      }
    }

    // Process in parallel batches
    for (let i = 0; i < MIRROR_REPOS.length; i += BATCH_SIZE) {
      const batch = MIRROR_REPOS.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(batch.map(repo => checkRepo(repo)));
      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          results.push(r.value);
        } else {
          results.push({
            name: 'unknown',
            status: 'error',
            error: r.reason ? r.reason.message : 'Unknown error',
            lastChecked: new Date().toISOString()
          });
        }
      }
    }

    const healthy = results.some(r => r.status === 'healthy');
    return { healthy, mirrors: results };
  }, { windowMs: 60000, maxCalls: 1 }));

  // ── Verify if manifest files exist for an appid ──
  ipcMain.handle('verify-manifest', wrapHandler('verify-manifest', async (event, appid) => {
    try {
      const userDataPath = app.getPath('userData');
      const manifestPath = path.join(userDataPath, 'manifests', `${appid}.manifest`);
      const manifestExists = fs.existsSync(manifestPath);
      const depotDir = path.join(userDataPath, 'depotcache');
      let depotExists = false;
      if (fs.existsSync(depotDir)) {
        const files = await fs.promises.readdir(depotDir);
        depotExists = files.some(f => f.includes(appid));
      }
      return {
        valid: manifestExists && depotExists,
        details: { manifestExists, depotExists }
      };
    } catch (e) {
      return { valid: false, details: { manifestExists: false, depotExists: false } };
    }
  }, { windowMs: 5000, maxCalls: 5 }));

  // ── Secure download with hash verification ──
  ipcMain.handle('secure-download', wrapHandler('secure-download', async (event, url, expectedHash) => {
    const crypto = require('crypto');
    const tempDir = require('os').tmpdir();
    const tempFilePath = path.join(tempDir, `ahg_download_${Date.now()}`);
    try {
      const data = await new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, { timeout: 30000 }, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
      });

      const hash = crypto.createHash('sha256').update(data).digest('hex');
      if (hash !== expectedHash) {
        return { success: false, error: 'Hash mismatch' };
      }

      await fs.promises.writeFile(tempFilePath, data);
      return { success: true, path: tempFilePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, { windowMs: 30000, maxCalls: 2 }));

  // ── Record a game installation ──
  ipcMain.handle('record-install', async (event, appid, size) => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'install_stats.json');
      let stats = { totalInstalls: 0, totalSize: 0, installs: [] };
      if (fs.existsSync(filePath)) {
        stats = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      }
      stats.totalInstalls += 1;
      stats.totalSize += size;
      stats.installs.push({
        date: new Date().toISOString(),
        appid: String(appid),
        size: size
      });
      await fs.promises.writeFile(filePath, JSON.stringify(stats));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Get installation statistics ──
  ipcMain.handle('get-install-stats', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'install_stats.json');
      if (fs.existsSync(filePath)) {
        const stats = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
        return { totalInstalls: stats.totalInstalls || 0, totalSize: stats.totalSize || 0 };
      }
      return { totalInstalls: 0, totalSize: 0 };
    } catch (e) {
      return { totalInstalls: 0, totalSize: 0 };
    }
  });

  // ── Get activity data grouped by date ──
  ipcMain.handle('get-activity-data', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'install_stats.json');
      if (!fs.existsSync(filePath)) {
        return { daily: [] };
      }
      const stats = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      const dailyMap = {};
      for (const install of (stats.installs || [])) {
        const dateKey = install.date ? install.date.split('T')[0] : 'unknown';
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { date: dateKey, installs: 0, size: 0 };
        }
        dailyMap[dateKey].installs += 1;
        dailyMap[dateKey].size += install.size || 0;
      }
      const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
      return { daily };
    } catch (e) {
      return { daily: [] };
    }
  });

}

module.exports = { registerPersistenceHandlers };
