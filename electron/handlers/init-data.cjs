// ── App Init-Data batch IPC handler ──
// Batches 5 small READ channels into one invoke for faster startup.
// Requires from main.cjs modules to avoid handler duplication.
const path = require('path');
const fs = require('fs');
const { ipcMain, app } = require('electron');
const db = require('../db.cjs');

function registerInitDataHandler({ customFixesManager }) {
  ipcMain.handle('app:init-data', async () => {
    const userDataPath = app.getPath('userData');
    const result = { fixes: [], customFixes: [], favorites: [], recent: [], recentlyAdded: [] };

    // 1. Fixes from fixes.db — the canonical, remote-synced catalogue (NOT fixes.json).
    //    fixes.json was a stale static cache; the DB is what remote-sync upserts into.
    try {
      result.fixes = db.getAllFixes() || [];
    } catch (e) { console.error('[INIT-DATA] getAllFixes (db) error:', e.message); }

    // 2. Custom fixes
    try { result.customFixes = customFixesManager.getAllCustomFixes(); }
    catch (e) { console.error('[INIT-DATA] get-custom-fixes error:', e.message); }

    // 3. Favorites
    try {
      const favFile = path.join(userDataPath, 'favorites.json');
      if (fs.existsSync(favFile)) {
        const data = JSON.parse(await fs.promises.readFile(favFile, 'utf-8'));
        result.favorites = data.favorites || [];
      }
    } catch (e) { /* file may not exist */ }

    // 4. Recent games
    try {
      const recentFile = path.join(userDataPath, 'recent.json');
      if (fs.existsSync(recentFile)) {
        const data = JSON.parse(await fs.promises.readFile(recentFile, 'utf-8'));
        result.recent = data.recent || [];
      }
    } catch (e) { /* file may not exist */ }

    // 5. Recently added games from scan
    try {
      const recentAddedFile = path.join(userDataPath, 'recently_added.json');
      if (fs.existsSync(recentAddedFile)) {
        const data = JSON.parse(await fs.promises.readFile(recentAddedFile, 'utf-8'));
        result.recentlyAdded = Array.isArray(data) ? data : [];
      }
    } catch (e) { /* file may not exist */ }

    return result;
  });
}

module.exports = { registerInitDataHandler };
