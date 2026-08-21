#!/usr/bin/env node
/**
 * fetch-game-covers.js
 *
 * Scans games.db for entries with missing/empty header_image,
 * fetches the correct cover URL from the Steam Store API,
 * and updates games.db with verified cover URLs.
 *
 * Also checks fixes.db entries — if any fix game appid is missing
 * from games.db entirely, adds a minimal entry with cover URL.
 *
 * Usage:
 *   node scripts/node/fetch-game-covers.js
 *
 * Options:
 *   --dry-run    Preview what would be updated without writing
 *   --appid X    Only process a single appid
 *   --batch N    Process N apps per batch (default: 5, max: 50)
 *   --delay N    Delay between batches in ms (default: 2000)
 *   --verbose    Print detailed per-game info
 *   --refresh-old  Re-fetch header_image for games using old CDN pattern
 *                  (cdn.akamai.steamstatic.com/steam/apps/{id}/header.jpg)
 *                  which returns 404 for many newer titles
 *
 * Safety:
 *   - Never writes partial data to games.db
 *   - Creates a .bak backup before any modification
 *   - Rate-limited to avoid Steam API throttling
 *   - Can be safely interrupted; re-run resumes (idempotent)
 */

const fs = require('fs');
const path = require('path');
const { openDb } = require('./db-node.cjs');

// ── Configuration ──────────────────────────────────────────────────────────

const GAMES_DB = path.resolve(__dirname, '../../games.db');
const STEAM_API = 'https://store.steampowered.com/api/appdetails';
const USER_AGENT = 'AHGUnlocker/1.0.0 (cover-fetch)';

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const SINGLE_APPID = args.includes('--appid') ? args[args.indexOf('--appid') + 1] : null;
const REFRESH_OLD = args.includes('--refresh-old');
const BATCH_SIZE = Math.min(
  parseInt(args.includes('--batch') ? args[args.indexOf('--batch') + 1] : (REFRESH_OLD ? '50' : '5'), 10) || (REFRESH_OLD ? 50 : 5),
  50
);
const BATCH_DELAY = parseInt(args.includes('--delay') ? args[args.indexOf('--delay') + 1] : (REFRESH_OLD ? '1500' : '2000'), 10) || (REFRESH_OLD ? 1500 : 2000);

// ── Helpers ────────────────────────────────────────────────────────────────

function log(msg, force = false) {
  if (force || VERBOSE || DRY_RUN) console.log(msg);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Build a lookup map and validate data */
function buildLookup(games) {
  const map = new Map();
  for (const g of games) {
    if (g.appid) map.set(g.appid, g);
  }
  return map;
}

/** Fetch game details from Steam Store API */
async function fetchSteamAppDetails(appid) {
  const url = `${STEAM_API}?appids=${appid}&cc=us&l=en&filters=basic`;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
    if (!resp.ok) {
      log(`  [WARN] HTTP ${resp.status} for ${appid}`);
      return null;
    }
    const json = await resp.json();
    const entry = json[appid];
    if (entry && entry.success && entry.data) {
      return entry.data;
    }
    return null;
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      log(`  [WARN] Timeout for ${appid}`);
    } else {
      log(`  [WARN] fetch error for ${appid}: ${err.message}`);
    }
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   AHG Unlocker — Game Cover Fetcher              ║');
  console.log('╚══════════════════════════════════════════════════╝');
  if (DRY_RUN) console.log('[DRY RUN] No files will be modified');
  console.log();

  // ── Step 1: Open DB and load games ──
  console.log('Opening games.db...');
  const db = await openDb();
  const games = db.getAllGames();
  console.log(`  ${games.length.toLocaleString()} games loaded`);
  const gameMap = buildLookup(games);

  // Track in-memory changes; flushed to DB only at the end
  const changedHeaders = [];   // { appid, header_image }
  const addedGames = [];       // game objects to insert

  // ── Step 2: Find missing headers ──
  const missing = [];
  for (const g of games) {
    if (!g.header_image || g.header_image.trim() === '') {
      if (!SINGLE_APPID || g.appid === SINGLE_APPID) {
        missing.push(g);
      }
    }
  }
  console.log(`Games with empty/missing header_image: ${missing.length}`);

  if (SINGLE_APPID && missing.length === 0) {
    console.log(`  (appid ${SINGLE_APPID} not in missing list or not found)`);
  }

  // ── Step 2b: Find games with old CDN pattern (for --refresh-old) ──
  const OLD_CDN_PATTERN = 'cdn.akamai.steamstatic.com/steam/apps/';
  const oldPattern = [];
  if (REFRESH_OLD) {
    for (const g of games) {
      if (g.header_image && g.header_image.includes(OLD_CDN_PATTERN)) {
        if (!SINGLE_APPID || g.appid === SINGLE_APPID) {
          oldPattern.push(g);
        }
      }
    }
    console.log(`Games with old CDN pattern needing refresh: ${oldPattern.length.toLocaleString()}`);
  }

  if (missing.length === 0 && oldPattern.length === 0) {
    console.log();
    console.log('[INFO] All games have header_image — no fixes needed.');
  } else {
    if (missing.length > 0) {
      console.log();
      console.log(`Fetching covers from Steam API (batch=${BATCH_SIZE}, delay=${BATCH_DELAY}ms)...`);

      let updated = 0;
      let failed = 0;

      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(g => fetchSteamAppDetails(g.appid))
        );

        for (let j = 0; j < batch.length; j++) {
          const game = batch[j];
          const result = results[j];
          const appid = game.appid;

          if (result.status === 'fulfilled' && result.value && result.value.header_image) {
            const url = result.value.header_image;
            game.header_image = url;
            changedHeaders.push({ appid, header_image: url });
            updated++;
            log(`  ✓ ${appid} → ${url}`, true);
          } else {
            failed++;
            log(`  ✗ ${appid} — API returned no header_image (preload will fallback)`, true);
          }
        }

        if (i + BATCH_SIZE < missing.length) {
          await sleep(BATCH_DELAY);
        }
      }

      console.log(`  ✓ ${updated} games updated`);
      if (failed > 0) console.log(`  ✗ ${failed} games failed`);
    }

    // ── Step 3b: Refresh old-pattern games (--refresh-old) ──
    let refreshed = 0;
    if (oldPattern.length > 0) {
      console.log();
      console.log(`Refreshing old-pattern covers from Steam API (batch=${BATCH_SIZE}, delay=${BATCH_DELAY}ms)...`);
      console.log(`  ${oldPattern.length.toLocaleString()} games to process`);

      let refreshFailed = 0;

      for (let i = 0; i < oldPattern.length; i += BATCH_SIZE) {
        const batch = oldPattern.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(g => fetchSteamAppDetails(g.appid))
        );

        for (let j = 0; j < batch.length; j++) {
          const game = batch[j];
          const result = results[j];
          const appid = game.appid;

          if (result.status === 'fulfilled' && result.value && result.value.header_image) {
            const url = result.value.header_image;
            game.header_image = url;
            changedHeaders.push({ appid, header_image: url });
            refreshed++;
            if (VERBOSE) log(`  ✓ ${appid} → ${url}`);
          } else {
            refreshFailed++;
            if (VERBOSE) log(`  ~ ${appid} — API unavailable, keeping old URL (preload will fallback)`);
          }
        }

        if (i + BATCH_SIZE < oldPattern.length) {
          await sleep(BATCH_DELAY);
        }
      }

      console.log(`  ✓ ${refreshed.toLocaleString()} refreshed`);
      if (refreshFailed > 0) console.log(`  ~ ${refreshFailed.toLocaleString()} skipped (API unavailable, preload will fallback)`);
    }
  }

  // ── Step 4: Check fixes for games not in games.db ──
  console.log();
  console.log('Checking fixes.db for missing game entries...');
  const fixes = db.getAllFixes();
  const fixesMissing = [];
  for (const f of fixes) {
    if (!gameMap.has(f.appid)) {
      fixesMissing.push({ appid: f.appid, name: f.name });
    }
  }
  console.log(`  Fix games not in games.db: ${fixesMissing.length}`);

  if (fixesMissing.length > 0) {
    if (DRY_RUN) {
      console.log('  (DRY RUN — would add these to games.db)');
      if (VERBOSE) {
        for (const f of fixesMissing.slice(0, 20)) {
          console.log(`    ${f.appid}: ${f.name}`);
        }
        if (fixesMissing.length > 20) {
          console.log(`    ... and ${fixesMissing.length - 20} more`);
        }
      }
    } else {
      console.log('  Adding missing fix game entries to games.db...');
      let added = 0;
      for (const f of fixesMissing) {
        addedGames.push({
          appid: f.appid,
          name: f.name,
          header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${f.appid}/header.jpg`,
          type: 'game',
          tags: [],
          nsfw: false,
          drm: false,
          dlc: {},
          added_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          genres: [],
          platforms: [],
        });
        added++;
      }
      console.log(`  ✓ ${added} fix games queued for insertion`);
    }
  }

  // ── Flush all changes to SQLite ──
  const hasHeaderChanges = changedHeaders.length > 0;
  const hasNewGames = addedGames.length > 0;

  if (!DRY_RUN && (hasHeaderChanges || hasNewGames)) {
    const bakPath = GAMES_DB + '.bak';
    fs.copyFileSync(GAMES_DB, bakPath);
    console.log(`  Backup saved: games.db.bak`);

    for (const c of changedHeaders) {
      db.updateGame(c.appid, 'header_image', c.header_image);
    }
    for (const g of addedGames) {
      db.insertGame(g);
    }
    db.saveGames();
    console.log(`  games.db saved (${changedHeaders.length} headers updated, ${addedGames.length} games inserted)`);
  } else if ((hasHeaderChanges || hasNewGames) && DRY_RUN) {
    console.log(`  (DRY RUN — would update ${changedHeaders.length} headers, insert ${addedGames.length} games)`);
  } else {
    console.log('  No changes to persist.');
  }

  db.close();

  // ── Summary ──
  console.log();
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Scan Complete                                  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  const totalMissing = missing.length;
  const oldUpdated = oldPattern.length > 0 ? changedHeaders.filter(h => oldPattern.some(o => o.appid === h.appid)).length : 0;
  const allGood = totalMissing === 0 && oldPattern.length === 0;
  if (allGood && !REFRESH_OLD) {
    console.log('Result: All games have header_image — no fixes needed');
  } else if (allGood && REFRESH_OLD) {
    console.log('Result: All games use verified URLs — no old patterns found');
  } else if (DRY_RUN) {
    console.log('Result: DRY RUN —', totalMissing, 'missing-headers would be fixed');
    if (REFRESH_OLD) console.log(`         ${oldPattern.length.toLocaleString()} old-pattern games would be refreshed`);
  } else {
    if (totalMissing > 0) console.log(`Result: Fixed ${changedHeaders.filter(h => missing.some(m => m.appid === h.appid)).length} missing headers`);
    if (oldUpdated > 0) console.log(`Result: Refreshed ${oldUpdated} old-pattern covers via Steam API`);
    console.log('Restart app to see changes. The preload Steam API fallback handles any remaining misses.');
  }
  console.log();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
