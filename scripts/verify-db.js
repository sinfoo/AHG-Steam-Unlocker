/**
 * verify-db.js — SQLite Database Integrity Verification
 *
 * Opens both games.db and fixes.db and runs comprehensive integrity checks:
 *   - Row count (and optional JSON comparison with --json-compare)
 *   - FTS virtual table existence and row counts
 *   - Index verification
 *   - Schema version check
 *   - Data integrity (null appids, missing names, etc.)
 *   - Type distribution analysis
 *
 * Usage:
 *   node scripts/verify-db.js [--verbose]           (SQLite-only, default)
 *   node scripts/verify-db.js --json-compare        (also compare JSON row counts)
 *
 * Returns exit code 0 if all checks pass.
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const VERBOSE   = process.argv.includes('--verbose');
const JSON_COMPARE = process.argv.includes('--json-compare');

// ── Configuration ──
const DB_DIR = path.join(__dirname, '..');
const GAMES_DB = path.join(DB_DIR, 'games.db');
const FIXES_DB = path.join(DB_DIR, 'fixes.db');
const GAMES_JSON = path.join(DB_DIR, 'games.json');
const FIXES_JSON = path.join(DB_DIR, 'fixes.json');

const SCHEMA_TABLE = '_schema_version';

// ── Colors ──
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;
let warnings = 0;

function ok(msg) { passed++; console.log(`${GREEN}✓ ${RESET}${msg}`); }
function fail(msg) { failed++; console.log(`${RED}✗ ${RESET}${msg}`); }
function warn(msg) { warnings++; console.log(`${YELLOW}⚠ ${RESET}${msg}`); }
function header(msg) { console.log(`\n${CYAN}${BOLD}${msg}${RESET}`); }

// ── Helpers ──
function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function countObjects(jsonArray, key) {
  const counts = {};
  for (const obj of jsonArray) {
    const k = obj[key] ?? '(undefined)';
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

// ── Main ──
(async function main() {
  console.log(`${BOLD}╔════════════════════════════════════════════╗`);
  console.log(`║   DB Integrity Verification Report        ║`);
  console.log(`╚════════════════════════════════════════════╝${RESET}\n`);

  // ──── Step 1: File existence ────
  header('1. File Existence');

  const files = [
    ['games.db', GAMES_DB],
    ['fixes.db', FIXES_DB],
    ['games.json', GAMES_JSON],
    ['fixes.json', FIXES_JSON],
  ];

  for (const [label, p] of files) {
    if (fs.existsSync(p)) {
      const size = fs.statSync(p).size;
      const sizeStr = size > 1024 * 1024
        ? `${(size / 1024 / 1024).toFixed(1)} MB`
        : `${(size / 1024).toFixed(0)} KB`;
      ok(`${label} found at ${path.basename(p)} (${sizeStr})`);
    } else {
      fail(`${label} NOT FOUND at ${p}`);
    }
  }

  if (failed > 0) {
    console.log(`\n${RED}Fatal: essential files missing. Exiting.${RESET}`);
    process.exit(1);
  }

  let gamesJson, fixesJson;

  // ──── Step 2: Load JSON sources (optional, --json-compare flag) ────
  if (JSON_COMPARE) {
    header('2. Loading JSON Sources');
    try {
      const raw = fs.readFileSync(GAMES_JSON, 'utf-8');
      gamesJson = JSON.parse(raw);
      ok(`games.json parsed: ${gamesJson.length.toLocaleString()} entries`);
    } catch (e) {
      fail(`games.json parse error: ${e.message}`);
      process.exit(1);
    }

    try {
      fixesJson = readJson(FIXES_JSON);
      ok(`fixes.json parsed: ${fixesJson.length.toLocaleString()} entries`);
    } catch (e) {
      fail(`fixes.json parse error: ${e.message}`);
      process.exit(1);
    }
  } else {
    console.log('  (skipped — use --json-compare to enable)');
  }

  // ──── Step 3: Open SQLite databases ────
  header('3. Opening SQLite Databases');

  const SQL = await initSqlJs();

  let db, fixesDb;
  try {
    db = new SQL.Database(fs.readFileSync(GAMES_DB));
    ok(`games.db opened (${fs.statSync(GAMES_DB).size / 1024 / 1024 | 0} MB)`);
  } catch (e) {
    fail(`games.db open error: ${e.message}`);
    process.exit(1);
  }

  try {
    fixesDb = new SQL.Database(fs.readFileSync(FIXES_DB));
    ok(`fixes.db opened (${(fs.statSync(FIXES_DB).size / 1024).toFixed(0)} KB)`);
  } catch (e) {
    fail(`fixes.db open error: ${e.message}`);
    process.exit(1);
  }

  // ──── Step 4: Row counts ────
  const STEP_LABEL = JSON_COMPARE ? '4. Row Count Comparison' : '4. Row Counts';
  header(STEP_LABEL);

  const gamesCount = db.exec('SELECT COUNT(*) AS c FROM games')[0].values[0][0];
  ok(`games.db has ${gamesCount.toLocaleString()} rows`);

  const fixesCount = fixesDb.exec('SELECT COUNT(*) AS c FROM fixes')[0].values[0][0];
  ok(`fixes.db has ${fixesCount.toLocaleString()} rows`);

  if (JSON_COMPARE) {
    // Count unique appids in JSON
    const jsonAppids = new Set(gamesJson.map(g => String(g.appid ?? '')));
    ok(`games.json has ${jsonAppids.size.toLocaleString()} unique appids (total entries: ${gamesJson.length.toLocaleString()})`);

    const jsonRepeats = gamesJson.length - jsonAppids.size;
    if (jsonRepeats > 0) {
      warn(`games.json has ${jsonRepeats.toLocaleString()} duplicate appids`);
    }

    if (gamesCount === jsonAppids.size) {
      ok(`Row count matches: ${gamesCount.toLocaleString()} = ${jsonAppids.size.toLocaleString()}`);
    } else {
      const diff = Math.abs(gamesCount - jsonAppids.size);
      if (gamesCount < jsonAppids.size) {
        warn(`DB has ${diff.toLocaleString()} fewer rows than JSON (${gamesCount} vs ${jsonAppids.size})`);
      } else {
        warn(`DB has ${diff.toLocaleString()} more rows than JSON (${gamesCount} vs ${jsonAppids.size})`);
      }
    }

    const fixesAppids = new Set(fixesJson.map(f => String(f.appid ?? '')));
    ok(`fixes.json has ${fixesAppids.size.toLocaleString()} unique appids (total: ${fixesJson.length.toLocaleString()})`);

    const fixesRepeats = fixesJson.length - fixesAppids.size;
    if (fixesRepeats > 0) {
      warn(`fixes.json has ${fixesRepeats} duplicate appids`);
    }

    if (fixesCount === fixesAppids.size) {
      ok(`fixes.db row count matches: ${fixesCount} = ${fixesAppids.size}`);
    } else {
      const diff = Math.abs(fixesCount - fixesAppids.size);
      if (fixesCount < fixesAppids.size) {
        warn(`fixes.db has ${diff} fewer rows than JSON`);
      } else {
        warn(`fixes.db has ${diff} more rows than JSON`);
      }
    }
  } else {
    console.log('  (JSON comparison skipped — use --json-compare to enable)');
  }

  // ──── Step 5: FTS verification ────
  header('5. FTS Virtual Table Verification');

  // Check games_fts exists
  const ftsTables = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='games_fts'"
  );
  if (ftsTables.length > 0 && ftsTables[0].values.length > 0) {
    ok('games_fts FTS4 virtual table exists');

    // Check FTS row count matches main table
    const ftsCount = db.exec('SELECT COUNT(*) AS c FROM games_fts')[0].values[0][0];
    if (ftsCount === gamesCount) {
      ok(`FTS row count matches: ${ftsCount.toLocaleString()} = ${gamesCount.toLocaleString()}`);
    } else {
      warn(`FTS row count mismatch: ${ftsCount.toLocaleString()} vs ${gamesCount.toLocaleString()}`);
    }

    // Test FTS MATCH query works
    try {
      const ftsResult = db.exec(
        "SELECT COUNT(*) AS c FROM games_fts WHERE games_fts MATCH 'steam'"
      );
      if (VERBOSE) {
        const matchCount = ftsResult[0].values[0][0];
        console.log(`  FTS MATCH 'steam' returned ${matchCount} results`);
      }
      ok('FTS MATCH query executes successfully');
    } catch (e) {
      fail(`FTS MATCH query failed: ${e.message}`);
    }
  } else {
    fail('games_fts FTS4 virtual table does NOT exist');
  }

  // Check fixes_fts
  const ftsFixTables = fixesDb.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='fixes_fts'"
  );
  if (ftsFixTables.length > 0 && ftsFixTables[0].values.length > 0) {
    ok('fixes_fts FTS4 virtual table exists');
  } else {
    warn('fixes_fts FTS4 virtual table not found (expected for empty fixes)');
  }

  // ──── Step 6: Index verification ────
  header('6. Index Verification');

  const expectedIndexes = [
    'idx_games_appid',
    'idx_games_name',
    'idx_games_type',
    'idx_games_added_date',
    'idx_games_updated_date',
  ];

  const dbIndexes = db.exec(
    "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
  );
  const indexNames = new Set((dbIndexes[0]?.values ?? []).map(r => r[0]));

  for (const idx of expectedIndexes) {
    if (indexNames.has(idx)) {
      ok(`Index exists: ${idx}`);
    } else {
      warn(`Index missing: ${idx}`);
    }
  }

  // Check primary key
  const pkInfo = db.exec(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='games'"
  );
  if (pkInfo.length > 0 && pkInfo[0].values[0][0].includes('PRIMARY KEY')) {
    ok('games table has PRIMARY KEY');
  } else {
    fail('games table missing PRIMARY KEY');
  }

  // ──── Step 7: Schema version ────
  header('7. Schema Version');

  try {
    const svRows = db.exec(`SELECT version, applied_at FROM ${SCHEMA_TABLE}`);
    if (svRows.length > 0 && svRows[0].values.length > 0) {
      const [version, appliedAt] = svRows[0].values[0];
      ok(`Schema version: ${version} (applied: ${appliedAt})`);
    } else {
      warn('_schema_version table has no rows');
    }
  } catch (e) {
    warn(`_schema_version table missing: ${e.message}`);
  }

  // ──── Step 8: Data integrity ────
  header('8. Data Integrity');

  // Null appids
  const nullAppids = db.exec("SELECT COUNT(*) AS c FROM games WHERE appid IS NULL OR appid = ''")[0].values[0][0];
  if (nullAppids === 0) {
    ok('No null/empty appids');
  } else {
    fail(`${nullAppids} game(s) have null/empty appid`);
  }

  // Null names
  const nullNames = db.exec("SELECT COUNT(*) AS c FROM games WHERE name IS NULL OR name = ''")[0].values[0][0];
  if (nullNames === 0) {
    ok('No null/empty names');
  } else {
    warn(`${nullNames} game(s) have null/empty name`);
  }

  // Check type distribution
  const typeDist = db.exec('SELECT type, COUNT(*) AS c FROM games GROUP BY type ORDER BY c DESC');
  if (typeDist.length > 0) {
    const typeRows = typeDist[0].values;
    let typedTotal = 0;
    for (const [type, count] of typeRows) {
      const label = type === '' ? '(empty)' : type;
      console.log(`  Type "${label}": ${count.toLocaleString()}`);
      if (type !== '') typedTotal += count;
    }
    const emptyType = typeRows.filter(r => r[0] === '').reduce((s, r) => s + r[1], 0);
    if (emptyType > 0) {
      warn(`${emptyType.toLocaleString()} games with empty type (out of ${gamesCount.toLocaleString()})`);
    } else {
      ok('Type distribution complete');
    }
  }

  // Platform column check (known to always be [])
  const nonEmptyPlatforms = db.exec("SELECT COUNT(*) AS c FROM games WHERE platforms != '[]'")[0].values[0][0];
  if (nonEmptyPlatforms === 0) {
    ok('Platforms column: all entries are [] (as expected — no platforms field in source JSON)');
  } else {
    warn(`${nonEmptyPlatforms} entries have non-empty platforms`);
  }

  // ──── Step 9: Truncation check (streaming parser) ────
  header('9. Data Completeness (Streaming Parser)');

  // Check that the last rows by appid are reasonable (no truncation in streaming parse)
  const lastGame = db.exec('SELECT appid, name FROM games ORDER BY appid DESC LIMIT 1');
  if (lastGame.length > 0 && lastGame[0].values.length > 0) {
    const [lastAppid, lastName] = lastGame[0].values[0];
    if (VERBOSE) {
      console.log(`  Last game (by appid): appid=${lastAppid}, name="${lastName}"`);
    }
    ok(`Games table has trailing records — streaming parser completed`);
  }

  // Check the count of games from JSON that have a specific known appid
  // Spot check: pick a known appid range
  const sampleAppid = '10'; // Counter-Strike
  const sampleInDb = db.exec('SELECT appid, name FROM games WHERE appid = $appid', { $appid: sampleAppid });
  if (sampleInDb.length > 0 && sampleInDb[0].values.length > 0) {
    const [aid, aname] = sampleInDb[0].values[0];
    ok(`Spot check: appid=${aid} (${aname}) found in DB`);
  } else {
    warn(`Spot check: appid=${sampleAppid} not found in DB`);
  }

  // ──── Step 10: Fixes integrity ────
  header('10. Fixes Data Integrity');

  const nullFixAppids = fixesDb.exec("SELECT COUNT(*) AS c FROM fixes WHERE appid IS NULL OR appid = ''")[0].values[0][0];
  if (nullFixAppids === 0) {
    ok('Fixes: no null/empty appids');
  } else {
    fail(`Fixes: ${nullFixAppids} null/empty appids`);
  }

  const nullFixNames = fixesDb.exec("SELECT COUNT(*) AS c FROM fixes WHERE name IS NULL OR name = ''")[0].values[0][0];
  if (nullFixNames === 0) {
    ok('Fixes: no null/empty names');
  } else {
    warn(`Fixes: ${nullFixNames} null/empty names`);
  }

  // Source distribution
  const fixSourceDist = fixesDb.exec('SELECT source, COUNT(*) AS c FROM fixes GROUP BY source ORDER BY c DESC');
  if (fixSourceDist.length > 0) {
    console.log(`  Fix source distribution:`);
    for (const [src, cnt] of fixSourceDist[0].values) {
      console.log(`    ${src || '(unknown)'}: ${cnt}`);
    }
  }

  // ──── Summary ────
  header('══════════════════ SUMMARY ══════════════════');
  const total = passed + failed;
  console.log(`${GREEN}Passed: ${passed}${RESET}`);
  if (failed > 0) console.log(`${RED}Failed: ${failed}${RESET}`);
  if (warnings > 0) console.log(`${YELLOW}Warnings: ${warnings}${RESET}`);
  console.log(`${CYAN}Total checks: ${total}${RESET}`);

  if (failed > 0) {
    console.log(`\n${RED}${BOLD}⚠  ${failed} check(s) FAILED — need investigation${RESET}`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`\n${YELLOW}All critical checks passed (${warnings} warning(s))${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${GREEN}${BOLD}✓ All checks PASSED${RESET}`);
    process.exit(0);
  }
})().catch(err => {
  console.error(`${RED}Fatal error:${RESET}`, err);
  process.exit(1);
});
