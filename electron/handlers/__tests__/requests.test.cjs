// parseAppId accepts what people paste into the request box: an id, or a Steam/SteamDB link.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

// requests.cjs requires electron; only parseAppId is under test, so stub the module.
const realLoad = Module._load;
Module._load = function (name, ...rest) {
  if (name === 'electron') return { app: { getPath: () => require('os').tmpdir() }, ipcMain: { handle() {} } };
  return realLoad.call(this, name, ...rest);
};
const { parseAppId } = require('../requests.cjs');
Module._load = realLoad;

test('parseAppId reads ids and Steam links, rejects everything else', () => {
  assert.equal(parseAppId('1245620'), 1245620);
  assert.equal(parseAppId('  730 '), 730);
  assert.equal(parseAppId('https://store.steampowered.com/app/1245620/ELDEN_RING/'), 1245620);
  assert.equal(parseAppId('https://steamdb.info/app/570/'), 570);
  assert.equal(parseAppId('elden ring'), null);
  assert.equal(parseAppId('0'), null);
  assert.equal(parseAppId('12a'), null);
  assert.equal(parseAppId('99999999999'), null);
  assert.equal(parseAppId('../../x'), null);
});
