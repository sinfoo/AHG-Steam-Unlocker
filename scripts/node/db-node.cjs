/**
 * db-node.cjs — Node.js SQLite helper for AHG Unlocker pipeline scripts.
 *
 * Wraps sql.js to provide the same query/upsert interface as _path_utils.py
 * but from Node.js. Reads games.db and fixes.db from the project root.
 *
 * Usage:
 *   const { openDb } = require('./db-node.cjs');
 *   const db = await openDb();
 *   const allGames = db.getAllGames();
 *   const allFixes  = db.getAllFixes();
 *   db.updateGame('123', 'header_image', 'https://...');
 *   db.insertGame({ appid: '456', name: 'Game', header_image: '...' });
 *   await db.saveGames();   // persist games.db
 *   await db.saveFixes();   // persist fixes.db
 *   db.close();
 *
 * Multiple updates are batched into a single transaction for speed.
 * Call saveGames() once after all mutations are done.
 */

const initSqlJs = require('sql.js');
const fs   = require('fs');
const path = require('path');

// DB files live at project root alongside games.json / fixes.json
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const GAMES_DB     = path.join(PROJECT_ROOT, 'games.db');
const FIXES_DB     = path.join(PROJECT_ROOT, 'fixes.db');

// ── helpers ──────────────────────────────────────────────────────────────────

/** Convert a sql.js result (columns + values) to an array of plain objects. */
function rowsToObjects(result) {
  if (!result || !result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = row[i];
    }
    return obj;
  });
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Open both databases and return a handle with convenience methods.
 *
 * @returns {Promise<{getAllGames, getAllFixes, getGame, getFix, updateGame,
 *                    insertGame, upsertGame, saveGames, saveFixes, close}>}
 */
async function openDb() {
  const SQL = await initSqlJs();

  // Load DB files into memory
  const gamesBuffer = fs.readFileSync(GAMES_DB);
  const fixesBuffer = fs.readFileSync(FIXES_DB);
  const db    = new SQL.Database(gamesBuffer);
  const fDb   = new SQL.Database(fixesBuffer);

  // ── games ──

  /** Return all rows from the games table as an array of plain objects. */
  function getAllGames() {
    return rowsToObjects(db.exec(
      'SELECT appid, name, added_date, updated_date, type, tags, nsfw, drm, dlc, header_image, genres, platforms FROM games'
    ));
  }

  /** Return a single game by appid, or undefined. */
  function getGame(appid) {
    const rows = rowsToObjects(db.exec(
      'SELECT * FROM games WHERE appid = ?', [appid]
    ));
    return rows.length ? rows[0] : undefined;
  }

  /** Update a single field on a game row. */
  function updateGame(appid, field, value) {
    const allowed = [
      'name', 'added_date', 'updated_date', 'type', 'tags',
      'nsfw', 'drm', 'dlc', 'header_image', 'genres', 'platforms',
    ];
    if (!allowed.includes(field)) {
      throw new Error(`updateGame: field "${field}" is not allowed`);
    }
    const sql = `UPDATE games SET ${field} = ?, updated_date = datetime('now') WHERE appid = ?`;
    db.run(sql, [value, appid]);
  }

  /** Insert a new game row (fails if appid already exists). */
  function insertGame(game) {
    const { appid, name, header_image, type, tags, nsfw, drm, dlc, added_date, updated_date, genres, platforms } = game;
    db.run(
      `INSERT INTO games (appid, name, header_image, type, tags, nsfw, drm, dlc, added_date, updated_date, genres, platforms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appid ?? '',
        name ?? '',
        header_image ?? '',
        type ?? 'game',
        JSON.stringify(tags ?? []),
        nsfw ? 1 : 0,
        drm ? 1 : 0,
        JSON.stringify(dlc ?? {}),
        added_date ?? new Date().toISOString(),
        updated_date ?? new Date().toISOString(),
        JSON.stringify(genres ?? []),
        JSON.stringify(platforms ?? []),
      ]
    );
  }

  /**
   * Insert or replace a game row. Use for bulk sync operations
   * where you want to fully overwrite existing rows.
   */
  function upsertGame(game) {
    const { appid, name, header_image, type, tags, nsfw, drm, dlc, added_date, updated_date, genres, platforms } = game;
    db.run(
      `INSERT OR REPLACE INTO games
         (appid, name, header_image, type, tags, nsfw, drm, dlc, added_date, updated_date, genres, platforms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appid ?? '',
        name ?? '',
        header_image ?? '',
        type ?? 'game',
        JSON.stringify(tags ?? []),
        nsfw ? 1 : 0,
        drm ? 1 : 0,
        JSON.stringify(dlc ?? {}),
        added_date ?? new Date().toISOString(),
        updated_date ?? new Date().toISOString(),
        JSON.stringify(genres ?? []),
        JSON.stringify(platforms ?? []),
      ]
    );
  }

  /** Persist the in-memory games.db to disk. */
  function saveGames() {
    const buffer = db.export();
    fs.writeFileSync(GAMES_DB, Buffer.from(buffer));
  }

  // ── fixes ──

  /** Return all rows from the fixes table as an array of plain objects. */
  function getAllFixes() {
    return rowsToObjects(fDb.exec(
      'SELECT appid, name, badges, fix_count, source, download_url, game_url, download_urls, filename, versions FROM fixes'
    ));
  }

  /** Return a single fix by appid, or undefined. */
  function getFix(appid) {
    const rows = rowsToObjects(fDb.exec(
      'SELECT * FROM fixes WHERE appid = ?', [appid]
    ));
    return rows.length ? rows[0] : undefined;
  }

  /** Update a single field on a fix row. */
  function updateFix(appid, field, value) {
    const allowed = [
      'name', 'badges', 'fix_count', 'source',
      'download_url', 'game_url', 'download_urls', 'filename', 'versions',
    ];
    if (!allowed.includes(field)) {
      throw new Error(`updateFix: field "${field}" is not allowed`);
    }
    fDb.run(`UPDATE fixes SET ${field} = ? WHERE appid = ?`, [value, appid]);
  }

  /** Insert a new fix row. */
  function insertFix(fix) {
    const { appid, name, badges, fix_count, source, download_url, game_url, download_urls, filename, versions } = fix;
    fDb.run(
      `INSERT INTO fixes (appid, name, badges, fix_count, source, download_url, game_url, download_urls, filename, versions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appid ?? '',
        name ?? '',
        JSON.stringify(badges ?? []),
        fix_count ?? 0,
        source ?? '',
        download_url ?? '',
        game_url ?? '',
        JSON.stringify(download_urls ?? []),
        filename ?? '',
        JSON.stringify(versions ?? []),
      ]
    );
  }

  /** Persist the in-memory fixes.db to disk. */
  function saveFixes() {
    const buffer = fDb.export();
    fs.writeFileSync(FIXES_DB, Buffer.from(buffer));
  }

  // ── lifecycle ──

  /** Close both databases. Call after saveGames() / saveFixes(). */
  function close() {
    db.close();
    fDb.close();
  }

  return {
    getAllGames, getGame, updateGame, insertGame, upsertGame, saveGames,
    getAllFixes, getFix, updateFix, insertFix, saveFixes,
    close,
  };
}

module.exports = { openDb };
