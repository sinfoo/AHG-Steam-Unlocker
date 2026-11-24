// Name matching shared by the catalogue search and the request box. Run: node --test src/utils/__tests__
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transformSync } = require('esbuild');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'gameMatch.ts'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', transformSync(src, { loader: 'ts', format: 'cjs' }).code)(mod, mod.exports, require);
const { buildEntry, rankByName } = mod.exports;

const games = ['ELDEN RING', 'ELDEN RING NIGHTREIGN', "Marvel's Spider-Man Remastered", 'CODA', 'Call of Duty®',
  'Cyberpunk 2077', 'Grand Theft Auto V', 'Get To A Gun', 'The Witcher 3: Wild Hunt', 'The Witcher 3: Wild Hunt Soundtrack',
  "Baldur's Gate 3 Toolkit"].map((name, i) => ({ appid: String(i + 1), name }));
const entries = games.map(buildEntry);
const top = (q, pop) => rankByName(games, entries, q, 3, pop).map(g => g.name);

test('finds games the way people type them', () => {
  assert.deepEqual(top('elden ring'), ['ELDEN RING', 'ELDEN RING NIGHTREIGN']);
  assert.equal(top('spiderman')[0], "Marvel's Spider-Man Remastered");
  assert.ok(top('gta').includes('Grand Theft Auto V'));
  assert.deepEqual(top('punk'), []); // mid-word hits stay out
});

test('popular games win close calls; soundtracks and tools never show', () => {
  assert.equal(top('cod', { 5: 0 })[0], 'Call of Duty®'); // appid "5" = Call of Duty, most popular
  assert.deepEqual(top('witcher 3'), ['The Witcher 3: Wild Hunt']);
  assert.deepEqual(top('baldur'), []);
});

test('fix search: multi-word queries with spaces, trademark signs, no junk filter', () => {
  const fixes = ['EA SPORTS FC™ 27', 'EA SPORTS FC™ 26', 'STAR WARS: Galactic Racer™', 'NBA 2K27',
    'Demon Slayer -Kimetsu no Yaiba- The Hinokami Chronicles 2', 'Phantom Blade Zero'].map((name, i) => ({ appid: String(i + 1), name }));
  const fe = fixes.map(buildEntry);
  const find = q => rankByName(fixes, fe, q, Infinity, {}, false).map(g => g.name);
  assert.equal(find('fc 27')[0], 'EA SPORTS FC™ 27');
  assert.equal(find('star wars racer')[0], 'STAR WARS: Galactic Racer™');
  assert.equal(find('nba 2k')[0], 'NBA 2K27');
  assert.equal(find('demon slayer')[0], 'Demon Slayer -Kimetsu no Yaiba- The Hinokami Chronicles 2');
  assert.equal(find('phantom blade')[0], 'Phantom Blade Zero');
});
