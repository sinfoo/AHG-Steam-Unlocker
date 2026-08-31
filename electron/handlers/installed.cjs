// ── Installed games IPC handlers ──
const path = require('path');
const fs = require('fs');
const { ipcMain, app } = require('electron');
const db = require('../db.cjs');
const state = require('../utils/state.cjs');
const { findSteamPath, getCustomDepotCachePath, getCustomStPluginPath } = require('../utils/steamUtils.cjs');
const { fetchDlcInfos } = require('../utils/steamApi.cjs');
const { withCache } = require('../utils/ttlCache.cjs');

const getInstalledGamesImpl = withCache(async () => {
  const steamPath = findSteamPath();
  const luaPath = getCustomStPluginPath() || path.join(steamPath, 'config', 'stplug-in');
  let gamesData = {};
  try {
    const result = db.queryGames({ limit: 999999 });
    if (result.games && result.games.length > 0) {
      for (const game of result.games) gamesData[game.appid] = game;
    }
  } catch (e) { /* gamesData stays empty */ }
  let dlcRegistry = {};
  try {
    const regPath = path.join(app.getPath('userData'), 'dlc_registry.json');
    if (fs.existsSync(regPath)) dlcRegistry = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
  } catch (e) { /* no registry */ }
  if (fs.existsSync(luaPath)) {
    try {
      const luaFiles = await fs.promises.readdir(luaPath);
      for (const lf of luaFiles) {
        const match = lf.match(/^(\d+)_dlcs\.lua$/);
        if (match) {
          const parentId = match[1];
          const content = await fs.promises.readFile(path.join(luaPath, lf), 'utf-8');
          const dlcIds = [...content.matchAll(/addappid\((\d+)\)/g)].map(m => m[1]);
          if (dlcIds.length > 0) {
            if (!dlcRegistry[parentId]) dlcRegistry[parentId] = [];
            for (const id of dlcIds) if (!dlcRegistry[parentId].includes(id)) dlcRegistry[parentId].push(id);
          }
        }
      }
    } catch (e) { /* DLC auto-detect failed */ }
  }
  const allDlcIds = new Set(Object.values(dlcRegistry).flat());
  if (!fs.existsSync(luaPath)) {
    try {
      const installedFilePath = path.join(app.getPath('userData'), 'installed.json');
      if (fs.existsSync(installedFilePath)) {
        const installedAppids = JSON.parse(await fs.promises.readFile(installedFilePath, 'utf-8'));
        if (Array.isArray(installedAppids) && installedAppids.length > 0) {
          return {
            success: true,
            games: installedAppids.map(appid => ({
              appid,
              name: gamesData[appid]?.name || state.dlcInfoCache.get(appid)?.name || `App ${appid}`,
              header_image: gamesData[appid]?.header_image || state.dlcInfoCache.get(appid)?.header_image || `https://i.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
              installed: true,
              isDlc: allDlcIds.has(appid),
              type: gamesData[appid]?.type || state.dlcInfoCache.get(appid)?.type || null
            }))
          };
        }
      }
    } catch (e) { /* fallback failed */ }
    return { success: true, games: [] };
  }
  const files = await fs.promises.readdir(luaPath);
  const games = [];
  for (const file of files) {
    if (file.endsWith('.lua') && !file.endsWith('_dlcs.lua')) {
      const appid = file.slice(0, -4);
      if (/^\d+$/.test(appid)) {
        const gameData = gamesData[appid] || {};
        const dlcCached = state.dlcInfoCache.get(appid);
        games.push({
          appid,
          name: gameData.name || dlcCached?.name || `App ${appid}`,
          header_image: gameData.header_image || dlcCached?.header_image || `https://i.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
          installed: true,
          isDlc: allDlcIds.has(appid),
          type: gameData.type || dlcCached?.type || null
        });
      }
    }
  }
  if (games.length === 0) {
    try {
      const installedFilePath = path.join(app.getPath('userData'), 'installed.json');
      if (fs.existsSync(installedFilePath)) {
        const installedAppids = JSON.parse(await fs.promises.readFile(installedFilePath, 'utf-8'));
        if (Array.isArray(installedAppids) && installedAppids.length > 0) {
          return { success: true, games: installedAppids.map(appid => ({
            appid,
            name: gamesData[appid]?.name || state.dlcInfoCache.get(appid)?.name || `App ${appid}`,
            header_image: gamesData[appid]?.header_image || state.dlcInfoCache.get(appid)?.header_image || `https://i.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
            installed: true,
            isDlc: allDlcIds.has(appid),
            type: gamesData[appid]?.type || state.dlcInfoCache.get(appid)?.type || null
          })) };
        }
      }
    } catch (e) { /* fallback failed */ }
  }
  const missingNames = games.filter(g => g.name.startsWith('App ')).map(g => g.appid);
  if (missingNames.length > 0) {
    try {
      const fetched = await fetchDlcInfos(missingNames);
      for (const g of games) {
        if (fetched[g.appid]) { g.name = fetched[g.appid].name; g.header_image = fetched[g.appid].header_image; }
      }
    } catch (e) { /* fetch failed */ }
  }
  return { success: true, games };
}, 60_000);

// Build the parent-appid → [dlcAppid] map from dlc_registry.json plus any
// {appid}_dlcs.lua files present in stplug-in (covers DLCs added directly by a
// game's reseller lua, or a registry that was cleared). Returned to the renderer
// so the DLC manager can mark already-added DLCs as installed — they live here,
// NOT in the installed-games list (which deliberately excludes DLCs).
async function readDlcRegistry() {
  let registry = {};
  try {
    const regPath = path.join(app.getPath('userData'), 'dlc_registry.json');
    if (fs.existsSync(regPath)) registry = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
  } catch (e) { /* no registry */ }
  try {
    const steamPath = findSteamPath();
    const luaPath = getCustomStPluginPath() || path.join(steamPath, 'config', 'stplug-in');
    if (fs.existsSync(luaPath)) {
      for (const lf of await fs.promises.readdir(luaPath)) {
        const m = lf.match(/^(\d+)_dlcs\.lua$/);
        if (!m) continue;
        const parentId = m[1];
        const content = await fs.promises.readFile(path.join(luaPath, lf), 'utf-8');
        const dlcIds = [...content.matchAll(/addappid\((\d+)\)/g)].map(x => x[1]);
        if (dlcIds.length) {
          registry[parentId] = [...new Set([...(registry[parentId] || []), ...dlcIds])];
        }
      }
    }
  } catch (e) { /* lua scan failed — registry-only is fine */ }
  return registry;
}

function registerInstalledHandlers() {
  // Get installed games from stplug-in folder (TTL cache: 60s)
  ipcMain.handle('get-installed-games', async () => {
    try { return await getInstalledGamesImpl(); }
    catch (error) {
      console.log('[MAIN] get-installed-games error:', error.message);
      return { success: false, message: error.message, games: [] };
    }
  });

  // Return the parent→DLC map so the DLC manager can show already-added DLCs as installed.
  ipcMain.handle('get-dlc-registry', async () => {
    try { return { success: true, registry: await readDlcRegistry() }; }
    catch (error) {
      console.log('[MAIN] get-dlc-registry error:', error.message);
      return { success: false, registry: {} };
    }
  });

  // Save installed games IDs
  ipcMain.handle('save-installed', async (event, appids) => {
    console.log('[MAIN] save-installed called:', appids);
    try {
      const userDataPath = app.getPath('userData');
      const installedFile = path.join(userDataPath, 'installed.json');
      await fs.promises.writeFile(installedFile, JSON.stringify(appids || []));
      console.log('[MAIN] Saved installed games:', appids?.length || 0);
      return { success: true };
    } catch (error) {
      console.log('[MAIN] Error saving:', error.message);
      return { success: false, message: error.message };
    }
  });

  // ── Update detection: remember the catalog updated_date at install time ──
  // installed_versions.json: { "<appid>": { installedAt, updatedDate } }
  // A game is "stale" later when the catalog's updated_date is newer than this.
  const versionsFile = () => path.join(app.getPath('userData'), 'installed_versions.json');
  const readVersions = () => {
    try { return JSON.parse(fs.readFileSync(versionsFile(), 'utf-8')); } catch { return {}; }
  };
  ipcMain.handle('record-install-version', async (event, appid, updatedDate) => {
    try {
      if (!appid) return { success: false };
      const map = readVersions();
      map[String(appid)] = { installedAt: new Date().toISOString(), updatedDate: updatedDate || null };
      await fs.promises.writeFile(versionsFile(), JSON.stringify(map));
      return { success: true };
    } catch (error) {
      console.log('[MAIN] record-install-version error:', error.message);
      return { success: false, message: error.message };
    }
  });
  ipcMain.handle('get-install-versions', async () => {
    return readVersions();
  });
  // Forget a game's recorded version (on uninstall or after re-install)
  ipcMain.handle('clear-install-version', async (event, appid) => {
    try {
      const map = readVersions();
      delete map[String(appid)];
      await fs.promises.writeFile(versionsFile(), JSON.stringify(map));
      return { success: true };
    } catch (error) { return { success: false, message: error.message }; }
  });

  // Remove installed game — deletes the game's manifests (depotcache) + lua (stplug-in).
  ipcMain.handle('remove-installed-game', async (event, appid) => {
    try {
      const steamPath = findSteamPath();
      const depotCache = getCustomDepotCachePath() || path.join(steamPath, 'depotcache');
      const luaPath = getCustomStPluginPath() || path.join(steamPath, 'config', 'stplug-in');
      const appidStr = String(appid);
      let removed = 0;

      // A game's manifests are named <depotid>_<manifestid>.manifest, and the depot IDs
      // usually DIFFER from the game appid (e.g. 271590 → depots 271591..271595). Parse the
      // lua FIRST to collect this game's depot IDs so we delete the right files precisely
      // (matching by exact prefix, never a broad substring that could hit other games).
      const depotIds = new Set([appidStr]);
      const luaFile = path.join(luaPath, appidStr + '.lua');
      try {
        if (fs.existsSync(luaFile)) {
          const lua = fs.readFileSync(luaFile, 'utf-8');
          const re = /(?:addappid|setManifestid)\s*\(\s*(\d+)/g;
          let m;
          while ((m = re.exec(lua))) depotIds.add(m[1]);
        }
      } catch (e) { /* unreadable lua — fall back to appid-only */ }

      // Delete depotcache files whose depot prefix belongs to this game (manifests + appinfo)
      if (fs.existsSync(depotCache)) {
        const files = await fs.promises.readdir(depotCache);
        for (const file of files) {
          const prefix = file.split('_')[0]; // "<depotid>_..." or "<appid>_appinfo.json"
          if (depotIds.has(prefix)) {
            try { await fs.promises.unlink(path.join(depotCache, file)); removed++; } catch (e) {}
          }
        }
      }

      // Delete the lua
      try { if (fs.existsSync(luaFile)) { await fs.promises.unlink(luaFile); removed++; } } catch (e) {}

      // Forget the recorded install version so it isn't flagged stale later
      try {
        const vf = path.join(app.getPath('userData'), 'installed_versions.json');
        if (fs.existsSync(vf)) {
          const map = JSON.parse(fs.readFileSync(vf, 'utf-8'));
          delete map[appidStr];
          await fs.promises.writeFile(vf, JSON.stringify(map));
        }
      } catch (e) {}

      console.log('[MAIN] Removed game', appidStr, '— depots:', [...depotIds].join(','), '— files:', removed);
      return { success: true, message: `Removed ${removed} files`, removed };
    } catch (error) {
      console.log('[MAIN] Remove error:', error.message);
      return { success: false, message: error.message };
    }
  });
}

module.exports = { registerInstalledHandlers };
