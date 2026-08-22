/**
 * db.cjs
 *
 * SQLite database wrapper for the AHG Unlocker main process.
 * Uses sql.js (pure WASM SQLite, no native modules) for safe cross-platform
 * operation in the Electron main process.
 *
 * Provides:
 *  - Database initialization (games.db + fixes.db)
 *  - Paginated game queries with search, sort, and platform filter
 *  - Full dataset export for backward compatibility
 *  - INSERT/UPDATE helpers for dynamic game addition
 *  - Fix queries
 */

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

// ── Configuration ──────────────────────────────────────────────────────────
const DB_FILENAME = 'games.db';
const FIXES_DB_FILENAME = 'fixes.db';
const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// ── State ──────────────────────────────────────────────────────────────────
let _db = null;        // games database handle
let _fixesDb = null;   // fixes database handle
let _initialized = false;
let _dbDir = null;     // directory where db files are located

/**
 * Find the directory containing database files.
 * Checks: resources/ (standalone file) → resources/app/ (inside asar) → project root (dev)
 */
function findDbDir() {
  if (_dbDir) return _dbDir;

  const possibleDirs = [];

  if (process.resourcesPath) {
    // Standalone copy in resources/
    possibleDirs.push(process.resourcesPath);
    // Inside asar
    possibleDirs.push(path.join(process.resourcesPath, 'app'));
  }

  // Dev mode: project root
  possibleDirs.push(__dirname);                      // electron/
  possibleDirs.push(path.resolve(__dirname, '..'));   // project root

  // Also check where games.json lives
  possibleDirs.push(path.resolve(__dirname, '..', '..'));

  for (const dir of possibleDirs) {
    const testPath = path.join(dir, 'games.db');
    if (fs.existsSync(testPath)) {
      console.log('[DB] Found games.db at:', testPath);
      _dbDir = dir;
      return dir;
    }
  }

  console.warn('[DB] games.db not found in any expected location');
  console.warn('[DB] Searched:', possibleDirs);
  return possibleDirs[0]; // default
}

/**
 * Find the fixes database location
 */
function findFixesDbPath() {
  const dir = findDbDir();
  const p = path.join(dir, FIXES_DB_FILENAME);
  if (fs.existsSync(p)) {
    console.log('[DB] Found fixes.db at:', p);
    return p;
  }
  // fallback
  return path.join(process.resourcesPath || path.resolve(__dirname, '..'), FIXES_DB_FILENAME);
}

/**
 * Initialize both databases.
 * Must be called once at app startup before any queries.
 */
async function initialize() {
  if (_initialized) return;
  console.log('[DB] Initialising SQLite databases...');

  try {
    const SQL = await initSqlJs();
    console.log('[DB] sql.js loaded');

    // ── Games DB ──
    const gamesDbPath = path.join(findDbDir(), DB_FILENAME);
    console.log('[DB] Opening games.db:', gamesDbPath);

    if (!fs.existsSync(gamesDbPath)) {
      console.error('[DB] CRITICAL: games.db not found at', gamesDbPath);
      console.error('[DB] Run node scripts/convert-to-sqlite.js first');
      throw new Error('games.db not found - run conversion script');
    }

    const gamesBuffer = fs.readFileSync(gamesDbPath);
    _db = new SQL.Database(gamesBuffer);
    console.log('[DB] games.db opened, size:', (gamesBuffer.length / 1024 / 1024).toFixed(1), 'MB');

    // Drop FTS triggers — they cause errors with sql.js FTS4 implementation.
    // FTS index is managed explicitly in upsertGame/deleteGame instead.
    try { _db.run('DROP TRIGGER IF EXISTS games_ai'); } catch { /* expected if triggers never created */}
    try { _db.run('DROP TRIGGER IF EXISTS games_ad'); } catch { /* expected if triggers never created */}
    try { _db.run('DROP TRIGGER IF EXISTS games_au'); } catch { /* expected if triggers never created */}
    console.log('[DB] FTS triggers dropped (managed in JS instead)');

    // ── Fixes DB ──
    const fixesPath = findFixesDbPath();
    if (fs.existsSync(fixesPath)) {
      const fixesBuffer = fs.readFileSync(fixesPath);
      _fixesDb = new SQL.Database(fixesBuffer);
      console.log('[DB] fixes.db opened, size:', (fixesBuffer.length / 1024).toFixed(0), 'KB');
    } else {
      console.warn('[DB] fixes.db not found — fixes will be unavailable');
      _fixesDb = new SQL.Database(); // empty
      _fixesDb.run(`
        CREATE TABLE IF NOT EXISTS fixes (
          appid TEXT, name TEXT DEFAULT '', badges TEXT DEFAULT '[]',
          fix_count INTEGER DEFAULT 0, source TEXT DEFAULT '',
          download_url TEXT DEFAULT '', game_url TEXT DEFAULT '',
          download_urls TEXT DEFAULT '[]', filename TEXT DEFAULT '',
          versions TEXT DEFAULT '[]', PRIMARY KEY (appid)
        )
      `);
    }

    _initialized = true;
    console.log('[DB] ✓ Databases ready');
  } catch (err) {
    console.error('[DB] Initialization error:', err);
    throw err;
  }
}

/**
 * Ensure DB is initialized before querying
 */
function ensureInit() {
  if (!_initialized) {
    throw new Error('[DB] Not initialized — call initialize() first');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Game Queries
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Escape special LIKE characters in user input
 */
function escapeLike(str) {
  return String(str).replace(/[%_\\]/g, '\\$&');
}

/**
 * Build WHERE clause and params for game search/filter.
 *
 * @param {object} opts
 * @param {string} opts.search  - text search (matches name or tags)
 * @param {string} opts.platform - platform filter (matches tags JSON)
 * @param {string} opts.type  - type filter (e.g. 'game', 'Application')
 * @returns {{ where: string, params: object }}
 */
function buildGameQuery(opts = {}) {
  const clauses = [];
  const params = {};

  if (opts.search) {
    // Prefix-first: the name must START with the query, or a WORD in the name must.
    // The old `%q%` (substring anywhere) + `tags LIKE` matched all over the place and
    // surfaced irrelevant games (a query hitting a tag, or a mid-word substring).
    const esc = escapeLike(opts.search.trim());
    clauses.push("(name LIKE $prefix ESCAPE '\\' OR name LIKE $wordPrefix ESCAPE '\\')");
    params.$prefix = `${esc}%`;
    params.$wordPrefix = `% ${esc}%`;
  }

  if (opts.platform) {
    // platforms is a JSON string array like '["windows","mac"]' in SQLite
    clauses.push('platforms LIKE $platform');
    params.$platform = `%"${escapeLike(opts.platform)}"%`;
  }

  if (opts.type) {
    clauses.push('type = $type');
    params.$type = opts.type;
  }

  const where = clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : '';
  return { where, params };
}

/**
 * Fetch a paginated page of games.
 *
 * @param {object} opts
 * @param {number} opts.page   - 1-based page number
 * @param {number} opts.limit  - items per page (default 50, max 200)
 * @param {string} opts.search - optional search query
 * @param {string} opts.platform  - optional platform filter
 * @param {string} opts.type   - optional type filter
 * @param {string} opts.sort   - 'name_asc' | 'name_desc' | 'added' | (default: name_asc)
 * @returns {{ games: object[], total: number, page: number, pageSize: number }}
 */
function queryGames(opts = {}) {
  ensureInit();

  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, opts.limit || PAGE_SIZE));
  const offset = (page - 1) * limit;

  const { where, params } = buildGameQuery(opts);

  // Build sort clause
  let orderBy;
  switch (opts.sort) {
    case 'name_desc':  orderBy = 'ORDER BY name DESC'; break;
    case 'added':      orderBy = 'ORDER BY added_date DESC'; break;
    case 'added_asc':  orderBy = 'ORDER BY added_date ASC'; break;
    case 'name_asc':
    default:           orderBy = 'ORDER BY name COLLATE NOCASE ASC'; break;
  }
  // When searching, rank true prefix matches ("elden…") above word-prefix matches
  // ("the elden…") regardless of the chosen sort, so the instant dropdown feels precise.
  if (opts.search) {
    orderBy = "ORDER BY CASE WHEN name LIKE $prefix ESCAPE '\\' THEN 0 ELSE 1 END, " +
      orderBy.replace(/^ORDER BY /, '');
  }

  // Count total matching
  const countSql = `SELECT COUNT(*) as cnt FROM games ${where}`;
  const countResult = _db.exec(countSql, params);
  const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

  // Fetch page
  const pageSql = `SELECT * FROM games ${where} ${orderBy} LIMIT $limit OFFSET $offset`;
  const pageParams = { ...params, $limit: limit, $offset: offset };
  const rows = _db.exec(pageSql, pageParams);

  const games = parseGameRows(rows);

  return { games, total, page, pageSize: limit };
}

/**
 * Parse SQLite result rows into game objects.
 */
function parseGameRows(rows) {
  if (!rows || rows.length === 0) return [];
  const result = rows[0];
  if (!result || !result.values || result.values.length === 0) return [];
  const cols = result.columns;
  return result.values.map(rowValues => {
    const g = {};
    for (let i = 0; i < cols.length; i++) {
      g[cols[i]] = rowValues[i];
    }
    // Convert stored JSON strings back to arrays/objects
    try { g.tags = JSON.parse(g.tags || '[]'); } catch { g.tags = []; }
    try { g.genres = JSON.parse(g.genres || '[]'); } catch { g.genres = []; }
    try { g.platforms = JSON.parse(g.platforms || '[]'); } catch { g.platforms = []; }
    try { g.dlc = JSON.parse(g.dlc || '{}'); } catch { g.dlc = {}; }
    // Convert integers to booleans
    g.nsfw = !!g.nsfw;
    g.drm = !!g.drm;
    // Compute isDlc from the type column (not stored in SQLite, derived at read time)
    g.isDlc = (g.type || '') === 'dlc';
    return g;
  });
}

/**
 * Get all games (for backward compatibility / full-data use cases).
 * Returns the full array of game objects.
 * Warning: this loads ALL games into memory (~176K objects).
 */
function getAllGames() {
  ensureInit();
  const rows = _db.exec('SELECT * FROM games ORDER BY name COLLATE NOCASE ASC');
  return parseGameRows(rows);
}

/**
 * Get total game count.
 */
function getGameCount() {
  ensureInit();
  const result = _db.exec('SELECT COUNT(*) as cnt FROM games');
  return result.length > 0 ? result[0].values[0][0] : 0;
}

/**
 * Lightweight appid → updated_date map for the whole catalogue (no full row parse).
 * Used by the remote sync to diff the Ryuu feed against what's actually in the DB.
 */
function getAllAppidsMap() {
  ensureInit();
  const rows = _db.exec('SELECT appid, updated_date FROM games');
  const m = new Map();
  if (rows.length > 0) {
    for (const r of rows[0].values) m.set(String(r[0]), r[1]);
  }
  return m;
}

/**
 * Get a single game by appid.
 */
function getGame(appid) {
  ensureInit();
  const rows = _db.exec('SELECT * FROM games WHERE appid = $appid', { $appid: String(appid) });
  const parsed = parseGameRows(rows);
  return parsed.length > 0 ? parsed[0] : null;
}

/**
 * Get multiple games by appid (for cross-referencing).
 * Returns compact array of { appid, name, header_image }.
 */
function getGamesMeta(appids) {
  if (!appids || appids.length === 0) return [];
  ensureInit();

  const placeholders = appids.map((_, i) => `$${i}`).join(',');
  const params = {};
  appids.forEach((id, i) => { params[`$${i}`] = String(id); });

  const sql = `SELECT appid, name, header_image FROM games WHERE appid IN (${placeholders})`;
  const rows = _db.exec(sql, params);

  if (!rows || rows.length === 0) return [];
  const result = rows[0];
  if (!result || !result.values || result.values.length === 0) return [];
  const cols = result.columns;
  return result.values.map(rowValues => {
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = rowValues[i];
    return obj;
  });
}

/**
 * Batch get full game details for multiple appids.
 * Returns array of full Game objects (same shape as getGame()).
 * Order matches the input appid order; missing appids get null.
 */
function batchGetGameDetails(appids, fields) {
  if (!appids || appids.length === 0) return [];
  ensureInit();

  const placeholders = appids.map((_, i) => `$${i}`).join(',');
  const params = {};
  appids.forEach((id, i) => { params[`$${i}`] = String(id); });

  const columns = fields && fields.length > 0
    ? fields.map(f => `"${f.replace(/"/g, '""')}"`).join(',')
    : '*';

  const sql = `SELECT ${columns} FROM games WHERE appid IN (${placeholders})`;
  const rows = parseGameRows(_db.exec(sql, params));

  // Return in input order, null for missing
  const byAppid = {};
  for (const r of rows) byAppid[r.appid] = r;
  return appids.map(id => byAppid[String(id)] || null);
}

/**
 * Batch execute multiple paginated queryGames calls in a single function.
 * Takes an array of QueryGamesOpts objects and returns an array of results.
 */
function batchQueryGames(queryOptsList) {
  if (!queryOptsList || queryOptsList.length === 0) return [];
  return queryOptsList.map(opts => queryGames(opts));
}

/**
 * Query a range of games by start index and count (for rapid scroll / virtual lists).
 * Returns raw games array in name order.
 * @param {number} startIndex - starting offset (0-based)
 * @param {number} count - number of games to fetch
 */
function queryGameRange(startIndex, count) {
  ensureInit();
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, count || PAGE_SIZE));
  const offset = Math.max(0, startIndex || 0);
  const sql = 'SELECT * FROM games ORDER BY name COLLATE NOCASE ASC LIMIT $limit OFFSET $offset';
  const rows = _db.exec(sql, { $limit: limit, $offset: offset });
  return parseGameRows(rows);
}

/**
 * Get all game IDs and names (compact, for building lookup sets).
 */
function getAllGameIds() {
  ensureInit();
  const rows = _db.exec('SELECT appid, name FROM games');
  if (!rows || rows.length === 0) return [];
  return rows.map(row => ({ appid: row.values[0][0], name: row.values[0][1] }));
}

/**
 * Check if a game exists by appid.
 */
function gameExists(appid) {
  ensureInit();
  const result = _db.exec('SELECT 1 FROM games WHERE appid = $appid', { $appid: String(appid) });
  return result.length > 0 && result[0].values.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Game Insertion / Updates
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Insert a new game or update an existing one.
 *
 * @param {object} game - Game object with at minimum { appid, name }
 * @returns {boolean} success
 */
function upsertGame(game) {
  ensureInit();

  // The Ryuu feed carries no genres/platforms, so an INSERT OR REPLACE would wipe those
  // fields on games we already have. When the incoming record omits them, carry over the
  // existing row's values so updating a game never strips its genre/platform data.
  let genres = game.genres;
  let platforms = game.platforms;
  const noGenres = !Array.isArray(genres) || genres.length === 0;
  const noPlatforms = !Array.isArray(platforms) || platforms.length === 0;
  if (noGenres || noPlatforms) {
    try {
      const ex = _db.exec('SELECT genres, platforms FROM games WHERE appid = $a', { $a: String(game.appid ?? '') });
      if (ex.length > 0 && ex[0].values.length > 0) {
        if (noGenres) { try { genres = JSON.parse(ex[0].values[0][0] || '[]'); } catch (_) { genres = []; } }
        if (noPlatforms) { try { platforms = JSON.parse(ex[0].values[0][1] || '[]'); } catch (_) { platforms = []; } }
      }
    } catch (_) { /* new game / lookup failed — defaults below */ }
  }

  const stmt = _db.prepare(`
    INSERT OR REPLACE INTO games
      (appid, name, added_date, updated_date, type, tags, nsfw, drm, dlc, header_image, genres, platforms)
    VALUES
      ($appid, $name, $added_date, $updated_date, $type, $tags, $nsfw, $drm, $dlc, $header_image, $genres, $platforms)
  `);

  try {
    stmt.run({
      $appid:        String(game.appid ?? ''),
      $name:         String(game.name ?? ''),
      $added_date:   String(game.added_date ?? new Date().toISOString()),
      $updated_date: String(game.updated_date ?? new Date().toISOString()),
      $type:         String(game.type ?? 'game'),
      $tags:         JSON.stringify(game.tags ?? []),
      $nsfw:         game.nsfw ? 1 : 0,
      $drm:          game.drm ? 1 : 0,
      $dlc:          JSON.stringify(game.dlc ?? {}),
      $header_image: String(game.header_image ?? ''),
      $genres:       JSON.stringify(genres ?? []),
      $platforms:    JSON.stringify(platforms ?? []),
    });

    // Sync FTS index manually (triggers were dropped for sql.js compat)
    const appid = String(game.appid ?? '');
    const name = String(game.name ?? '');
    try {
      _db.run("DELETE FROM games_fts WHERE rowid IN (SELECT rowid FROM games WHERE appid = $appid)", { $appid: appid });
      _db.run("INSERT INTO games_fts(rowid, name) SELECT rowid, $name FROM games WHERE appid = $appid", { $appid: appid, $name: name });
    } catch (_ftsErr) {
      // FTS sync is best-effort
    }

    return true;
  } catch (err) {
    console.error('[DB] upsertGame error:', err.message, 'for appid:', game.appid);
    return false;
  } finally {
    stmt.free();
  }
}

/**
 * Insert multiple games in a single transaction.
 */
function upsertGames(games) {
  ensureInit();
  let count = 0;
  try {
    _db.run('BEGIN TRANSACTION');
    for (const g of games) {
      if (upsertGame(g)) count++;
    }
    _db.run('COMMIT');
  } catch (err) {
    _db.run('ROLLBACK');
    console.error('[DB] upsertGames transaction error:', err.message);
  }
  return count;
}

/**
 * Update the header_image for a game.
 */
function updateGameCover(appid, headerImage) {
  ensureInit();
  try {
    _db.run('UPDATE games SET header_image = $image, updated_date = $now WHERE appid = $appid', {
      $appid: String(appid),
      $image: String(headerImage),
      $now: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('[DB] updateGameCover error:', err.message);
    return false;
  }
}

/**
 * Persist the database to disk.
 * Called after write operations to save changes.
 * Returns the path to the saved file.
 */
function persist() {
  ensureInit();
  const data = _db.export();
  const buffer = Buffer.from(data);
  const destPath = path.join(findDbDir(), DB_FILENAME);
  // Atomic write: a crash/power-loss mid-write to the live 54 MB games.db would
  // truncate it and make the whole catalogue fail to load on next launch. Write to
  // a temp file and rename (rename is atomic on the same volume).
  const tmpPath = destPath + '.tmp';
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, destPath);
  console.log('[DB] Persisted to disk:', destPath, `(${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
  return destPath;
}

// ═══════════════════════════════════════════════════════════════════════════
// Fixes Queries
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all fixes (for backward compatibility).
 */
function getAllFixes() {
  ensureInit();
  if (!_fixesDb) return [];
  const rows = _fixesDb.exec('SELECT * FROM fixes ORDER BY name COLLATE NOCASE ASC');
  return parseFixRows(rows);
}

function parseFixRows(rows) {
  if (!rows || rows.length === 0) return [];
  const result = rows[0];
  if (!result || !result.values || result.values.length === 0) return [];
  const cols = result.columns;
  return result.values.map(rowValues => {
    const f = {};
    for (let i = 0; i < cols.length; i++) {
      f[cols[i]] = rowValues[i];
    }
    try { f.badges = JSON.parse(f.badges || '[]'); } catch { f.badges = []; }
    try { f.download_urls = JSON.parse(f.download_urls || '[]'); } catch { f.download_urls = []; }
    try { f.versions = JSON.parse(f.versions || '[]'); } catch { f.versions = []; }
    return f;
  });
}

/**
 * Get a fix by appid.
 */
function getFix(appid) {
  ensureInit();
  if (!_fixesDb) return null;
  const rows = _fixesDb.exec('SELECT * FROM fixes WHERE appid = $appid', { $appid: String(appid) });
  const parsed = parseFixRows(rows);
  return parsed.length > 0 ? parsed[0] : null;
}

/**
 * Get fix count.
 */
function getFixCount() {
  ensureInit();
  if (!_fixesDb) return 0;
  const result = _fixesDb.exec('SELECT COUNT(*) as cnt FROM fixes');
  return result.length > 0 ? result[0].values[0][0] : 0;
}

/**
 * Search fixes by name.
 */
function searchFixes(query) {
  ensureInit();
  if (!_fixesDb) return [];
  const q = `%${escapeLike(query)}%`;
  const rows = _fixesDb.exec(
    'SELECT * FROM fixes WHERE name LIKE $query ESCAPE \'\\\' ORDER BY name COLLATE NOCASE ASC LIMIT 50',
    { $query: q }
  );
  return parseFixRows(rows);
}

/**
 * Insert or replace a single fix in the fixes database.
 * @param {object} fix - Fix object with at minimum { appid, name }
 * @returns {boolean} success
 */
function upsertFix(fix) {
  ensureInit();
  if (!_fixesDb) return false;

  try {
    _fixesDb.run(`
      INSERT OR REPLACE INTO fixes
        (appid, name, badges, fix_count, source, download_url, game_url, download_urls, filename, versions)
      VALUES
        ($appid, $name, $badges, $fix_count, $source, $download_url, $game_url, $download_urls, $filename, $versions)
    `, {
      $appid:         String(fix.appid ?? ''),
      $name:          String(fix.name ?? ''),
      $badges:        JSON.stringify(fix.badges ?? []),
      $fix_count:     fix.fix_count ?? (fix.download_url ? 1 : 0),
      $source:        String(fix.source ?? ''),
      $download_url:  String(fix.download_url ?? ''),
      $game_url:      String(fix.game_url ?? ''),
      $download_urls: JSON.stringify(fix.download_urls ?? []),
      $filename:      String(fix.filename ?? ''),
      $versions:      JSON.stringify(fix.versions ?? []),
    });
    return true;
  } catch (err) {
    console.error('[DB] upsertFix error:', err.message, 'for appid:', fix.appid);
    return false;
  }
}

/**
 * Insert multiple fixes in a single transaction.
 * @param {object[]} fixes - Array of fix objects
 * @returns {number} count of successful inserts
 */
function upsertFixes(fixes) {
  ensureInit();
  if (!_fixesDb || !fixes || fixes.length === 0) return 0;
  let count = 0;
  try {
    _fixesDb.run('BEGIN TRANSACTION');
    for (const f of fixes) {
      if (upsertFix(f)) count++;
    }
    _fixesDb.run('COMMIT');
  } catch (err) {
    _fixesDb.run('ROLLBACK');
    console.error('[DB] upsertFixes transaction error:', err.message);
  }
  return count;
}

/**
 * Persist the fixes database to disk.
 * @returns {string|null} path to saved file, or null on failure
 */
function persistFixes() {
  ensureInit();
  if (!_fixesDb) return null;
  const data = _fixesDb.export();
  const buffer = Buffer.from(data);
  const destPath = findFixesDbPath();
  try {
    // Atomic write (tmp + rename) — never truncate the live fixes.db on a crash.
    const tmpPath = destPath + '.tmp';
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, destPath);
    console.log('[DB] Fixes DB persisted to disk:', destPath, `(${(buffer.length / 1024).toFixed(0)} KB)`);
    return destPath;
  } catch (err) {
    console.error('[DB] persistFixes error:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Full-Text Search
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full-text search using FTS5 virtual table (games_fts) with LIKE fallback.
 * Tries FTS5 MATCH first; if FTS table doesn't exist or query fails,
 * falls back to LIKE-based name search.
 *
 * @param {string} query  - Search query text
 * @param {number} [limit=50] - Maximum results
 * @returns {object[]} Array of full game objects
 */
function searchGamesFTS(query, limit = 50) {
  ensureInit();
  if (!query || String(query).trim() === '') return [];
  const q = String(query).trim();

  try {
    // Attempt FTS5 search
    const rows = _db.exec(
      `SELECT g.* FROM games_fts f JOIN games g ON g.rowid = f.rowid WHERE games_fts MATCH $query ORDER BY rank LIMIT $limit`,
      { $query: q, $limit: limit }
    );
    return parseGameRows(rows);
  } catch (_ftsErr) {
    // FTS table missing or MATCH failed — fall back to LIKE
    const likeQ = `%${escapeLike(q)}%`;
    const rows = _db.exec(
      `SELECT * FROM games WHERE name LIKE $query ESCAPE '\\' ORDER BY name COLLATE NOCASE ASC LIMIT $limit`,
      { $query: likeQ, $limit: limit }
    );
    return parseGameRows(rows);
  }
}

/**
 * Prefix-based search for autocomplete suggestions.
 * Uses LIKE with the query as a prefix (query + '%').
 *
 * @param {string} query  - Prefix query text
 * @param {number} [limit=10] - Maximum suggestions
 * @returns {object[]} Array of { appid, name, header_image } sorted by name
 */
function getSearchSuggestions(query, limit = 10) {
  ensureInit();
  if (!query || String(query).trim() === '') return [];
  const q = `${escapeLike(String(query).trim())}%`;

  const rows = _db.exec(
    `SELECT appid, name, header_image FROM games WHERE name LIKE $query ESCAPE '\\' ORDER BY name COLLATE NOCASE ASC LIMIT $limit`,
    { $query: q, $limit: limit }
  );

  if (!rows || rows.length === 0) return [];
  const result = rows[0];
  if (!result || !result.values || result.values.length === 0) return [];
  const cols = result.columns;
  return result.values.map(rowValues => {
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = rowValues[i];
    return obj;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Browse / Filter
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Filter games by one or more types.
 * Supports the same pagination / search / sort options as queryGames().
 *
 * @param {string[]} typeList - Array of type values to include (e.g. ['game', 'DLC'])
 * @param {object}  [opts={}] - Same options as queryGames: page, limit, search, sort, platform
 * @returns {{ games: object[], total: number, page: number, pageSize: number }}
 */
function getGamesByType(typeList, opts = {}) {
  ensureInit();
  if (!typeList || typeList.length === 0) {
    return queryGames(opts);
  }

  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, opts.limit || PAGE_SIZE));
  const offset = (page - 1) * limit;

  // Build type IN clause placeholders
  const typePlaceholders = typeList.map((_, i) => `$type_${i}`);
  const typeParams = {};
  typeList.forEach((t, i) => { typeParams[`$type_${i}`] = t; });
  const typeClause = `type IN (${typePlaceholders.join(',')})`;

  // Strip type from opts to avoid conflict with explicit typeList
  const filteredOpts = { ...opts };
  delete filteredOpts.type;

  // Get search / platform filters from shared helper
  const { where, params } = buildGameQuery(filteredOpts);

  // Combine WHERE clauses
  let combinedWhere;
  if (where) {
    combinedWhere = `WHERE ${typeClause} AND ${where.slice(6)}`;
  } else {
    combinedWhere = `WHERE ${typeClause}`;
  }

  const mergedParams = { ...typeParams, ...params };

  // Build sort clause
  let orderBy;
  switch (opts.sort) {
    case 'name_desc':  orderBy = 'ORDER BY name DESC'; break;
    case 'added':      orderBy = 'ORDER BY added_date DESC'; break;
    case 'added_asc':  orderBy = 'ORDER BY added_date ASC'; break;
    case 'name_asc':
    default:           orderBy = 'ORDER BY name COLLATE NOCASE ASC'; break;
  }

  // Count total matching
  const countSql = `SELECT COUNT(*) as cnt FROM games ${combinedWhere}`;
  const countResult = _db.exec(countSql, mergedParams);
  const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

  // Fetch page
  const pageSql = `SELECT * FROM games ${combinedWhere} ${orderBy} LIMIT $limit OFFSET $offset`;
  const pageParams = { ...mergedParams, $limit: limit, $offset: offset };
  const rows = _db.exec(pageSql, pageParams);

  const games = parseGameRows(rows);

  return { games, total, page, pageSize: limit };
}

/**
 * Get count of games per type, ordered by count descending.
 *
 * @returns {object[]} Array of { type, count }
 */
function getTypeCounts() {
  ensureInit();
  const rows = _db.exec('SELECT type, COUNT(*) as count FROM games GROUP BY type ORDER BY count DESC');

  if (!rows || rows.length === 0) return [];
  const result = rows[0];
  if (!result || !result.values || result.values.length === 0) return [];
  const cols = result.columns;
  return result.values.map(rowValues => {
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = rowValues[i];
    return obj;
  });
}

/**
 * Get games with empty or null header_image (missing cover art).
 *
 * @returns {object[]} Array of { appid, name }
 */
function getGamesNeedingCover() {
  ensureInit();
  const rows = _db.exec(
    "SELECT appid, name FROM games WHERE header_image IS NULL OR header_image = '' ORDER BY name"
  );

  if (!rows || rows.length === 0) return [];
  const result = rows[0];
  if (!result || !result.values || result.values.length === 0) return [];
  const cols = result.columns;
  return result.values.map(rowValues => {
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = rowValues[i];
    return obj;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Bulk / Maintenance
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Delete a single game by appid.
 *
 * @param {string|number} appid - Game appid to delete
 * @returns {boolean} True if the operation was attempted (sql.js run succeeded)
 */
function deleteGame(appid) {
  ensureInit();
  try {
    // Delete from FTS first (triggers dropped for sql.js compat)
    try {
      _db.run("DELETE FROM games_fts WHERE rowid IN (SELECT rowid FROM games WHERE appid = $appid)", { $appid: String(appid) });
    } catch { console.debug('[DB] FTS cleanup failed for appid:', appid); /* expected if FTS table absent */ }
    _db.run('DELETE FROM games WHERE appid = $appid', { $appid: String(appid) });
    return true;
  } catch (err) {
    console.error('[DB] deleteGame error:', err.message, 'for appid:', appid);
    return false;
  }
}

/**
 * Delete multiple games by appid in a single transaction.
 *
 * @param {string[]|number[]} appids - Array of appids to delete
 * @returns {number} Count of items passed for deletion
 */
function deleteGames(appids) {
  ensureInit();
  if (!appids || appids.length === 0) return 0;

  let count = 0;
  try {
    _db.run('BEGIN TRANSACTION');
    for (const id of appids) {
      const sid = String(id);
      // Delete from FTS first (triggers dropped for sql.js compat)
      try { _db.run("DELETE FROM games_fts WHERE rowid IN (SELECT rowid FROM games WHERE appid = $appid)", { $appid: sid }); } catch { /* expected if FTS table absent */ }
      _db.run('DELETE FROM games WHERE appid = $appid', { $appid: sid });
      count++;
    }
    _db.run('COMMIT');
  } catch (err) {
    _db.run('ROLLBACK');
    console.error('[DB] deleteGames transaction error:', err.message);
  }
  return count;
}

/**
 * Get most recently updated games.
 *
 * @param {number} [limit=100] - Maximum results
 * @returns {object[]} Array of full game objects ordered by updated_date DESC
 */
function getRecentUpdates(limit = 100) {
  ensureInit();
  const rows = _db.exec(
    'SELECT * FROM games ORDER BY updated_date DESC LIMIT $limit',
    { $limit: limit }
  );
  return parseGameRows(rows);
}

/**
 * Get game count per platform.
 * Platforms are stored as JSON array strings; uses LIKE matching for known values.
 *
 * @returns {object[]} Array of { platform, count }
 */
function getGameCountByPlatform() {
  ensureInit();
  const knownPlatforms = ['windows', 'mac', 'linux'];
  return knownPlatforms.map(platform => {
    const rows = _db.exec(
      'SELECT COUNT(*) as cnt FROM games WHERE platforms LIKE $platform',
      { $platform: `%"${platform}"%` }
    );
    const count = rows.length > 0 ? rows[0].values[0][0] : 0;
    return { platform, count };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Fixes — Extended Queries
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get fix count grouped by source.
 *
 * @returns {object[]} Array of { source, count } ordered by count DESC
 */
function getFixCountBySource() {
  ensureInit();
  if (!_fixesDb) return [];

  const rows = _fixesDb.exec('SELECT source, COUNT(*) as count FROM fixes GROUP BY source ORDER BY count DESC');

  if (!rows || rows.length === 0) return [];
  const result = rows[0];
  if (!result || !result.values || result.values.length === 0) return [];
  const cols = result.columns;
  return result.values.map(rowValues => {
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = rowValues[i];
    return obj;
  });
}

/**
 * Full-text search for fixes using FTS5 (fixes_fts) with LIKE fallback.
 *
 * @param {string} query  - Search query
 * @param {number} [limit=50] - Maximum results
 * @returns {object[]} Array of fix objects
 */
function searchFixesFTS(query, limit = 50) {
  ensureInit();
  if (!_fixesDb) return [];
  if (!query || String(query).trim() === '') return [];

  try {
    // Attempt FTS5 search
    const rows = _fixesDb.exec(
      `SELECT f.* FROM fixes_fts ft JOIN fixes f ON f.rowid = ft.rowid WHERE fixes_fts MATCH $query ORDER BY rank LIMIT $limit`,
      { $query: String(query).trim(), $limit: limit }
    );
    return parseFixRows(rows);
  } catch (_ftsErr) {
    // FTS table missing — fall back to LIKE
    const q = `%${escapeLike(query)}%`;
    const rows = _fixesDb.exec(
      `SELECT * FROM fixes WHERE name LIKE $query ESCAPE '\\' ORDER BY name COLLATE NOCASE ASC LIMIT $limit`,
      { $query: q, $limit: limit }
    );
    return parseFixRows(rows);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Schema
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the current schema version from the _schema_version table.
 * Returns 0 if the table does not exist or has no rows.
 *
 * @returns {number} Schema version number
 */
function getSchemaVersion() {
  ensureInit();
  try {
    const result = _db.exec('SELECT version FROM _schema_version ORDER BY version DESC LIMIT 1');
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0];
    }
  } catch (_err) {
    // Table does not exist
  }
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════════════════════════════════════

function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
  if (_fixesDb) {
    _fixesDb.close();
    _fixesDb = null;
  }
  _initialized = false;
  console.log('[DB] Databases closed');
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // Lifecycle
  initialize,
  close,
  persist,

  // Game queries
  queryGames,
  batchQueryGames,
  queryGameRange,
  getAllGames,
  getGameCount,
  getGame,
  batchGetGameDetails,
  getGamesMeta,
  getAllGameIds,
  getAllAppidsMap,
  gameExists,

  // Search
  searchGamesFTS,
  getSearchSuggestions,

  // Browse / Filter
  getGamesByType,
  getTypeCounts,
  getGamesNeedingCover,

  // Bulk / Maintenance
  upsertGame,
  upsertGames,
  updateGameCover,
  deleteGame,
  deleteGames,
  getRecentUpdates,
  getGameCountByPlatform,

  // Fixes
  getAllFixes,
  getFix,
  getFixCount,
  searchFixes,
  searchFixesFTS,
  getFixCountBySource,
  upsertFix,
  upsertFixes,
  persistFixes,

  // Schema
  getSchemaVersion,
};
