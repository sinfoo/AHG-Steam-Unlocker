// ── Steam utility IPC handlers ──
const path = require('path');
const { ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const { findSteamPath } = require('../utils/steamUtils.cjs');

function registerSteamHandlers() {
  ipcMain.handle('restart-steam', async () => {
    try {
      const steamPath = findSteamPath();
      const steamExe = path.join(steamPath, 'steam.exe');
      spawn('taskkill', ['/F', '/IM', 'steam.exe'], { shell: true });
      setTimeout(() => {
        spawn(steamExe, [], { detached: true });
      }, 2000);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('open-steam-folder', async () => {
    const steamPath = findSteamPath();
    shell.openPath(steamPath);
    return { success: true };
  });

  // Handlers below are registered by system.cjs (which runs after steam.cjs):
  // - steam-status → system.cjs: get-steam-status (used by frontend)
  // - launch-game → system.cjs: launch-game
  // - refresh-steam → system.cjs: refresh-steam
  // - cancel-download → system.cjs: cancel-download
  // Game tags handled by persistence.cjs (working impl)

  // fetch-steam-genres → system.cjs (active impl)
  // check-free-games → system.cjs (active impl)
}

module.exports = { registerSteamHandlers };
