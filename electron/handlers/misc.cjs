// ── Miscellaneous IPC handlers (favorites, recent, extraction, etc.) ──
const path = require('path');
const fs = require('fs');
const { ipcMain, app, shell, dialog } = require('electron');
const state = require('../utils/state.cjs');
const { findSteamPath } = require('../utils/steamUtils.cjs');
const { getOrderedRepos, downloadDepotKeys } = require('../utils/repoUtils.cjs');
const { downloadManifest } = require('./install-helpers.cjs');
const { wrapHandler } = require('../utils/rateLimiter.cjs');

function registerMiscHandlers() {
  // Extract fix ZIP to a folder next to it
  ipcMain.handle('extract-fix', async (event, filePath) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, message: 'File not found' };
      }
      const ext = path.extname(filePath).toLowerCase();
      if (ext !== '.zip' && ext !== '.rar') {
        return { success: false, message: 'Unsupported file type' };
      }
      const dir = path.dirname(filePath);
      const basename = path.basename(filePath, ext);
      const extractDir = path.join(dir, basename + '_extracted');
      if (fs.existsSync(extractDir)) {
        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (e) {
          console.error('[MISC] Error cleaning extract directory:', e.message);
        }
      }
      fs.mkdirSync(extractDir, { recursive: true });

      if (ext === '.zip') {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(filePath);
        zip.extractAllTo(extractDir, true);
      } else {
        // execFileSync, not execSync: the old form interpolated filePath into a shell
        // string, so a path containing a double quote could close it and append its own
        // command. Passing args as an array never involves a shell at all.
        const { execFileSync } = require('child_process');
        const sevenZips = [
          path.join(process.env['ProgramW6432'] || '', '7-Zip', '7z.exe'),
          path.join(process.env['ProgramFiles(x86)'] || '', '7-Zip', '7z.exe'),
        ];
        const args = ['x', filePath, `-o${extractDir}`, '-y'];
        let extracted = false;
        for (const exe of sevenZips) {
          try {
            execFileSync(exe, args, { timeout: 30000, windowsHide: true });
            extracted = true;
            break;
          } catch (e) {
            console.debug('[MISC] 7z attempt failed at', exe, '—', e.message);
          }
        }
        if (!extracted) {
          return { success: false, message: 'Extraction failed. Install 7-Zip or extract manually.', extractedDir: extractDir };
        }
      }

      const files = fs.readdirSync(extractDir);
      return { success: true, message: `Extracted ${files.length} files`, extractedDir: extractDir };
    } catch (error) {
      console.error('[MAIN] Extract fix error:', error);
      return { success: false, message: 'Extraction failed: ' + error.message };
    }
  });

  // Open file location in Explorer
  ipcMain.handle('open-file-location', async (event, filePath) => {
    try {
      if (!filePath) return { success: false };
      if (fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
      } else if (fs.existsSync(path.dirname(filePath))) {
        shell.openPath(path.dirname(filePath));
      }
      return { success: true };
    } catch (error) {
      console.error('[MAIN] open-file-location error:', error);
      return { success: false };
    }
  });

  // Restart app (used after update). When an update is staged, the detached updater
  // script replaces the files after exit and relaunches — app.relaunch() must NOT
  // run then, or the old build races the file copy.
  ipcMain.handle('restart-app', async () => {
    const { applyStagedUpdateOnExit } = require('./updates.cjs');
    if (!applyStagedUpdateOnExit()) {
      app.relaunch();
    }
    app.exit(0);
  });

  ipcMain.handle('get-download-path', async () => {
    const downloadsPath = app.getPath('downloads');
    const result = await dialog.showOpenDialog(state.mainWindow, {
      defaultPath: downloadsPath,
      properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // Store last seen version for changelog trigger
  ipcMain.handle('get-last-seen-version', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const versionFile = path.join(userDataPath, 'lastseen.json');
      if (fs.existsSync(versionFile)) {
        return JSON.parse(await fs.promises.readFile(versionFile, 'utf-8'));
      }
    } catch (e) {
      console.error('[MISC] Error reading last seen version:', e.message);
    }
    return null;
  });

  ipcMain.handle('set-last-seen-version', async (event, version) => {
    try {
      const userDataPath = app.getPath('userData');
      const versionFile = path.join(userDataPath, 'lastseen.json');
      await fs.promises.writeFile(versionFile, JSON.stringify({ version, date: new Date().toISOString() }));
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  // Favorites persistence
  ipcMain.handle('save-favorites', async (event, favorites) => {
    try {
      const userDataPath = app.getPath('userData');
      const favFile = path.join(userDataPath, 'favorites.json');
      await fs.promises.writeFile(favFile, JSON.stringify({ favorites: Array.from(favorites), date: new Date().toISOString() }));
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('load-favorites', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const favFile = path.join(userDataPath, 'favorites.json');
      if (fs.existsSync(favFile)) {
        const data = JSON.parse(await fs.promises.readFile(favFile, 'utf-8'));
        return data.favorites || [];
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  // Recent games persistence
  ipcMain.handle('save-recent', async (event, recentGames) => {
    try {
      const userDataPath = app.getPath('userData');
      const recentFile = path.join(userDataPath, 'recent.json');
      await fs.promises.writeFile(recentFile, JSON.stringify({ recent: recentGames.slice(0, 50), date: new Date().toISOString() }));
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('load-recent', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const recentFile = path.join(userDataPath, 'recent.json');
      if (fs.existsSync(recentFile)) {
        const data = JSON.parse(await fs.promises.readFile(recentFile, 'utf-8'));
        return data.recent || [];
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  // Get recently added games (from scan)
  ipcMain.handle('get-recently-added', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const recentAddedFile = path.join(userDataPath, 'recently_added.json');
      if (fs.existsSync(recentAddedFile)) {
        const data = JSON.parse(await fs.promises.readFile(recentAddedFile, 'utf-8'));
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  // Clear recently added games file (called after renderer acknowledges new games)
  ipcMain.handle('clear-recently-added', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const recentAddedFile = path.join(userDataPath, 'recently_added.json');
      if (fs.existsSync(recentAddedFile)) {
        await fs.promises.unlink(recentAddedFile);
        console.log('[MAIN] Cleared recently_added.json');
      }
      return { success: true };
    } catch (e) {
      console.log('[MAIN] Error clearing recently_added.json:', e.message);
      return { success: false, error: e.message };
    }
  });

  // Scan for new manifests
  ipcMain.handle('scan-new-manifests', wrapHandler('scan-new-manifests', async () => {
    try {
      const steamPath = findSteamPath();
      const depotCache = path.join(steamPath, 'depotcache');

      let newCount = 0;

      // Scan each mirror in speed-optimized order
      for (const repo of getOrderedRepos()) {
        try {
          console.log(`[MAIN] Scanning ${repo} for new manifests...`);

          const depotKeysData = await downloadDepotKeys(repo);
          const depotKeys = JSON.parse(depotKeysData.toString());

          // Check existing files
          const existingFiles = fs.existsSync(depotCache) ? await fs.promises.readdir(depotCache) : [];
          const existingApps = new Set(existingFiles.map(f => f.split('_')[0]).filter(x => x));

          // Download missing manifests
          for (const [appid, appData] of Object.entries(depotKeys)) {
            if (!existingApps.has(appid)) {
              const depots = appData.depots || {};
              for (const depotId in depots) {
                const depotData = depots[depotId];
                if (depotData.manifestid) {
                  const downloaded = await downloadManifest(appid, depotId, depotData.manifestid, repo, steamPath);
                  if (downloaded) newCount++;
                }
              }
            }
          }

          console.log(`[MAIN] Found ${newCount} new manifests from ${repo}`);
          break; // Stop after first successful scan
        } catch (e) {
          console.log(`[MAIN] Error scanning ${repo}: ${e.message}`);
          continue;
        }
      }

      return { success: true, message: `Found ${newCount} new manifests`, count: newCount };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, { windowMs: 30000, maxCalls: 1 }));
}

module.exports = { registerMiscHandlers };
