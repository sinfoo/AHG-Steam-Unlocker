// ── Configuration IPC handlers ──
const path = require('path');
const fs = require('fs');
const { ipcMain, app, dialog } = require('electron');
const state = require('../utils/state.cjs');
const { findSteamPath, getCustomDepotCachePath, getCustomStPluginPath, saveCustomSteamConfig, saveApiConfig } = require('../utils/steamUtils.cjs');

// ── Install settings persistence (P2.2: skip DepotBox/DepotDownloader stages) ──
function getInstallSettingsPath() {
  return path.join(app.getPath('userData'), 'install_settings.json');
}

function loadInstallSettings() {
  try {
    const f = getInstallSettingsPath();
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch (e) {
    console.error('[CONFIG] Error loading install settings:', e.message);
  }
  return {};
}

function saveInstallSettings(settings) {
  try {
    fs.writeFileSync(getInstallSettingsPath(), JSON.stringify(settings, null, 2));
    return true;
  } catch (e) {
    console.error('[CONFIG] Error saving install settings:', e.message);
    return false;
  }
}

// Load persisted settings on module init
const installSettings = loadInstallSettings();
if (installSettings.skipDepotStages) {
  state.setSkipDepotStages(true);
}

function registerConfigHandlers() {
  ipcMain.handle('browse-path', async (event, key) => {
    const steamPath = findSteamPath();
    const customDepot = getCustomDepotCachePath();
    const customLua = getCustomStPluginPath();
    const defaultPath = key === 'steam' ? steamPath
      : key === 'lua' ? (customLua || path.join(steamPath, 'config', 'stplug-in'))
      : key === 'manifests' ? (customDepot || path.join(steamPath, 'depotcache'))
      : steamPath;

    const result = await dialog.showOpenDialog(state.mainWindow, {
      defaultPath,
      properties: ['openDirectory']
    });

    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('get-custom-steam-config', async () => {
    return { ...state.customSteamConfig };
  });

  ipcMain.handle('save-custom-steam-config', async (event, config) => {
    state.setCustomSteamConfig(config);
    const saved = await saveCustomSteamConfig(config);
    // manifests installed before a custom depotcache was set would be invisible to Steam: copy them over
    try {
      const steamPath = findSteamPath();
      const dest = config?.depotCachePath;
      const src = steamPath && path.join(steamPath, 'depotcache');
      if (dest && fs.existsSync(dest) && fs.existsSync(src) && path.resolve(dest).toLowerCase() !== path.resolve(src).toLowerCase()) {
        let n = 0;
        for (const f of fs.readdirSync(src)) {
          if (!/^\d+_\d+\.manifest$/.test(f)) continue; // exact manifest names only
          const to = path.join(dest, f);
          if (fs.existsSync(to) || fs.statSync(path.join(src, f)).size === 0) continue;
          fs.copyFileSync(path.join(src, f), to);
          n++;
        }
        if (n) console.log(`[CONFIG] Copied ${n} manifest(s) into custom depotcache`);
      }
    } catch (e) { console.warn('[CONFIG] depotcache migration skipped:', e.message); }
    return saved;
  });

  ipcMain.handle('get-api-config', async () => {
    return { ...state.apiConfig };
  });

  ipcMain.handle('set-api-config', async (event, config) => {
    state.setApiConfig(config);
    return saveApiConfig(config);
  });

  // ── Install settings (P2.2: skip DepotBox/DepotDownloader) ──
  ipcMain.handle('get-install-config', async () => {
    return { skipDepotStages: state.skipDepotStages };
  });

  ipcMain.handle('set-install-config', async (event, config) => {
    if (typeof config.skipDepotStages === 'boolean') {
      state.setSkipDepotStages(config.skipDepotStages);
    }
    return saveInstallSettings(config);
  });
}

module.exports = { registerConfigHandlers };
