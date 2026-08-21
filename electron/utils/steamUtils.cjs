// ── Steam path and config utilities ──
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const state = require('./state.cjs');

// DepotDownloader path
function getDepotDownloaderPath() {
  const possiblePaths = [
    path.join(process.resourcesPath || '', 'app', 'depotdownloader', 'DepotDownloader.exe'),
    path.join(app.getAppPath(), '..', 'depotdownloader', 'DepotDownloader.exe'),
    path.join(__dirname, '..', 'depotdownloader', 'DepotDownloader.exe'),
    path.join(__dirname, 'depotdownloader', 'DepotDownloader.exe'),
    path.join(process.cwd(), 'depotdownloader', 'DepotDownloader.exe'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log('[DEPOT] Found at:', p);
      return p;
    }
  }
  console.log('[DEPOT] Not found. Tried:', possiblePaths);
  return possiblePaths[0];
}
const DEPOT_DOWNLOADER_PATH = getDepotDownloaderPath();

// Custom Steam path persistence
function getCustomSteamConfig() {
  try {
    const f = path.join(app.getPath('userData'), 'steam_custom_paths.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch (e) {
    console.error('[STEAM] Error loading custom Steam config:', e.message);
  }
  return {};
}

function saveCustomSteamConfig(config) {
  try {
    const f = path.join(app.getPath('userData'), 'steam_custom_paths.json');
    fs.writeFileSync(f, JSON.stringify(config, null, 2));
    return true;
  } catch (e) { return false; }
}

// Load custom path config at module level
try { state.setCustomSteamConfig(getCustomSteamConfig()); } catch (e) {
  console.error('[STEAM] Error setting custom Steam config at module level:', e.message);
}

// API config persistence
function getApiConfig() {
  try {
    const f = path.join(app.getPath('userData'), 'api_config.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch (e) {
    console.error('[STEAM] Error loading API config:', e.message);
  }
  return { ryuu: { auth_code: 'RYUUMANIFESTv78r6h', enabled: true }, steamgriddb: { api_key: '1e7c6c08249aa540c0840b5d95677c12', enabled: true } };
}

function saveApiConfig(config) {
  try {
    const f = path.join(app.getPath('userData'), 'api_config.json');
    fs.writeFileSync(f, JSON.stringify(config, null, 2));
    return true;
  } catch (e) { return false; }
}

function loadApiConfig() {
  try { state.setApiConfig(getApiConfig()); } catch (e) {
    console.error('[STEAM] Error loading API config:', e.message);
  }
}

function findSteamPath() {
  if (state.customSteamConfig?.steamPath && fs.existsSync(state.customSteamConfig.steamPath)) return state.customSteamConfig.steamPath;
  const candidates = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'E:\\Steam',
    path.join(process.env.LOCALAPPDATA || '', 'Steam'),
    path.join(process.env.PROGRAMFILES || '', 'Steam'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Steam'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'steam.exe'))) {
      return p;
    }
  }
  try {
    const { execSync } = require('child_process');
    const result = execSync(
      'reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath 2>nul',
      { encoding: 'utf8', timeout: 3000 }
    );
    const match = result.match(/SteamPath\s+REG_SZ\s+(.+)/);
    if (match) {
      const steamPath = match[1].trim().replace(/\\\\/g, '\\');
      if (fs.existsSync(steamPath)) return steamPath;
    }
  } catch { /* registry query not available */ }

  return state.DEFAULT_STEAM_PATH;
}

function getCustomDepotCachePath() {
  if (state.customSteamConfig?.depotCachePath && fs.existsSync(state.customSteamConfig.depotCachePath)) return state.customSteamConfig.depotCachePath;
  return null;
}

function getCustomStPluginPath() {
  if (state.customSteamConfig?.stPluginPath && fs.existsSync(state.customSteamConfig.stPluginPath)) return state.customSteamConfig.stPluginPath;
  return null;
}

module.exports = {
  getDepotDownloaderPath,
  DEPOT_DOWNLOADER_PATH,
  getCustomSteamConfig,
  saveCustomSteamConfig,
  getApiConfig,
  saveApiConfig,
  loadApiConfig,
  findSteamPath,
  getCustomDepotCachePath,
  getCustomStPluginPath,
};
