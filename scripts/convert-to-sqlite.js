#!/usr/bin/env node
/**
 * convert-to-sqlite.js
 *
 * Build-time conversion of games.json → games.db and fixes.json → fixes.db.
 * Produces ready-to-bundle SQLite databases with full-text search, indexes,
 * and schema versioning.
 *
 * Usage:  node scripts/convert-to-sqlite.js
 *
 * Features:
 *  - Streaming JSON array parser — never loads the full 44MB games.json into
 *    memory. Uses a character-level state machine over fs.createReadStream.
 *  - FTS4 full-text search virtual table (FTS5 requires a custom sql.js build;
 *    this project ships with the default build which lacks FTS5 but supports
 *    FTS4 with the same MATCH query interface).
 *  - Schema versioning via _schema_version table.
 *  - Batch INSERT transactions (5000 rows per batch).
 *  - INSERT OR REPLACE for safe duplicate handling.
 *  - Detailed progress logging every 10 000 rows.
 *  - Edge-case hardened: missing fields, null values, empty arrays, unicode.
 *
 * Output: games.db, fixes.db in the project root.
 */

const path = require('path');
const fs = require('fs');

// sql.js — pure-JS SQLite via Emscripten (WASM, no native modules)
const initSqlJs = require('sql.js');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BATCH_SIZE = 5000;
const PROGRESS_INTERVAL = 10_000;

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('[convert-to-sqlite] Starting conversion...');

  const SQL = await initSqlJs();
  console.log('[convert-to-sqlite] sql.js initialised');

  await convertGames(SQL);
  await convertFixes(SQL);

  console.log('[convert-to-sqlite] ✓ Done');
}

// ─── Streaming JSON Array Parser ────────────────────────────────────────────

/**
 * Stream a JSON array file element-by-element without loading the whole file
 * into memory.
 *
 * Handles both single-line arrays (games.json: 44 MB, 1 line, 177 K entries)
 * and multi-line pretty-printed arrays (fixes.json).
 *
 * Uses a character-level state machine that tracks:
 *  – brace depth (nested objects)
 *  – string boundaries (so braces inside strings are ignored)
 *  – escape sequences
 *
 * Every time a complete top-level object is detected it is parsed with
 * JSON.parse and forwarded to the `onObject` callback.
 *
 * @param {string}  filePath   – path to the JSON array file
 * @param {function} onObject   – called once per array element
 * @returns {Promise<number>}   – total number of objects parsed
 */
function streamJsonArray(filePath, onObject) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, {
      encoding: 'utf8',
      highWaterMark: 256 * 1024,         // 256 KB per chunk
    });

    let remainder = '';     // unprocessed bytes carried between chunks
    let depth = 0;          // current { } nesting depth (0 = outside object)
    let inString = false;   // currently inside a "…" string
    let escaped = false;    // previous char was a backslash
    let objStart = -1;      // index of the opening { of the current object
    let objCount = 0;       // total parsed objects
    let pos = 0;            // current processing position within remainder

    function processChunk() {
      while (pos < remainder.length) {
        const ch = remainder[pos];

        // ── Escape handling ──────────────────────────────────────────
        if (escaped) {
          escaped = false;
          pos++;
          continue;
        }

        if (ch === '\\' && inString) {
          escaped = true;
          pos++;
          continue;
        }

        // ── Toggle string mode ───────────────────────────────────────
        if (ch === '"') {
          inString = !inString;
          pos++;
          continue;
        }

        // ── Structural characters (only meaningful outside strings) ──
        if (!inString) {
          if (ch === '{') {
            if (depth === 0) objStart = pos;
            depth++;
            pos++;
            continue;
          }

          if (ch === '}') {
            depth--;
            if (depth === 0 && objStart >= 0) {
              // Complete top-level object found
              const objStr = remainder.slice(objStart, pos + 1);
              try {
                onObject(JSON.parse(objStr));
                objCount++;
              } catch (_) {
                // Skip malformed objects
              }
              // Remove the extracted object from remainder
              remainder = remainder.slice(pos + 1);
              objStart = -1;
              pos = 0;   // restart because we sliced remainder
              continue;
            }
            pos++;
            continue;
          }

          if (ch === ']' && depth === 0) {
            // End of array — consume the rest
            remainder = '';
            pos = 0;
            return true;
          }
        }

        pos++;
      }
      // ── End of processing for this chunk ──────────────────────────
      // State (depth, inString, escaped, objStart) persists naturally.
      // remainder persists naturally.
      // pos stays at remainder.length — next chunk data will extend it.
      return false;
    }

    stream.on('data', (chunk) => {
      remainder += chunk;
      processChunk();
    });

    stream.on('end', () => {
      if (pos < remainder.length) processChunk();
      resolve(objCount);
    });

    stream.on('error', reject);
  });
}

// ─── Games ──────────────────────────────────────────────────────────────────

async function convertGames(SQL) {
  const gamesPath = path.join(PROJECT_ROOT, 'games.json');
  if (!fs.existsSync(gamesPath)) {
    console.log('[convert-to-sqlite] SKIP games.json — file not found');
    return;
  }

  const db = new SQL.Database();

  // ── Performance pragmas ────────────────────────────────────────────
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA synchronous=NORMAL');
  db.run('PRAGMA cache_size=-64000');   // 64 MB page cache

  // ── Games table ───────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      appid        TEXT PRIMARY KEY,
      name         TEXT DEFAULT '',
      added_date   TEXT DEFAULT '',
      updated_date TEXT DEFAULT '',
      type         TEXT DEFAULT '',
      tags         TEXT DEFAULT '[]',
      nsfw         INTEGER DEFAULT 0,
      drm          INTEGER DEFAULT 0,
      dlc          TEXT DEFAULT '{}',
      header_image TEXT DEFAULT '',
      genres       TEXT DEFAULT '[]',
      platforms    TEXT DEFAULT '[]'
    )
  `);

  // ── Indexes ───────────────────────────────────────────────────────
  db.run('CREATE INDEX IF NOT EXISTS idx_games_name  ON games(name COLLATE NOCASE)');
  db.run('CREATE INDEX IF NOT EXISTS idx_games_added ON games(added_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_games_type  ON games(type)');
  db.run('CREATE INDEX IF NOT EXISTS idx_games_nsfw  ON games(nsfw)');
  db.run('CREATE INDEX IF NOT EXISTS idx_games_drm   ON games(drm)');

  // ── FTS4 virtual table for full-text search ───────────────────────
  // NOTE: FTS5 is not available in the default sql.js WASM build.
  //       FTS4 offers the same MATCH query interface and external-content
  //       support. Upgrade to FTS5 if a custom sql.js build is ever
  //       introduced.
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS games_fts USING fts4(
      name,
      content='games'
    )
  `);

  // ── Triggers to keep FTS index in sync ────────────────────────────
  db.run(`
    CREATE TRIGGER IF NOT EXISTS games_ai AFTER INSERT ON games BEGIN
      INSERT INTO games_fts(rowid, name) VALUES (new.rowid, new.name);
    END
  `);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS games_ad AFTER DELETE ON games BEGIN
      INSERT INTO games_fts(games_fts, rowid, name)
      VALUES ('delete', old.rowid, old.name);
    END
  `);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS games_au AFTER UPDATE OF name ON games BEGIN
      INSERT INTO games_fts(games_fts, rowid, name)
      VALUES ('delete', old.rowid, old.name);
      INSERT INTO games_fts(rowid, name) VALUES (new.rowid, new.name);
    END
  `);

  // ── Schema versioning ─────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS _schema_version (
      version    INTEGER,
      applied_at TEXT
    )
  `);
  db.run("INSERT INTO _schema_version VALUES (1, datetime('now'))");

  // ── Prepared insert ───────────────────────────────────────────────
  const insert = db.prepare(`
    INSERT OR REPLACE INTO games
      (appid, name, added_date, updated_date,
       type, tags, nsfw, drm, dlc, header_image, genres, platforms)
    VALUES
      ($appid, $name, $added_date, $updated_date,
       $type, $tags, $nsfw, $drm, $dlc, $header_image, $genres, $platforms)
  `);

  // ── Stream + batch-insert ─────────────────────────────────────────
  console.log('[convert-to-sqlite] Streaming games.json...');
  let totalParsed = 0;
  let inserted   = 0;
  let batch      = [];

  totalParsed = await streamJsonArray(gamesPath, (game) => {
    batch.push(game);

    if (batch.length >= BATCH_SIZE) {
      flushBatch(insert, db, batch);
      inserted += batch.length;
      batch = [];

      if (inserted % PROGRESS_INTERVAL === 0) {
        console.log(`[convert-to-sqlite] games progress: ${inserted} rows`);
      }
    }
  });

  // Final partial batch
  if (batch.length > 0) {
    flushBatch(insert, db, batch);
    inserted += batch.length;
  }

  insert.free();

  // ── Verify ────────────────────────────────────────────────────────
  const [{ values: [[totalStored]] }] = db.exec('SELECT COUNT(*) FROM games');
  console.log(
    `[convert-to-sqlite] games: parsed ${totalParsed}, inserted ${inserted}, stored ${totalStored}`
  );

  // ── Write to disk ─────────────────────────────────────────────────
  const dbPath = path.join(PROJECT_ROOT, 'games.db');
  const buf = Buffer.from(db.export());
  fs.writeFileSync(dbPath, buf);
  console.log(
    `[convert-to-sqlite] ✓ Written ${(buf.length / 1024 / 1024).toFixed(1)} MB → games.db`
  );

  db.close();
}

// ─── Fixes ──────────────────────────────────────────────────────────────────

async function convertFixes(SQL) {
  const fixesPath = path.join(PROJECT_ROOT, 'fixes.json');
  if (!fs.existsSync(fixesPath)) {
    console.log('[convert-to-sqlite] SKIP fixes.json — file not found');
    return;
  }

  const db = new SQL.Database();
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA synchronous=NORMAL');
  db.run('PRAGMA cache_size=-64000');

  // ── Fixes table ───────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS fixes (
      appid         TEXT,
      name          TEXT DEFAULT '',
      badges        TEXT DEFAULT '[]',
      fix_count     INTEGER DEFAULT 0,
      source        TEXT DEFAULT '',
      download_url  TEXT DEFAULT '',
      game_url      TEXT DEFAULT '',
      download_urls TEXT DEFAULT '[]',
      filename      TEXT DEFAULT '',
      versions      TEXT DEFAULT '[]',
      PRIMARY KEY (appid)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_fixes_name ON fixes(name COLLATE NOCASE)');

  // ── Schema versioning ─────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS _schema_version (
      version    INTEGER,
      applied_at TEXT
    )
  `);
  db.run("INSERT INTO _schema_version VALUES (1, datetime('now'))");

  // ── Prepared insert ───────────────────────────────────────────────
  const insert = db.prepare(`
    INSERT OR REPLACE INTO fixes
      (appid, name, badges, fix_count,
       source, download_url, game_url, download_urls, filename, versions)
    VALUES
      ($appid, $name, $badges, $fix_count,
       $source, $download_url, $game_url, $download_urls, $filename, $versions)
  `);

  // ── Stream + batch-insert ─────────────────────────────────────────
  console.log('[convert-to-sqlite] Streaming fixes.json...');
  let totalParsed = 0;
  let inserted    = 0;
  let batch       = [];

  totalParsed = await streamJsonArray(fixesPath, (fix) => {
    batch.push(fix);

    if (batch.length >= BATCH_SIZE) {
      flushFixesBatch(insert, db, batch);
      inserted += batch.length;
      batch = [];
      console.log(`[convert-to-sqlite] fixes progress: ${inserted} rows`);
    }
  });

  if (batch.length > 0) {
    flushFixesBatch(insert, db, batch);
    inserted += batch.length;
  }

  insert.free();

  // ── Verify ────────────────────────────────────────────────────────
  const [{ values: [[totalStored]] }] = db.exec('SELECT COUNT(*) FROM fixes');
  console.log(
    `[convert-to-sqlite] fixes: parsed ${totalParsed}, inserted ${inserted}, stored ${totalStored}`
  );

  // ── Write to disk ─────────────────────────────────────────────────
  const dbPath = path.join(PROJECT_ROOT, 'fixes.db');
  const buf = Buffer.from(db.export());
  fs.writeFileSync(dbPath, buf);
  console.log(
    `[convert-to-sqlite] ✓ Written ${(buf.length / 1024).toFixed(0)} KB → fixes.db`
  );

  db.close();
}

// ─── Batch Helpers ──────────────────────────────────────────────────────────

/**
 * Flush a batch of game objects into the database inside a single transaction.
 */
function flushBatch(insert, db, batch) {
  db.run('BEGIN TRANSACTION');
  for (const g of batch) {
    insert.run({
      $appid:        String(g.appid ?? ''),
      $name:         String(g.name ?? ''),
      $added_date:   String(g.added_date ?? ''),
      $updated_date: String(g.updated_date ?? ''),
      $type:         String(g.type ?? ''),
      $tags:         JSON.stringify(g.tags ?? []),
      $nsfw:         g.nsfw ? 1 : 0,
      $drm:          g.drm ? 1 : 0,
      $dlc:          JSON.stringify(g.dlc ?? {}),
      $header_image: String(g.header_image ?? ''),
      $genres:       JSON.stringify(g.genres ?? []),
      $platforms:    JSON.stringify(g.platforms ?? []),
    });
  }
  db.run('COMMIT');
}

/**
 * Flush a batch of fix objects into the database inside a single transaction.
 */
function flushFixesBatch(insert, db, batch) {
  db.run('BEGIN TRANSACTION');
  for (const f of batch) {
    insert.run({
      $appid:         String(f.appid ?? ''),
      $name:          String(f.name ?? ''),
      $badges:        JSON.stringify(f.badges ?? []),
      $fix_count:     f.fix_count ?? (f.download_url ? 1 : 0),
      $source:        String(f.source ?? ''),
      $download_url:  String(f.download_url ?? ''),
      $game_url:      String(f.game_url ?? ''),
      $download_urls: JSON.stringify(f.download_urls ?? []),
      $filename:      String(f.filename ?? ''),
      $versions:      JSON.stringify(f.versions ?? []),
    });
  }
  db.run('COMMIT');
}

// ─── Entry Point ────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('[convert-to-sqlite] ERROR:', err);
  process.exit(1);
});
