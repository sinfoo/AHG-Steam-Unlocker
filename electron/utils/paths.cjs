// ── Path resolution module ──
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const DEFAULT_STEAM_PATH = "C:\\Program Files (x86)\\Steam";

// Path to DepotDownloader executable - check multiple possible locations
function getDepotDownloaderPath() {
  const possiblePaths = [
    // Production: inside resources/app/depotdownloader/
    path.join(process.resourcesPath || '', 'app', 'depotdownloader', 'DepotDownloader.exe'),
    // Production alternative
    path.join(app.getAppPath(), '..', 'depotdownloader', 'DepotDownloader.exe'),
    // Dev mode: relative to main.cjs (which is in electron/)
    path.join(__dirname, '..', '..', 'depotdownloader', 'DepotDownloader.exe'),
    path.join(__dirname, '..', 'depotdownloader', 'DepotDownloader.exe'),
    // Fallback: cwd
    path.join(process.cwd(), 'depotdownloader', 'DepotDownloader.exe'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log('[DEPOT] Found at:', p);
      return p;
    }
  }
  console.log('[DEPOT] Not found. Tried:', possiblePaths);
  return possiblePaths[0]; // Return first as default
}
const DEPOT_DOWNLOADER_PATH = getDepotDownloaderPath();

function getResourcePath(relativePath) {
  console.log('[MAIN] getResourcePath called:', relativePath, 'packaged:', app.isPackaged);

  const possiblePaths = [];

  if (app.isPackaged) {
    // Packaged app
    possiblePaths.push(path.join(process.resourcesPath, relativePath));
    possiblePaths.push(path.join(process.resourcesPath, 'app', relativePath));
  } else {
    // Development - try multiple levels
    possiblePaths.push(path.join(__dirname, '..', '..', relativePath));
    possiblePaths.push(path.join(__dirname, '..', '..', '..', relativePath));
    possiblePaths.push(path.join(__dirname, '..', '..', '..', '..', relativePath));
  }

  // Return first existing path
  for (const p of possiblePaths) {
    console.log('[MAIN] Checking path:', p, 'exists:', fs.existsSync(p));
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback to first path anyway
  return possiblePaths[0];
}

function findSteamPath(customSteamConfig) {
  // Check custom config first
  if (customSteamConfig?.steamPath && fs.existsSync(customSteamConfig.steamPath)) return customSteamConfig.steamPath;
  // Check common locations
  const paths = [
    "C:\\Program Files (x86)\\Steam",
    "C:\\Program Files\\Steam",
    "D:\\Steam",
    "E:\\Steam",
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return DEFAULT_STEAM_PATH;
}

function getCustomDepotCachePath(customSteamConfig) {
  if (customSteamConfig?.depotCachePath && fs.existsSync(customSteamConfig.depotCachePath)) return customSteamConfig.depotCachePath;
  return null;
}

function getCustomStPluginPath(customSteamConfig) {
  if (customSteamConfig?.stPluginPath && fs.existsSync(customSteamConfig.stPluginPath)) return customSteamConfig.stPluginPath;
  return null;
}

module.exports = {
  getDepotDownloaderPath,
  DEPOT_DOWNLOADER_PATH,
  DEFAULT_STEAM_PATH,
  getResourcePath,
  findSteamPath,
  getCustomDepotCachePath,
  getCustomStPluginPath
};
