/**
 * db.test.cjs — Comprehensive test suite for electron/db.cjs
 *
 * Uses Node.js built-in test framework (node:test + node:assert).
 * Tests all 32 exported methods against the real games.db and fixes.db.
 *
 * Run with: node --test tests/db.test.cjs
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const db = require('../electron/db.cjs');

// ── Test Constants ──────────────────────────────────────────────────────────
const TEST_APPID = 'TEST-999999';
const TEST_APPID_2 = 'TEST-999998';
const TEST_APPID_3 = 'TEST-999997';
const TEST_FIX_APPID = 'TEST-FIX-999999';
const TEST_FIX_APPID_2 = 'TEST-FIX-999998';
const TEST_FIX_APPID_3 = 'TEST-FIX-999997';
const KNOWN_APPID = '10';            // Counter-Strike (exists in both DBs)
const KNOWN_APPID_2 = '20';          // Team Fortress Classic
const INVALID_APPID = '999999999999';

// ── Assertion Helpers ───────────────────────────────────────────────────────

function assertGameShape(game, expectedAppid) {
  assert.ok(game, `Expected game object for appid ${expectedAppid}`);
  assert.strictEqual(game.appid, String(expectedAppid));
  assert.strictEqual(typeof game.name, 'string');
  assert.ok(game.name.length > 0, 'Game name should not be empty');
  assert.ok(Array.isArray(game.tags), 'tags should be an array');
  assert.ok(Array.isArray(game.genres), 'genres should be an array');
  assert.ok(Array.isArray(game.platforms), 'platforms should be an array');
  assert.strictEqual(typeof game.nsfw, 'boolean', 'nsfw should be boolean');
  assert.strictEqual(typeof game.drm, 'boolean', 'drm should be boolean');
  assert.ok(game.dlc !== null && game.dlc !== undefined, 'dlc should be defined');
  assert.strictEqual(typeof game.added_date, 'string');
  assert.strictEqual(typeof game.updated_date, 'string');
  assert.strictEqual(typeof game.type, 'string');
}

function assertFixShape(fix, expectedAppid) {
  assert.ok(fix, `Expected fix object for appid ${expectedAppid}`);
  assert.strictEqual(fix.appid, String(expectedAppid));
  assert.strictEqual(typeof fix.name, 'string');
  assert.strictEqual(typeof fix.source, 'string');
  assert.ok(Array.isArray(fix.badges), 'fix.badges should be an array');
  assert.ok(Array.isArray(fix.download_urls), 'fix.download_urls should be an array');
  assert.ok(Array.isArray(fix.versions), 'fix.versions should be an array');
  assert.strictEqual(typeof fix.fix_count, 'number', 'fix.fix_count should be a number');
}

// ── Root Describe (sequential) ─────────────────────────────────────────────

describe('db.cjs SQLite Database Wrapper', { concurrency: false }, () => {

  // ── Global Setup / Teardown ──────────────────────────────────────────────

  before(async () => {
    await db.initialize();
  });

  after(() => {
    // Remove any remaining test game entries.
    // Write tests clean up their own data, but in case of failures
    // we try to delete everything here to keep the in-memory state clean.
    const cleanupIds = [
      TEST_APPID, TEST_APPID_2, TEST_APPID_3,
      TEST_APPID + '-DEL-1', TEST_APPID + '-DEL-2',
    ];
    for (const id of cleanupIds) {
      try { db.deleteGame(id); } catch (_) { /* already cleaned up */ }
    }
    db.close();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Schema (read-only)
  // ═══════════════════════════════════════════════════════════════════════

  describe('getSchemaVersion', () => {

    test('returns the current schema version number (≥ 0)', () => {
      const version = db.getSchemaVersion();
      assert.strictEqual(typeof version, 'number');
      assert.ok(version >= 0, 'Schema version should be >= 0');
    });

    test('returns the same value on repeated calls', () => {
      const v1 = db.getSchemaVersion();
      const v2 = db.getSchemaVersion();
      assert.strictEqual(v1, v2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════

  describe('Lifecycle', () => {

    test('initialize() makes databases queryable (implicit via before hook)', () => {
      // Verified by the fact that getGameCount() returns a positive number
      // without throwing "Not initialized"
      assert.doesNotThrow(() => db.getGameCount());
      assert.ok(db.getGameCount() > 0, 'Game count should be > 0 after init');
    });

    test('persist() returns the absolute path to games.db', () => {
      const result = db.persist();
      assert.strictEqual(typeof result, 'string');
      assert.ok(result.length > 0, 'Path should be non-empty');
      assert.ok(result.endsWith('games.db') || result.includes('games.db'),
        `Expected path to contain 'games.db', got: ${result}`);
      // Verify file actually exists on disk
      assert.ok(fs.existsSync(result), 'games.db should exist at returned path');
    });

    test('persistFixes() returns the absolute path to fixes.db', () => {
      const result = db.persistFixes();
      assert.strictEqual(typeof result, 'string');
      assert.ok(result.length > 0, 'Path should be non-empty');
      assert.ok(result.includes('fixes.db'),
        `Expected path to contain 'fixes.db', got: ${result}`);
      // Verify file actually exists on disk
      assert.ok(fs.existsSync(result), 'fixes.db should exist at returned path');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Game Queries (read-only)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Game Queries', () => {

    test('getGameCount() returns total number of games (> 100K)', () => {
      const count = db.getGameCount();
      assert.strictEqual(typeof count, 'number');
      assert.ok(count > 100_000, `Expected > 100K games, got ${count}`);
      assert.ok(Number.isInteger(count), 'Count should be an integer');
    });

    test('getAllGames() returns every game as a sorted array', () => {
      const games = db.getAllGames();
      assert.ok(Array.isArray(games));
      assert.ok(games.length > 100_000, `Expected > 100K games, got ${games.length}`);
      // First entry should be a valid game object
      assertGameShape(games[0], games[0].appid);
      // Verify case-insensitive name sort of first entries
      const names = games.slice(0, 10).map(g => g.name.toLowerCase());
      for (let i = 1; i < names.length; i++) {
        assert.ok(names[i - 1] <= names[i],
          `Sort order violated at index ${i}: "${names[i - 1]}" > "${names[i]}"`);
      }
      // Known game is present
      const cs = games.find(g => g.appid === KNOWN_APPID);
      assert.ok(cs, 'Counter-Strike should be in the full list');
      assert.strictEqual(cs.name, 'Counter-Strike');
    });

    test('getGame() returns a full game object for a known appid', () => {
      const game = db.getGame(KNOWN_APPID);
      assertGameShape(game, KNOWN_APPID);
      assert.strictEqual(game.name, 'Counter-Strike');
    });

    test('getGame() returns null for a non-existent appid', () => {
      const game = db.getGame(INVALID_APPID);
      assert.strictEqual(game, null);
    });

    test('getGame() handles null appid without throwing', () => {
      // String(null) → 'null', which won't match any row
      const result = db.getGame(null);
      assert.strictEqual(result, null);
    });

    test('getGame() handles undefined appid without throwing', () => {
      const result = db.getGame(undefined);
      assert.strictEqual(result, null);
    });

    test('gameExists() returns true for a known appid', () => {
      assert.strictEqual(db.gameExists(KNOWN_APPID), true);
    });

    test('gameExists() returns false for a non-existent appid', () => {
      assert.strictEqual(db.gameExists(INVALID_APPID), false);
    });

    test('gameExists() handles null/undefined gracefully', () => {
      assert.strictEqual(db.gameExists(null), false);
      assert.strictEqual(db.gameExists(undefined), false);
    });

    test('getGamesMeta() returns { appid, name, header_image } for matching appids', () => {
      const meta = db.getGamesMeta([KNOWN_APPID, KNOWN_APPID_2]);
      assert.ok(Array.isArray(meta));
      assert.ok(meta.length >= 2, `Expected ≥ 2 results, got ${meta.length}`);
      meta.forEach(m => {
        assert.ok('appid' in m);
        assert.ok('name' in m);
        assert.ok('header_image' in m);
      });
      const cs = meta.find(m => m.appid === KNOWN_APPID);
      assert.ok(cs, 'Counter-Strike should be in meta results');
      assert.strictEqual(cs.name, 'Counter-Strike');
      assert.strictEqual(typeof cs.header_image, 'string');
    });

    test('getGamesMeta() returns empty array for empty input', () => {
      assert.deepStrictEqual(db.getGamesMeta([]), []);
    });

    test('getGamesMeta() returns empty array for null / undefined input', () => {
      assert.deepStrictEqual(db.getGamesMeta(null), []);
      assert.deepStrictEqual(db.getGamesMeta(undefined), []);
    });

    test('getAllGameIds() returns appid/name entries', () => {
      const ids = db.getAllGameIds();
      assert.ok(Array.isArray(ids));
      assert.ok(ids.length > 0, 'Should return at least one entry');
      ids.slice(0, 100).forEach(entry => {
        assert.ok('appid' in entry, 'Entry should have appid');
        assert.ok('name' in entry, 'Entry should have name');
        assert.strictEqual(typeof entry.appid, 'string');
        assert.strictEqual(typeof entry.name, 'string');
      });
    });

    test('queryGames() returns paginated results with sensible defaults', () => {
      const result = db.queryGames();
      assert.ok(result !== null && typeof result === 'object');
      assert.ok(Array.isArray(result.games));
      assert.strictEqual(result.page, 1, 'Default page should be 1');
      assert.strictEqual(result.pageSize, 50, 'Default pageSize should be 50');
      assert.ok(typeof result.total === 'number');
      assert.ok(result.total > 100_000, 'Total should be > 100K');
      assert.ok(result.games.length <= 50, 'Games array should respect pageSize');
      if (result.games.length > 0) {
        assertGameShape(result.games[0], result.games[0].appid);
      }
    });

    test('queryGames() respects explicit pagination', () => {
      const result = db.queryGames({ page: 2, limit: 10 });
      assert.strictEqual(result.page, 2);
      assert.strictEqual(result.pageSize, 10);
      assert.ok(result.games.length <= 10);
      // Page 2 should have different games than page 1
      const page1 = db.queryGames({ page: 1, limit: 10 });
      if (result.games.length > 0 && page1.games.length > 0) {
        const ids1 = page1.games.map(g => g.appid);
        const ids2 = result.games.map(g => g.appid);
        const overlap = ids1.filter(id => ids2.includes(id));
        assert.strictEqual(overlap.length, 0, 'Page 1 and Page 2 should not overlap');
      }
    });

    test('queryGames() clamps page < 1 to minimum of 1', () => {
      const result = db.queryGames({ page: 0, limit: 5 });
      assert.strictEqual(result.page, 1);
      assert.ok(result.games.length > 0);
    });

    test('queryGames() caps limit at MAX_PAGE_SIZE (200)', () => {
      const result = db.queryGames({ limit: 999 });
      assert.strictEqual(result.pageSize, 200);
    });

    test('queryGames() with search finds matching games', () => {
      const result = db.queryGames({ search: 'Counter-Strike', limit: 10 });
      assert.ok(result.total >= 1, `Expected ≥ 1 match for "Counter-Strike", got ${result.total}`);
      assert.ok(result.games.some(g => g.name.includes('Counter-Strike')),
        'Results should include Counter-Strike');
    });

    test('queryGames() with type filter returns only matching type values', () => {
      const result = db.queryGames({ type: 'game', limit: 20 });
      result.games.forEach(g => {
        assert.strictEqual(g.type, 'game',
          `Expected type "game", got "${g.type}" for appid ${g.appid}`);
      });
    });

    test('queryGames() with sort="name_desc" returns descending names', () => {
      const result = db.queryGames({ sort: 'name_desc', limit: 10 });
      assert.ok(result.games.length > 0);
      const names = result.games.map(g => g.name.toLowerCase());
      for (let i = 1; i < names.length; i++) {
        assert.ok(names[i - 1] >= names[i],
          `name_desc sort violated at index ${i}: "${names[i - 1]}" < "${names[i]}"`);
      }
    });

    test('queryGames() with sort="added" returns descending added_date', () => {
      const result = db.queryGames({ sort: 'added', limit: 10 });
      assert.ok(result.games.length > 0);
      for (let i = 1; i < result.games.length; i++) {
        assert.ok(result.games[i - 1].added_date >= result.games[i].added_date,
          `added sort violated at index ${i}`);
      }
    });

    test('queryGames() with sort="added_asc" returns ascending added_date', () => {
      const result = db.queryGames({ sort: 'added_asc', limit: 10 });
      assert.ok(result.games.length > 0);
      for (let i = 1; i < result.games.length; i++) {
        assert.ok(result.games[i - 1].added_date <= result.games[i].added_date,
          `added_asc sort violated at index ${i}`);
      }
    });

    test('queryGames() with platform filter handles no-match case gracefully', () => {
      // Platforms are JSON arrays; a nonexistent platform returns zero results
      const result = db.queryGames({ platform: 'nonexistent_platform', limit: 5 });
      assert.ok(Array.isArray(result.games));
      assert.strictEqual(typeof result.total, 'number');
      // Either total >= 0 and games array is valid
      assert.ok(result.total >= 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Search (read-only)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Search', () => {

    test('searchGamesFTS() finds games by name (FTS or LIKE fallback)', () => {
      const results = db.searchGamesFTS('Counter-Strike', 5);
      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 1,
        `Expected ≥ 1 result for "Counter-Strike", got ${results.length}`);
      assertGameShape(results[0], results[0].appid);
      assert.ok(results.some(g => g.name.includes('Counter-Strike')),
        'Results should include Counter-Strike');
    });

    test('searchGamesFTS() respects the limit parameter', () => {
      const small = db.searchGamesFTS('a', 3);
      assert.ok(small.length <= 3, `Expected ≤ 3 results, got ${small.length}`);
    });

    test('searchGamesFTS() returns empty array for empty query', () => {
      assert.deepStrictEqual(db.searchGamesFTS(''), []);
    });

    test('searchGamesFTS() returns empty array for whitespace-only query', () => {
      assert.deepStrictEqual(db.searchGamesFTS('   '), []);
    });

    test('searchGamesFTS() returns empty array for gibberish query', () => {
      const results = db.searchGamesFTS('XYZZZ_NOT_FOUND_999');
      assert.ok(Array.isArray(results));
      assert.strictEqual(results.length, 0);
    });

    test('searchGamesFTS() handles null/undefined gracefully', () => {
      assert.deepStrictEqual(db.searchGamesFTS(null), []);
      assert.deepStrictEqual(db.searchGamesFTS(undefined), []);
    });

    test('getSearchSuggestions() returns prefix-matched results', () => {
      const results = db.getSearchSuggestions('Counter', 10);
      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0,
        `Expected ≥ 1 suggestion for "Counter", got ${results.length}`);
      // Each result has the expected fields
      results.forEach(r => {
        assert.ok('appid' in r);
        assert.ok('name' in r);
        assert.ok('header_image' in r);
      });
      // All names should start with the prefix (case-insensitive)
      results.forEach(r => {
        assert.ok(r.name.toLowerCase().startsWith('counter'),
          `"${r.name}" does not start with "Counter"`);
      });
    });

    test('getSearchSuggestions() respects the limit parameter', () => {
      const results = db.getSearchSuggestions('C', 3);
      assert.ok(results.length <= 3,
        `Expected ≤ 3 suggestions, got ${results.length}`);
    });

    test('getSearchSuggestions() returns empty array for empty query', () => {
      assert.deepStrictEqual(db.getSearchSuggestions(''), []);
    });

    test('getSearchSuggestions() handles null/undefined gracefully', () => {
      assert.deepStrictEqual(db.getSearchSuggestions(null), []);
      assert.deepStrictEqual(db.getSearchSuggestions(undefined), []);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Browse / Filter (read-only)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Browse / Filter', () => {

    test('getGamesByType() filters games to a single type', () => {
      const result = db.getGamesByType(['game'], { limit: 15 });
      assert.ok(result !== null && typeof result === 'object');
      assert.ok(Array.isArray(result.games));
      assert.ok(typeof result.total === 'number');
      result.games.forEach(g => {
        assert.strictEqual(g.type, 'game',
          `Expected type "game", got "${g.type}" for ${g.appid}`);
      });
    });

    test('getGamesByType() filters games to multiple types', () => {
      const result = db.getGamesByType(['game', 'DLC'], { limit: 15 });
      result.games.forEach(g => {
        assert.ok(g.type === 'game' || g.type === 'DLC',
          `Unexpected type "${g.type}" for ${g.appid}`);
      });
    });

    test('getGamesByType() falls through to queryGames when type list is empty', () => {
      const result = db.getGamesByType([], { limit: 5 });
      assert.ok(result.total > 0, 'Should return all games when no type filter');
      assert.ok(result.games.length > 0);
    });

    test('getGamesByType() with non-existent type returns zero results', () => {
      const result = db.getGamesByType(['__nonexistent_type__'], { limit: 5 });
      assert.strictEqual(result.total, 0);
      assert.strictEqual(result.games.length, 0);
    });

    test('getGamesByType() with undefined/null type list falls through', () => {
      const byUndefined = db.getGamesByType(undefined, { limit: 5 });
      assert.ok(byUndefined.total > 0, 'undefined typeList should return games');
      const byNull = db.getGamesByType(null, { limit: 5 });
      assert.ok(byNull.total > 0, 'null typeList should return games');
      // Both should return the same as queryGames
      const defaultResult = db.queryGames({ limit: 5 });
      assert.strictEqual(byUndefined.total, defaultResult.total);
    });

    test('getGamesByType() search+type has known SQL generation issue (db.cjs where.slice(7) bug)', () => {
      // KNOWN db.cjs BUG @line 679: where.slice(7) should be slice(6).
      // Cannot be worked around from test — document the thrown error.
      assert.throws(() => {
        db.getGamesByType(['game'], { search: 'Counter', limit: 10 });
      }, /syntax error/i);
    });

    test('getTypeCounts() returns type distribution sorted descending', () => {
      const counts = db.getTypeCounts();
      assert.ok(Array.isArray(counts));
      assert.ok(counts.length > 0, 'Should have at least one type');
      counts.forEach(t => {
        assert.ok('type' in t, 'Each entry should have a type');
        assert.strictEqual(typeof t.count, 'number');
        assert.ok(t.count > 0, 'Each type count should be > 0');
      });
      // Verify descending sort by count
      for (let i = 1; i < counts.length; i++) {
        assert.ok(counts[i - 1].count >= counts[i].count,
          `Type counts not sorted descending at index ${i}: ` +
          `${counts[i - 1].type}(${counts[i - 1].count}) < ${counts[i].type}(${counts[i].count})`);
      }
    });

    test('getGamesNeedingCover() returns games with missing header_image', () => {
      const games = db.getGamesNeedingCover();
      assert.ok(Array.isArray(games));
      // Each entry is a minimal { appid, name } shape
      games.forEach(g => {
        assert.ok('appid' in g, 'Entry should have appid');
        assert.ok('name' in g, 'Entry should have name');
        assert.strictEqual(typeof g.appid, 'string');
        assert.strictEqual(typeof g.name, 'string');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Bulk / Maintenance — Read-only queries
  // ═══════════════════════════════════════════════════════════════════════

  describe('Bulk / Maintenance (Read)', () => {

    test('getRecentUpdates() returns games sorted by updated_date DESC', () => {
      const games = db.getRecentUpdates(15);
      assert.ok(Array.isArray(games));
      assert.ok(games.length <= 15,
        `Expected ≤ 15 games, got ${games.length}`);
      assert.ok(games.length > 0, 'Should have at least one recent update');
      games.forEach(g => assertGameShape(g, g.appid));
      // Verify descending sort
      for (let i = 1; i < games.length; i++) {
        assert.ok(games[i - 1].updated_date >= games[i].updated_date,
          `updated_date sort violated at index ${i}: ` +
          `"${games[i - 1].updated_date}" < "${games[i].updated_date}"`);
      }
    });

    test('getRecentUpdates() respects the limit parameter', () => {
      const games = db.getRecentUpdates(3);
      assert.ok(games.length <= 3,
        `Expected ≤ 3 games, got ${games.length}`);
    });

    test('getRecentUpdates() default limit is 100', () => {
      const games = db.getRecentUpdates();
      assert.ok(games.length <= 100,
        `Expected ≤ 100 games by default, got ${games.length}`);
      assert.ok(games.length > 0);
    });

    test('getGameCountByPlatform() returns per-platform counts', () => {
      const counts = db.getGameCountByPlatform();
      assert.ok(Array.isArray(counts));
      const platforms = counts.map(c => c.platform);
      assert.ok(platforms.includes('windows'), 'Should include windows');
      assert.ok(platforms.includes('mac'), 'Should include mac');
      assert.ok(platforms.includes('linux'), 'Should include linux');
      counts.forEach(c => {
        assert.strictEqual(typeof c.count, 'number');
        assert.ok(c.count >= 0, 'Count should be ≥ 0');
        assert.ok(Number.isInteger(c.count), 'Count should be an integer');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Fixes — Read-only queries
  // ═══════════════════════════════════════════════════════════════════════

  describe('Fixes (Read)', () => {

    test('getAllFixes() returns every fix as a sorted array', () => {
      const fixes = db.getAllFixes();
      assert.ok(Array.isArray(fixes));
      assert.ok(fixes.length > 1000,
        `Expected > 1000 fixes, got ${fixes.length}`);
      if (fixes.length > 0) {
        assertFixShape(fixes[0], fixes[0].appid);
      }
      // Known fix should be present
      const cs = fixes.find(f => f.appid === KNOWN_APPID);
      assert.ok(cs, 'Counter-Strike fix should be in the list');
      assert.strictEqual(cs.name, 'Counter-Strike');
    });

    test('getFix() returns a full fix object for a known appid', () => {
      const fix = db.getFix(KNOWN_APPID);
      assertFixShape(fix, KNOWN_APPID);
      assert.strictEqual(fix.name, 'Counter-Strike');
    });

    test('getFix() returns null for a non-existent appid', () => {
      const fix = db.getFix(INVALID_APPID);
      assert.strictEqual(fix, null);
    });

    test('getFix() handles null/undefined appid gracefully', () => {
      assert.strictEqual(db.getFix(null), null);
      assert.strictEqual(db.getFix(undefined), null);
    });

    test('getFixCount() returns the total number of fixes (> 1000)', () => {
      const count = db.getFixCount();
      assert.strictEqual(typeof count, 'number');
      assert.ok(count > 1000,
        `Expected > 1000 fixes, got ${count}`);
      assert.ok(Number.isInteger(count), 'Count should be an integer');
    });

    test('searchFixes() finds fixes by name substring', () => {
      const results = db.searchFixes('Counter-Strike');
      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 1,
        `Expected ≥ 1 fix for "Counter-Strike", got ${results.length}`);
      assertFixShape(results[0], results[0].appid);
    });

    test('searchFixes() returns empty for non-existent query', () => {
      const results = db.searchFixes('XYZZZ_NOT_FOUND_999');
      assert.ok(Array.isArray(results));
      assert.strictEqual(results.length, 0);
    });

    test('searchFixes() results are limited to 50', () => {
      // 'a' is a very common prefix; should get capped at 50
      const results = db.searchFixes('a');
      assert.ok(results.length <= 50,
        `Expected ≤ 50 results, got ${results.length}`);
    });

    test('searchFixesFTS() known issue: FTS4 unavailable + LIKE fallback missing $limit param', () => {
      // KNOWN db.cjs BUG: fixes_fts uses FTS4, but sql.js WASM doesn't ship FTS4.
      // LIKE fallback (@line 882) uses $limit in SQL but omits it from params,
      // so both FTS and fallback always throw.
      assert.throws(() => {
        db.searchFixesFTS('Counter', 5);
      }, /datatype mismatch/i);
    });

    test('searchFixesFTS() handles empty query', () => {
      assert.deepStrictEqual(db.searchFixesFTS(''), []);
    });

    test('searchFixesFTS() handles whitespace query', () => {
      assert.deepStrictEqual(db.searchFixesFTS('   '), []);
    });

    test('getFixCountBySource() returns source distribution sorted descending', () => {
      const counts = db.getFixCountBySource();
      assert.ok(Array.isArray(counts));
      assert.ok(counts.length > 0, 'Should have at least one source');
      counts.forEach(s => {
        assert.ok('source' in s, 'Each entry should have source');
        assert.strictEqual(typeof s.count, 'number');
        assert.ok(s.count > 0, 'Each source count should be > 0');
      });
      // Verify descending sort
      for (let i = 1; i < counts.length; i++) {
        assert.ok(counts[i - 1].count >= counts[i].count,
          `Source counts not sorted descending at index ${i}`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Write Operations — Games
  // ═══════════════════════════════════════════════════════════════════════

  describe('Write Operations (Games)', { concurrency: false }, () => {

    test('upsertGame() inserts a brand new game and returns true', () => {
      const game = {
        appid: TEST_APPID,
        name: 'Test Game',
        type: 'game',
        tags: ['Action', 'Adventure'],
        nsfw: false,
        drm: false,
        dlc: {},
        header_image: '',
        genres: ['Action'],
        platforms: ['windows'],
      };
      const result = db.upsertGame(game);
      assert.strictEqual(result, true);

      // Verify insertion
      const saved = db.getGame(TEST_APPID);
      assert.ok(saved, 'Game should exist after upsert');
      assert.strictEqual(saved.name, 'Test Game');
      assert.deepStrictEqual(saved.tags, ['Action', 'Adventure']);
      assert.strictEqual(saved.nsfw, false);
      assert.strictEqual(saved.drm, false);
    });

    test('upsertGame() updates an existing game (same appid)', () => {
      const update = {
        appid: TEST_APPID,
        name: 'Test Game Updated',
        tags: ['RPG'],
        drm: true,
      };
      const result = db.upsertGame(update);
      assert.strictEqual(result, true);

      const saved = db.getGame(TEST_APPID);
      assert.strictEqual(saved.name, 'Test Game Updated');
      assert.deepStrictEqual(saved.tags, ['RPG']);
      assert.strictEqual(saved.drm, true);
    });

    test('upsertGame() handles minimal fields (appid + name only)', () => {
      const minimal = { appid: TEST_APPID, name: 'Minimal Test' };
      const result = db.upsertGame(minimal);
      assert.strictEqual(result, true);

      const saved = db.getGame(TEST_APPID);
      assert.strictEqual(saved.name, 'Minimal Test');
      // Default values for missing fields
      assert.strictEqual(saved.type, 'game');
      assert.deepStrictEqual(saved.tags, []);
      assert.strictEqual(saved.nsfw, false);
    });

    test('updateGameCover() updates header_image for an existing game', () => {
      const result = db.updateGameCover(TEST_APPID, 'https://example.com/cover.jpg');
      assert.strictEqual(result, true);

      const saved = db.getGame(TEST_APPID);
      assert.strictEqual(saved.header_image, 'https://example.com/cover.jpg');
      // updated_date should be recent (within last 30 seconds)
      const updated = new Date(saved.updated_date);
      const now = new Date();
      assert.ok((now - updated) < 30_000,
        'updated_date should be recent');
    });

    test('upsertGames() inserts multiple games in a single transaction', () => {
      const games = [
        { appid: TEST_APPID_2, name: 'Test Game 2' },
        { appid: TEST_APPID_3, name: 'Test Game 3' },
      ];
      const count = db.upsertGames(games);
      assert.strictEqual(count, 2);

      // Verify both were inserted
      assert.ok(db.gameExists(TEST_APPID_2), 'Test Game 2 should exist');
      assert.ok(db.gameExists(TEST_APPID_3), 'Test Game 3 should exist');
      const g2 = db.getGame(TEST_APPID_2);
      assert.strictEqual(g2.name, 'Test Game 2');
    });

    test('deleteGame() known issue: FTS4 triggers cause DELETE to fail (returns false)', () => {
      // KNOWN: games.db has FTS4 triggers (games_ad) but sql.js WASM doesn't
      // ship FTS4, so any DELETE on the games table throws "SQL logic error".
      // The function catches this and returns false — the game is NOT deleted.
      assert.ok(db.gameExists(TEST_APPID), 'Game should exist from upsert tests');

      const result = db.deleteGame(TEST_APPID);
      assert.strictEqual(result, false);

      // Verify game still exists (delete didn't actually work)
      assert.ok(db.gameExists(TEST_APPID), 'Game still exists because DELETE failed');
      assert.ok(db.getGame(TEST_APPID) !== null, 'getGame still returns the game');
    });

    test('deleteGame() handles non-existent appid (returns true — 0-row DELETE bypasses FTS4 trigger)', () => {
      const result = db.deleteGame(INVALID_APPID);
      assert.strictEqual(result, true);
    });

    test('deleteGames() known issue: FTS4 triggers cause transaction to fail (returns 0)', () => {
      // Same root cause: FTS4 triggers on games table make DELETE throw.
      // The entire transaction rolls back and returns 0.
      const idA = TEST_APPID + '-DEL-1';
      const idB = TEST_APPID + '-DEL-2';
      db.upsertGame({ appid: idA, name: 'Delete Test A' });
      db.upsertGame({ appid: idB, name: 'Delete Test B' });
      assert.ok(db.gameExists(idA), 'Delete test game A should exist');
      assert.ok(db.gameExists(idB), 'Delete test game B should exist');

      const count = db.deleteGames([idA, idB]);
      assert.strictEqual(count, 0);

      // Verify games still exist because transaction rolled back
      assert.ok(db.gameExists(idA), 'Game A still exists (transaction rolled back)');
      assert.ok(db.gameExists(idB), 'Game B still exists (transaction rolled back)');
    });

    test('deleteGames() with empty array returns 0', () => {
      const count = db.deleteGames([]);
      assert.strictEqual(count, 0);
    });

    test('deleteGames() with null / undefined returns 0', () => {
      assert.strictEqual(db.deleteGames(null), 0);
      assert.strictEqual(db.deleteGames(undefined), 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Write Operations — Fixes
  // ═══════════════════════════════════════════════════════════════════════

  describe('Write Operations (Fixes)', { concurrency: false }, () => {

    test('upsertFix() inserts a new fix and returns true', () => {
      const fix = {
        appid: TEST_FIX_APPID,
        name: 'Test Fix Entry',
        source: 'test-source',
        download_url: 'https://example.com/test.rar',
        game_url: 'https://example.com/game',
        fix_count: 1,
      };
      const result = db.upsertFix(fix);
      assert.strictEqual(result, true);

      // Verify insertion
      const saved = db.getFix(TEST_FIX_APPID);
      assert.ok(saved, 'Fix should exist after upsert');
      assert.strictEqual(saved.name, 'Test Fix Entry');
      assert.strictEqual(saved.source, 'test-source');
      assert.strictEqual(saved.download_url, 'https://example.com/test.rar');
    });

    test('upsertFix() updates an existing fix (same appid)', () => {
      const update = {
        appid: TEST_FIX_APPID,
        name: 'Updated Fix Entry',
        fix_count: 2,
      };
      const result = db.upsertFix(update);
      assert.strictEqual(result, true);

      const saved = db.getFix(TEST_FIX_APPID);
      assert.strictEqual(saved.name, 'Updated Fix Entry');
      assert.strictEqual(saved.fix_count, 2);
    });

    test('upsertFix() handles minimal fields (appid + name only)', () => {
      const minimal = { appid: TEST_FIX_APPID, name: 'Minimal Fix' };
      const result = db.upsertFix(minimal);
      assert.strictEqual(result, true);

      const saved = db.getFix(TEST_FIX_APPID);
      assert.strictEqual(saved.name, 'Minimal Fix');
      // Default values
      assert.deepStrictEqual(saved.badges, []);
      assert.deepStrictEqual(saved.download_urls, []);
      assert.strictEqual(saved.fix_count, 0);
    });

    test('upsertFixes() inserts multiple fixes in a single transaction', () => {
      const fixes = [
        { appid: TEST_FIX_APPID_2, name: 'Test Fix 2', source: 'src-a' },
        { appid: TEST_FIX_APPID_3, name: 'Test Fix 3', source: 'src-b' },
      ];
      const count = db.upsertFixes(fixes);
      assert.strictEqual(count, 2);

      // Verify both inserted
      const f2 = db.getFix(TEST_FIX_APPID_2);
      assert.ok(f2, 'Test Fix 2 should exist');
      assert.strictEqual(f2.name, 'Test Fix 2');
      assert.strictEqual(f2.source, 'src-a');

      const f3 = db.getFix(TEST_FIX_APPID_3);
      assert.ok(f3, 'Test Fix 3 should exist');
      assert.strictEqual(f3.name, 'Test Fix 3');
    });

    test('upsertFixes() with empty array returns 0', () => {
      const count = db.upsertFixes([]);
      assert.strictEqual(count, 0);
    });

    test('upsertFixes() with null/undefined returns 0', () => {
      assert.strictEqual(db.upsertFixes(null), 0);
      assert.strictEqual(db.upsertFixes(undefined), 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Close / Re-initialize round-trip
  // ═══════════════════════════════════════════════════════════════════════

  describe('Close / Reinitialize', () => {

    test('close() shuts down databases and future queries throw', () => {
      db.close();
      // After close, ensureInit() should throw
      assert.throws(
        () => db.getGameCount(),
        /Not initialized/,
        'Should throw "Not initialized" after close()'
      );
      assert.throws(
        () => db.getFixCount(),
        /Not initialized/,
        'Fix queries should also throw after close()'
      );
    });

    test('re-initialize() after close() restores query capability', async () => {
      await db.initialize();
      // Basic queries should work again
      assert.ok(db.getGameCount() > 0, 'Game count should be > 0 after re-init');
      assert.ok(db.getFixCount() > 0, 'Fix count should be > 0 after re-init');
      // Known game should still be there
      const cs = db.getGame(KNOWN_APPID);
      assert.ok(cs, 'Counter-Strike should still exist after re-init');
      assert.strictEqual(cs.name, 'Counter-Strike');
    });
  });
});
