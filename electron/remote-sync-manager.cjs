// ── Remote Sync Manager ──
// Fetches games.json + fixes.json from the remote Ryuu generator, diffs appids
// against the LOCAL SQLITE DBs (games.db / fixes.db) — the single source of truth —
// and returns the new + updated entries. The caller upserts them into the DBs.
//
// There is no longer any local games.json / fixes.json: the DBs are canonical and
// auto-update when AHG detects newly added Ryuu games. A tiny `.sync-state.json`
// marker stores each feed's Last-Modified value so we can send If-Modified-Since
// and get a cheap 304 when the remote hasn't changed (no 58MB re-download).
//
// Remote format (games.json):
//   [{ appid, name, added_date, updated_date, type, tags, nsfw, drm, dlc, header_image }]
// Remote format (fixes.json):
//   [{ appid, name, fixes: [{ href, filename, size, badges }] }]

const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const GAMES_URL = 'https://generator.ryuu.lol/files/games.json?auth_code=RYUUMANIFESTv78r6h';
const FIXES_URL = 'https://generator.ryuu.lol/files/fixes.json?auth_code=RYUUMANIFESTv78r6h';
const FETCH_TIMEOUT = 15000; // 15 seconds

let localDir = null; // set via init(dir) — where the .sync-state.json marker lives

function init(dir) {
  localDir = dir;
}

function getStatePath() {
  return path.join(localDir || '.', '.sync-state.json');
}

/** Read the persisted sync state ({ gamesLastModified, fixesLastModified }). */
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(getStatePath(), 'utf-8')) || {};
  } catch (_) {
    return {};
  }
}

/** Persist sync state (best-effort). */
function saveState(state) {
  try {
    fs.writeFileSync(getStatePath(), JSON.stringify(state));
  } catch (e) {
    console.warn('[REMOTE-SYNC] Failed to write sync state:', e.message);
  }
}

/**
 * Fetch a JSON payload via HTTPS GET, sending If-Modified-Since from the stored
 * Last-Modified value so an unchanged feed returns 304 (no re-download).
 * @param {string} url
 * @param {string} [lastModified] - stored Last-Modified header to revalidate against
 * @returns {Promise<{data: any|null, lastModified: string|null, notModified: boolean}>}
 */
function fetchJson(url, lastModified) {
  return new Promise((resolve, reject) => {
    // games.json is ~43 MB raw but ~4.5 MB gzipped, and the server never sends
    // Last-Modified for it (no 304s possible) — so every launch re-downloads it.
    // Node's https does not negotiate compression by itself; ask for gzip explicitly.
    const headers = { 'User-Agent': 'AHG/9.4', 'Accept-Encoding': 'gzip' };
    if (lastModified) headers['If-Modified-Since'] = lastModified;

    console.log('[REMOTE-SYNC] Fetching', url);
    https.get(url, { headers, timeout: FETCH_TIMEOUT }, (res) => {
      if (res.statusCode === 304) {
        console.log('[REMOTE-SYNC] 304 Not Modified —', url);
        res.resume();
        return resolve({ data: null, lastModified: lastModified || null, notModified: true });
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Remote returned ${res.statusCode} for ${url}`));
      }
      const newLastModified = res.headers['last-modified'] || null;
      const stream = res.headers['content-encoding'] === 'gzip' ? res.pipe(zlib.createGunzip()) : res;
      stream.on('error', (e) => reject(new Error(`Decompress error from ${url}: ${e.message}`)));
      let data = '';
      stream.on('data', c => data += c);
      stream.on('end', () => {
        try {
          resolve({ data: JSON.parse(data), lastModified: newLastModified, notModified: false });
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', reject)
      .on('timeout', function () { this.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
  });
}

/**
 * Normalise remote fixes format (per-game fixes[]) into flat entries
 * matching the fixes.db row shape.
 * @param {any[]} remoteFixes
 * @returns {any[]}
 */
function flattenRemoteFixes(remoteFixes) {
  if (!Array.isArray(remoteFixes)) return [];
  return remoteFixes.flatMap(game => {
    if (!game.fixes || !Array.isArray(game.fixes) || game.fixes.length === 0) {
      // Already flat — return as-is
      return [{
        appid: String(game.appid),
        name: game.name,
        badges: game.badges || [],
        fix_count: game.fix_count || 0,
        source: game.source || 'ryuu.lol',
        download_url: game.download_url || '',
        game_url: game.game_url || '',
      }];
    }
    // Remote format: each game has a fixes[] array
    return game.fixes.map(f => ({
      appid: String(game.appid),
      name: game.name,
      badges: f.badges || [],
      fix_count: game.fixes.length,
      source: 'ryuu.lol',
      download_url: f.href || '',
      game_url: '',
    }));
  });
}

/** Group flat fix rows by appid. */
function groupByApp(rows) {
  const m = new Map();
  for (const f of rows) {
    const k = String(f.appid);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(f);
  }
  return m;
}

/**
 * Main check: fetch remote, diff against the SQLite DBs, return new/updated entries.
 * The caller (main.cjs) upserts them into games.db / fixes.db and persists.
 *
 * @returns {Promise<{newGames, updatedGames, newFixes, updatedFixes, remoteGamesCount, remoteFixesCount, errors}>}
 */
async function checkForUpdates() {
  const errors = [];
  const state = loadState();
  let remoteGames = null;
  let remoteFixesRaw = null;
  let newGames = [];
  let updatedGames = [];
  let newFixes = [];
  let updatedFixes = [];

  const db = (() => {
    try { return require('./db.cjs'); } catch (e) {
      console.warn('[REMOTE-SYNC] db.cjs not available:', e.message);
      return null;
    }
  })();

  // ── Fetch remote games.json (304 = unchanged) ──
  try {
    const res = await fetchJson(GAMES_URL, state.gamesLastModified);
    if (!res.notModified) {
      remoteGames = res.data;
      state.gamesLastModified = res.lastModified || state.gamesLastModified;
      console.log('[REMOTE-SYNC] Fetched', remoteGames.length, 'remote games');
    }
  } catch (e) {
    errors.push(`games.json: ${e.message}`);
    console.warn('[REMOTE-SYNC] Games fetch failed:', e.message);
  }

  // ── Fetch remote fixes.json (304 = unchanged) ──
  try {
    const res = await fetchJson(FIXES_URL, state.fixesLastModified);
    if (!res.notModified) {
      remoteFixesRaw = res.data;
      state.fixesLastModified = res.lastModified || state.fixesLastModified;
    }
  } catch (e) {
    errors.push(`fixes.json: ${e.message}`);
    console.warn('[REMOTE-SYNC] Fixes fetch failed:', e.message);
  }

  // ── Diff games against games.db (new appids + entries with a newer updated_date) ──
  if (Array.isArray(remoteGames) && remoteGames.length > 0) {
    let dbById = null;
    try {
      if (db && typeof db.getAllAppidsMap === 'function') dbById = db.getAllAppidsMap();
    } catch (e) {
      console.warn('[REMOTE-SYNC] games.db not available for diff:', e.message);
    }
    if (dbById) {
      newGames = remoteGames.filter(g => !dbById.has(String(g.appid)));
      // ISO-8601 strings compare lexicographically, so a plain `>` is chronological.
      updatedGames = remoteGames.filter(g => {
        const localUpdated = dbById.get(String(g.appid));
        return localUpdated && g.updated_date && g.updated_date > localUpdated;
      });
      console.log('[REMOTE-SYNC] New games:', newGames.length, '| Updated games:', updatedGames.length, '(vs games.db:', dbById.size, ')');
    } else {
      console.warn('[REMOTE-SYNC] Skipping games diff — games.db not ready');
    }
  }

  // ── Diff fixes against fixes.db (new games' fixes + changed/repaired fix sets) ──
  if (Array.isArray(remoteFixesRaw) && remoteFixesRaw.length > 0) {
    const remoteFixes = flattenRemoteFixes(remoteFixesRaw);
    console.log('[REMOTE-SYNC] Fetched', remoteFixes.length, 'remote fixes');
    let localFixes = [];
    try {
      if (db && typeof db.getAllFixes === 'function') localFixes = db.getAllFixes() || [];
    } catch (e) {
      console.warn('[REMOTE-SYNC] fixes.db not available for diff:', e.message);
    }
    // Per-appid signature over the set of fix URLs+badges — catches added fixes,
    // "Fix Repair" updates, and changed downloads for games we already track.
    const fixSig = (rows) => rows
      .map(f => `${f.download_url || ''}#${(Array.isArray(f.badges) ? f.badges : []).join('+')}`)
      .sort().join('||');
    const remoteByApp = groupByApp(remoteFixes);
    const localByApp = groupByApp(localFixes);
    const newFixAppids = [];
    const updatedFixAppids = [];
    for (const [appid, rows] of remoteByApp) {
      if (!localByApp.has(appid)) newFixAppids.push(appid);
      else if (fixSig(rows) !== fixSig(localByApp.get(appid))) updatedFixAppids.push(appid);
    }
    const changed = new Set([...newFixAppids, ...updatedFixAppids]);
    newFixes = remoteFixes.filter(f => newFixAppids.includes(String(f.appid)));
    updatedFixes = remoteFixes.filter(f => changed.has(String(f.appid)) && !newFixAppids.includes(String(f.appid)));
    console.log('[REMOTE-SYNC] New fixes:', newFixAppids.length, 'games | Updated fixes:', updatedFixAppids.length, 'games');
  }

  // ── Persist the Last-Modified markers for cheap 304s next time ──
  saveState(state);

  return {
    newGames,
    updatedGames,
    newFixes,
    updatedFixes,
    remoteGamesCount: Array.isArray(remoteGames) ? remoteGames.length : 0,
    remoteFixesCount: Array.isArray(remoteFixesRaw) ? remoteFixesRaw.length : 0,
    errors,
  };
}

module.exports = { init, checkForUpdates };
