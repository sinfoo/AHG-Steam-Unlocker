// pickNewGames decides what the "New games" list shows. Run: node --test src/utils/__tests__
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transformSync } = require('esbuild');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'newGames.ts'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', transformSync(src, { loader: 'ts', format: 'cjs' }).code)(mod, mod.exports, require);
const { pickNewGames } = mod.exports;

const at = (iso) => Date.parse(iso);
const g = (appid, added_date, extra = {}) => ({ appid, name: appid, added_date, type: 'game', ...extra });

test('only Ryuu-dated games added after the baseline, newest first', () => {
  const games = [
    g('old', '2026-11-01T10:00:00.123456+00:00'),
    g('new1', '2026-11-16T10:00:00.123456+00:00'),
    g('new2', '2026-11-17T08:00:00.5+00:00'),
    g('backfilled', '2026-11-17T09:00:00.000Z'),      // DB insert time, not Ryuu's
    g('dlc', '2026-11-17T09:00:00+00:00', { type: 'dlc' }),
    g('nsfw', '2026-11-17T09:00:00+00:00', { nsfw: true }),
    g('nodate', undefined),
  ];
  assert.deepEqual(pickNewGames(games, at('2026-11-10T00:00:00Z')).map(x => x.appid), ['new2', 'new1']);
});

test('first launch (no baseline) shows nothing', () => {
  assert.equal(pickNewGames([g('a', '2026-11-17T08:00:00+00:00')], Number.POSITIVE_INFINITY).length, 0);
});
