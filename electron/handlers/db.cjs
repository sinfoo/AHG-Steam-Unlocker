// ── Database IPC handlers ──
const path = require('path');
const fs = require('fs');
const { ipcMain, app } = require('electron');
const db = require('../db.cjs');
const customFixesManager = require('../custom-fixes-manager.cjs');
const remoteSyncManager = require('../remote-sync-manager.cjs');
const state = require('../utils/state.cjs');
const { withCache } = require('../utils/ttlCache.cjs');
const { wrapHandler } = require('../utils/rateLimiter.cjs');

const LICENSE_FILE = path.join(app.getPath('userData'), 'ahg_license.json');

function loadLocalLicense() {
  // Dev bypass — genuine dev launches only. (Must NOT key off the exe path: the packaged
  // build lives in dev-release\win-unpacked, which made every real install bypass activation.)
  if (!app.isPackaged || process.argv.includes('--dev') || process.env.NODE_ENV === 'development') {
    return { activated: true, machineId: 'dev-bypass' };
  }
  try {
    if (fs.existsSync(LICENSE_FILE)) {
      return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[DB] Error loading local license:', e.message);
  }
  return null;
}

function registerDbHandlers() {
  // Load games via SQLite
  ipcMain.handle('load-games', wrapHandler('load-games', async () => {
    console.log('[MAIN-TRACE] load-games handler called');
    try {
      // NOTE: the catalogue is public Steam metadata, not a licensed asset, so it loads
      // regardless of activation — this lets the renderer pre-load all games in the
      // background while the activation modal is up, so Browse is instant once activated.
      // (The activation modal still blocks the UI, and install/unlock actions remain gated.)
      // The window/splash is created BEFORE the DB finishes loading, so a fast renderer can
      // call load-games before the DB is ready — wait for it here.
      try { if (globalThis._dbReadyPromise) await globalThis._dbReadyPromise; } catch { /* fall through */ }
      const t0 = Date.now()
      console.log('[MAIN-TRACE] Calling db.getAllGames()...')
      const games = db.getAllGames();
      console.log('[MAIN-TRACE] db.getAllGames() returned', games.length, 'games in', Date.now() - t0, 'ms');
      return games;
    } catch (error) {
      console.error('[MAIN-TRACE] Error loading games:', error);
    }
    return [];
  }, { windowMs: 1000, maxCalls: 5 }));

  // Paginated game queries
  ipcMain.handle('db:query-games', wrapHandler('db:query-games', async (event, opts) => {
    try { return db.queryGames(opts || {}); }
    catch (err) {
      console.error('[MAIN] db:query-games error:', err.message);
      return { games: [], total: 0, page: 1, pageSize: 50 };
    }
  }, { windowMs: 500, maxCalls: 10 }));

  // Single game by appid (TTL cache: 30s)
  const getGameCached = withCache(async (appid) => db.getGame(appid) || null, 30_000);
  ipcMain.handle('db:get-game', wrapHandler('db:get-game', async (event, appid) => {
    try { return await getGameCached(appid); }
    catch (err) {
      console.error('[MAIN] db:get-game error:', err.message);
      return null;
    }
  }, { windowMs: 500, maxCalls: 20 }));

  // Batch name/header lookup
  ipcMain.handle('db:get-games-meta', wrapHandler('db:get-games-meta', async (event, appids) => {
    try { return db.getGamesMeta(appids || []); }
    catch (err) {
      console.error('[MAIN] db:get-games-meta error:', err.message);
      return [];
    }
  }, { windowMs: 1000, maxCalls: 5 }));

  // Batch full game details (supports fields filtering)
  const batchGetDetailsCached = withCache(async (appids) => db.batchGetGameDetails(appids), 30_000);
  ipcMain.handle('db:batch-get-game-details', wrapHandler('db:batch-get-game-details', async (event, payload) => {
    try {
      // Support both {appids, fields} and plain array (backward compat)
      if (Array.isArray(payload)) {
        return await batchGetDetailsCached(payload);
      }
      const { appids, fields } = payload || {};
      return db.batchGetGameDetails(appids, fields);
    } catch (err) {
      console.error('[MAIN] db:batch-get-game-details error:', err.message);
      return [];
    }
  }, { windowMs: 1000, maxCalls: 10 }));

  // Batch paginated queries
  ipcMain.handle('db:batch-query-games', wrapHandler('db:batch-query-games', async (event, queryOptsList) => {
    try { return db.batchQueryGames(queryOptsList || []); }
    catch (err) {
      console.error('[MAIN] db:batch-query-games error:', err.message);
      return [];
    }
  }, { windowMs: 500, maxCalls: 10 }));

  // Range-based game query (for rapid scroll / virtual lists)
  ipcMain.handle('db:query-game-range', wrapHandler('db:query-game-range', async (event, { startIndex, count }) => {
    try { return db.queryGameRange(startIndex, count); }
    catch (err) {
      console.error('[MAIN] db:query-game-range error:', err.message);
      return [];
    }
  }, { windowMs: 500, maxCalls: 10 }));

  // Total game count (TTL cache: 30s)
  const getGameCountCached = withCache(async () => db.getGameCount(), 30_000);
  ipcMain.handle('db:get-game-count', wrapHandler('db:get-game-count', async () => {
    try { return await getGameCountCached(); }
    catch (err) {
      console.error('[MAIN] db:get-game-count error:', err.message);
      return 0;
    }
  }, { windowMs: 1000, maxCalls: 5 }));

  // Check if a game exists (TTL cache: 30s)
  const gameExistsCached = withCache(async (appid) => db.gameExists(appid), 30_000);
  ipcMain.handle('db:game-exists', wrapHandler('db:game-exists', async (event, appid) => {
    try { return await gameExistsCached(appid); }
    catch (err) {
      console.error('[MAIN] db:game-exists error:', err.message);
      return false;
    }
  }, { windowMs: 500, maxCalls: 20 }));

  // Get all game IDs and names
  ipcMain.handle('db:get-all-game-ids', wrapHandler('db:get-all-game-ids', async () => {
    try { return db.getAllGameIds(); }
    catch (err) {
      console.error('[MAIN] db:get-all-game-ids error:', err.message);
      return [];
    }
  }, { windowMs: 1000, maxCalls: 5 }));

  // Insert or update a single game
  ipcMain.handle('db:upsert-game', async (event, game) => {
    try {
      const result = db.upsertGame(game);
      if (result) db.persist();
      return result;
    } catch (err) {
      console.error('[MAIN] db:upsert-game error:', err.message);
      return false;
    }
  });

  // Update game header_image
  ipcMain.handle('db:update-game-cover', async (event, appid, image) => {
    try {
      const result = db.updateGameCover(appid, image);
      if (result) db.persist();
      return result;
    } catch (err) {
      console.error('[MAIN] db:update-game-cover error:', err.message);
      return false;
    }
  });

  // Bulk upsert games
  ipcMain.handle('db:upsert-games', async (event, games) => {
    try {
      const count = db.upsertGames(games || []);
      if (count > 0) db.persist();
      return count;
    } catch (err) {
      console.error('[MAIN] db:upsert-games error:', err.message);
      return 0;
    }
  });

  // Get all fixes
  ipcMain.handle('db:get-fixes', wrapHandler('db:get-fixes', async () => {
    try { return db.getAllFixes(); }
    catch (err) {
      console.error('[MAIN] db:get-fixes error:', err.message);
      return [];
    }
  }, { windowMs: 1000, maxCalls: 5 }));

  // Get a single fix (TTL cache: 30s)
  const getFixCached = withCache(async (appid) => db.getFix(appid) || null, 30_000);
  ipcMain.handle('db:get-fix', wrapHandler('db:get-fix', async (event, appid) => {
    try { return await getFixCached(appid); }
    catch (err) {
      console.error('[MAIN] db:get-fix error:', err.message);
      return null;
    }
  }, { windowMs: 500, maxCalls: 20 }));

  // Search fixes
  ipcMain.handle('db:search-fixes', wrapHandler('db:search-fixes', async (event, query) => {
    try { return db.searchFixes(query); }
    catch (err) {
      console.error('[MAIN] db:search-fixes error:', err.message);
      return [];
    }
  }, { windowMs: 1000, maxCalls: 10 }));

  // Custom fixes
  ipcMain.handle('get-custom-fixes', async () => {
    try { return customFixesManager.getAllCustomFixes(); }
    catch (e) {
      console.error('[MAIN] get-custom-fixes error:', e.message);
      return [];
    }
  });

  ipcMain.handle('check-new-custom-fixes', wrapHandler('check-new-custom-fixes', async () => {
    try {
      const result = await customFixesManager.checkForNewCustomFixes();
      return result;
    } catch (e) {
      console.error('[MAIN] check-new-custom-fixes error:', e.message);
      return { newFixes: [], allFixes: [], error: e.message };
    }
  }, { windowMs: 10000, maxCalls: 1 }));

  // Remote sync
  ipcMain.handle('remote-sync:check', wrapHandler('remote-sync:check', async () => {
    try {
      const result = await remoteSyncManager.checkForUpdates();
      return result;
    } catch (e) {
      console.error('[MAIN] remote-sync:check error:', e.message);
      return { newGames: [], newFixes: [], errors: [e.message] };
    }
  }, { windowMs: 10000, maxCalls: 1 }));
}

module.exports = { registerDbHandlers, loadLocalLicense };
