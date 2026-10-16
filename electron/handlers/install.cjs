// ── Install/Game IPC handlers ──
const path = require('path');
const fs = require('fs');
const { ipcMain } = require('electron');
const state = require('../utils/state.cjs');
const { findSteamPath, getCustomDepotCachePath, getCustomStPluginPath } = require('../utils/steamUtils.cjs');
const { wrapHandler } = require('../utils/rateLimiter.cjs');
const ryuuDownloader = require('../ryuuDownloader.cjs');
const { downloadManifest, downloadFromMirrorSingle } = require('./install-helpers.cjs');
// ── Install handler registration ──

function registerInstallHandlers() {
  // ── NOTE: install-game-with-logs, add-to-steam, and install-game-from-zip
  // are handled inline in main.cjs (with customSteamConfig support).
  // These are NOT registered here to avoid ipcMain.handle() duplicate throws.
  // ── Ryuu API Install Channels ──

  ipcMain.handle('install-game-ryuu', wrapHandler('install-game-ryuu', async (event, appid) => {
    try {
      const steamPath = findSteamPath();
      if (!steamPath || !fs.existsSync(steamPath)) {
        return { success: false, message: 'Steam not found. Configure path in Settings.' };
      }

      // Use custom paths if configured
      const depotCache = getCustomDepotCachePath() || path.join(steamPath, 'depotcache');
      const luaPath = getCustomStPluginPath() || path.join(steamPath, 'config', 'stplug-in');

      const logEntries = [];
      const sendLog = (msg) => {
        console.log(`[RYUU] ${msg}`);
        logEntries.push(msg);
        // Stream log to renderer if available
        if (event.sender) {
          try { event.sender.send('install-log', { type: 'ryuu', appid, message: msg }); } catch { console.debug('[INSTALL] Renderer unavailable for log stream (ryuu)'); }
        }
      };

      const result = await ryuuDownloader.downloadGame(appid, {
        steamPath,
        depotCache,
        luaPath,
        onProgress: sendLog,
        signal: event.signal,
        authCode: state.apiConfig?.ryuu?.auth_code,
      });

      return {
        ...result,
        message: logEntries.join('\n') + '\n' + result.message,
      };
    } catch (error) {
      console.error('[MAIN] Ryuu install error:', error);
      return { success: false, manifestCount: 0, totalSize: 0, hasLua: false, message: error.message };
    }
  }, { windowMs: 10000, maxCalls: 2 }));

  // Regenerate a game's manifests on Ryuu's side (Update Game API). Called before
  // re-installing a game the catalog flags as updated, so the follow-up download
  // pulls freshly generated files instead of the stale ones.
  ipcMain.handle('ryuu-update-game', wrapHandler('ryuu-update-game', async (event, appid) => {
    try {
      const result = await ryuuDownloader.updateGame(appid, state.apiConfig?.ryuu?.auth_code);
      console.log('[RYUU] resellerupdate', appid, '→', result.message);
      return { success: result.status === 200, message: result.message || '' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, { windowMs: 10000, maxCalls: 2 }));

  ipcMain.handle('install-ryuu-dlcs', wrapHandler('install-ryuu-dlcs', async (event, baseAppid, dlcAppids) => {
    try {
      const steamPath = findSteamPath();
      if (!steamPath || !fs.existsSync(steamPath)) {
        return { success: false, totalManifests: 0, results: [], message: 'Steam not found' };
      }

      const logEntries = [];
      const sendLog = (msg) => {
        console.log(`[RYUU-DLC] ${msg}`);
        logEntries.push(msg);
        if (event.sender) {
          try { event.sender.send('install-log', { type: 'ryuu-dlc', appid: baseAppid, message: msg }); } catch { console.debug('[INSTALL] Renderer unavailable for log stream (ryuu-dlc)'); }
        }
      };

      const result = await ryuuDownloader.downloadDlcManifests(baseAppid, dlcAppids, {
        steamPath,
        onProgress: sendLog,
        signal: event.signal,
      });

      return {
        ...result,
        message: logEntries.join('\n'),
      };
    } catch (error) {
      console.error('[MAIN] Ryuu DLC install error:', error);
      return { success: false, totalManifests: 0, results: [], message: error.message };
    }
  }, { windowMs: 10000, maxCalls: 2 }));

  // ── NOTE: fetch-dlcs and register-dlcs are handled inline in main.cjs
  // (with customSteamConfig support). Not registered here to avoid duplicates.
}

module.exports = { registerInstallHandlers, downloadManifest, downloadFromMirrorSingle };
