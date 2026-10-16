// ── Deferred IPC Handler Loader ──
// These handlers are NOT needed for the initial window render.
// Loading them after createWindow() reduces startup parsing by ~3,900 lines.
// See MAINTAINERS.md for handler registration ordering rules.
//
// Required from main.cjs via setImmediate() after createWindow().
//
// Ordering note: The relative import order of these handlers does not matter
// for correctness — each register*Handlers() call is independent and
// registers channels with the same ipcMain singleton. However, keeping a
// stable canonical order (by filename) makes diffs cleaner.

const { registerConfigHandlers } = require('./config.cjs');
const { registerDbHandlers } = require('./db.cjs');
const { registerInstallHandlers } = require('./install.cjs');
const { registerInstalledHandlers } = require('./installed.cjs');
const { registerLicenseHandlers } = require('./license.cjs');
const { registerMiscHandlers } = require('./misc.cjs');
const { registerScanHandlers } = require('./scan.cjs');
const { registerSteamHandlers } = require('./steam.cjs');
const { registerModeHandlers } = require('./mode.cjs');
const { registerSystemHandlers } = require('./system.cjs');
const { registerUpdateHandlers } = require('./updates.cjs');
const { createLazyModule } = require('../utils/lazyLoader.cjs');

// Fixes handlers (~519 lines) — loaded on first use
createLazyModule([
  'download-fix',
  'fix-no-internet',
  'fix-no-games',
  'copy-manifest',
  'clear-cache',
  'fix-games-not-showing',
], () => {
  const { registerFixesHandlers } = require('./fixes.cjs');
  registerFixesHandlers();
});

function registerDeferredHandlers() {
  registerConfigHandlers();
  registerDbHandlers();
  registerInstallHandlers();
  registerInstalledHandlers();
  registerLicenseHandlers();
  registerMiscHandlers();
  registerScanHandlers();
  registerSteamHandlers();
  registerModeHandlers();
  registerSystemHandlers();
  registerUpdateHandlers();
  console.log('[MAIN] Deferred IPC handlers registered');
}

module.exports = { registerDeferredHandlers };
