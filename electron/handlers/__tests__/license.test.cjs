/**
 * license.test.cjs — revocation decision table for electron/handlers/license.cjs
 *
 * Guards the branch that DELETES a customer's local license. It previously fired
 * whenever the registry could not be read (offline, rate limited, GitHub down),
 * because fetchLicenses() returned {} for both "empty registry" and "read failed".
 *
 * Uses node:test + Module._resolveFilename interception, same as imageNative.test.cjs.
 *
 * Run with: node --test electron/handlers/__tests__/license.test.cjs
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

const MODULE_PATH = path.resolve(__dirname, '../license.cjs');
const ELEC_MOCK_ID = path.resolve(__dirname, '.license-elec-mock.cjs');
const SECRETS_MOCK_ID = path.resolve(__dirname, '.license-secrets-mock.cjs');
const DISCORD_MOCK_ID = path.resolve(__dirname, '.license-discord-mock.cjs');
const HTTPS_MOCK_ID = path.resolve(__dirname, '.license-https-mock.cjs');

const THIS_MACHINE = 'C48FB794-6144-F046-9B36-DA552A4270A6';
const OTHER_MACHINE = 'AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB';
const KEY = '556909806582235177';

let handlers;
let fakeFiles;      // virtual userData filesystem
let gistResponse;   // { status, body } returned by the mocked https.get
let writeStatus;    // HTTP status returned by the mocked https.request (gist PATCH)

function stub(id, exports) {
  require.cache[id] = { id, filename: id, loaded: true, exports, paths: [], children: [] };
}

function setupMocks() {
  handlers = {};
  fakeFiles = {};
  writeStatus = 200;

  stub(ELEC_MOCK_ID, {
    ipcMain: { handle: (channel, fn) => { handlers[channel] = fn; } },
    app: { getPath: () => '/userData', isPackaged: true },
    BrowserWindow: { getAllWindows: () => [] },
  });
  stub(SECRETS_MOCK_ID, { secrets: { licenseGistId: 'gist123', githubToken: 'tok' } });
  stub(DISCORD_MOCK_ID, { DISCORD_INVITE_URL: 'https://discord.gg/TEST' });

  // Minimal https that replays `gistResponse` for reads and `writeStatus` for writes.
  stub(HTTPS_MOCK_ID, {
    get(_url, _opts, cb) {
      const res = {
        statusCode: gistResponse.status,
        on(evt, fn) {
          if (evt === 'data' && gistResponse.body != null) fn(gistResponse.body);
          if (evt === 'end') setImmediate(fn);
          return res;
        },
      };
      const req = { on(evt, fn) { if (evt === 'error' && gistResponse.networkError) setImmediate(() => fn(new Error('ENOTFOUND'))); return req; }, destroy() {} };
      if (!gistResponse.networkError) setImmediate(() => cb(res));
      return req;
    },
    request(_opts, cb) {
      const res = {
        statusCode: writeStatus,
        on(evt, fn) {
          if (evt === 'data') fn('{}');
          if (evt === 'end') setImmediate(fn);
          return res;
        },
      };
      setImmediate(() => cb(res));
      return { on() { return this; }, write() {}, end() {} };
    },
  });

  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain) {
    if (request === 'electron') return ELEC_MOCK_ID;
    if (request === 'https') return HTTPS_MOCK_ID;
    if (request === '../utils/secrets.cjs') return SECRETS_MOCK_ID;
    if (request === './discord.cjs') return DISCORD_MOCK_ID;
    return origResolve.call(this, request, parent, isMain);
  };

  // Virtual fs so the test never touches a real license file.
  const fs = require('fs');
  const orig = {
    existsSync: fs.existsSync, readFileSync: fs.readFileSync,
    writeFileSync: fs.writeFileSync, unlinkSync: fs.unlinkSync,
    renameSync: fs.renameSync,
  };
  const isFake = p => typeof p === 'string' && p.includes('userData');
  fs.existsSync = p => (isFake(p) ? p in fakeFiles : orig.existsSync(p));
  fs.readFileSync = (p, e) => (isFake(p) ? fakeFiles[p] : orig.readFileSync(p, e));
  fs.writeFileSync = (p, d) => (isFake(p) ? (fakeFiles[p] = d) : orig.writeFileSync(p, d));
  fs.unlinkSync = p => (isFake(p) ? delete fakeFiles[p] : orig.unlinkSync(p));
  fs.renameSync = (a, b) => { if (isFake(a)) { fakeFiles[b] = fakeFiles[a]; delete fakeFiles[a]; } else orig.renameSync(a, b); };

  delete require.cache[MODULE_PATH];
  require(MODULE_PATH).registerLicenseHandlers();

  return function restore() {
    Object.assign(fs, orig);
    [ELEC_MOCK_ID, SECRETS_MOCK_ID, DISCORD_MOCK_ID, HTTPS_MOCK_ID, MODULE_PATH]
      .forEach(id => delete require.cache[id]);
    Module._resolveFilename = origResolve;
  };
}

const licensePath = path.join('/userData', 'ahg_license.json');
const machinePath = path.join('/userData', 'ahg_machine_id.json');

function givenActivatedOn(machineId) {
  fakeFiles[machinePath] = JSON.stringify({ machineId: THIS_MACHINE, source: 'hardware', created: 'x' });
  fakeFiles[licensePath] = JSON.stringify({ licenseKey: KEY, machineId, activated: true });
}

function givenRegistry(obj) {
  gistResponse = { status: 200, body: JSON.stringify({ files: { 'license_keys.json': { content: JSON.stringify(obj) } } }) };
}

let restore;
beforeEach(() => { restore = setupMocks(); });
afterEach(() => restore());

describe('check-license — revocation decision table', () => {
  test('registry unreachable (network error) does NOT delete the license', async () => {
    givenActivatedOn(THIS_MACHINE);
    gistResponse = { networkError: true };

    const result = await handlers['check-license']();

    assert.equal(result.activated, true, 'offline start must stay activated');
    assert.ok(licensePath in fakeFiles, 'license file must survive an unreachable registry');
  });

  test('registry returns HTTP 500 does NOT delete the license', async () => {
    givenActivatedOn(THIS_MACHINE);
    gistResponse = { status: 500, body: 'upstream error' };

    const result = await handlers['check-license']();

    assert.equal(result.activated, true);
    assert.ok(licensePath in fakeFiles, 'a 5xx must not be read as a revocation');
  });

  test('registry rate-limited (HTTP 403) does NOT delete the license', async () => {
    givenActivatedOn(THIS_MACHINE);
    gistResponse = { status: 403, body: '{"message":"rate limit exceeded"}' };

    const result = await handlers['check-license']();

    assert.equal(result.activated, true);
    assert.ok(licensePath in fakeFiles);
  });

  test('malformed registry body does NOT delete the license', async () => {
    givenActivatedOn(THIS_MACHINE);
    gistResponse = { status: 200, body: 'not json at all' };

    const result = await handlers['check-license']();

    assert.equal(result.activated, true);
    assert.ok(licensePath in fakeFiles);
  });

  test('key genuinely removed from a readable registry DOES revoke', async () => {
    givenActivatedOn(THIS_MACHINE);
    givenRegistry({ '999': 'pending' });   // our key is gone

    const result = await handlers['check-license']();

    assert.equal(result.activated, false, 'a real revocation must still take effect');
    assert.ok(!(licensePath in fakeFiles), 'revoked license file must be deleted');
  });

  test('empty registry (everything revoked) DOES revoke', async () => {
    givenActivatedOn(THIS_MACHINE);
    givenRegistry({});

    const result = await handlers['check-license']();

    assert.equal(result.activated, false);
    assert.ok(!(licensePath in fakeFiles));
  });

  test('key bound to this machine stays activated', async () => {
    givenActivatedOn(THIS_MACHINE);
    givenRegistry({ [KEY]: THIS_MACHINE });

    const result = await handlers['check-license']();

    assert.equal(result.activated, true);
    assert.ok(licensePath in fakeFiles);
  });

  test('key still pending stays activated', async () => {
    givenActivatedOn(THIS_MACHINE);
    givenRegistry({ [KEY]: 'pending' });

    assert.equal((await handlers['check-license']()).activated, true);
  });

  test('key bound elsewhere reports a machine mismatch without deleting', async () => {
    givenActivatedOn(OTHER_MACHINE);
    givenRegistry({ [KEY]: OTHER_MACHINE });

    const result = await handlers['check-license']();

    assert.equal(result.activated, false);
    assert.equal(result.machineMismatch, true);
    assert.ok(licensePath in fakeFiles, 'mismatch is not revocation — keep the file');
  });

  test('no local license at all is simply not activated', async () => {
    const result = await handlers['check-license']();
    assert.equal(result.activated, false);
  });

  test('key re-bound to another machine deactivates the original machine (no sharing)', async () => {
    // The original machine's local file still matches THIS machine, but an
    // authoritative gist read says the key now belongs to another machine (seller
    // reset + re-activation elsewhere). The original must NOT stay active.
    givenActivatedOn(THIS_MACHINE);            // local.machineId === current
    givenRegistry({ [KEY]: OTHER_MACHINE });   // gist binds the key elsewhere

    const result = await handlers['check-license']();

    assert.equal(result.activated, false, 'must not stay active when re-bound elsewhere');
    assert.ok(licensePath in fakeFiles, 'not a revocation — keep the file for re-activation');
  });

  test('lost machine-id file recovers the identity from the license file', async () => {
    // Machine-id file gone (cleaner/corruption) but the license survives — the id
    // bound in the registry must be recovered, not re-probed into a fresh one.
    fakeFiles[licensePath] = JSON.stringify({ licenseKey: KEY, machineId: 'AHG-deadbeef', activated: true });
    givenRegistry({ [KEY]: 'AHG-deadbeef' });

    const result = await handlers['check-license']();

    assert.equal(result.activated, true, 'identity must be recovered from the license file');
    assert.ok(machinePath in fakeFiles, 'machine-id file must be re-persisted');
    assert.equal(JSON.parse(fakeFiles[machinePath]).machineId, 'AHG-deadbeef');
  });
});

describe('activate-license — input handling', () => {
  test('blank key is rejected as invalid, not as a network error', async () => {
    givenRegistry({ [KEY]: 'pending' });
    const result = await handlers['activate-license'](null, '   ');
    assert.equal(result.success, false);
    assert.equal(result.error, 'invalid');
  });

  test('non-string key does not throw', async () => {
    givenRegistry({ [KEY]: 'pending' });
    const result = await handlers['activate-license'](null, undefined);
    assert.equal(result.success, false);
    assert.equal(result.error, 'invalid');
  });

  test('unreachable registry reports network, never "Invalid License Key"', async () => {
    gistResponse = { networkError: true };
    const result = await handlers['activate-license'](null, KEY);
    assert.equal(result.success, false);
    assert.equal(result.error, 'network', 'a valid key must not be branded invalid when we cannot check it');
  });

  test('pending key activates and binds a real hardware id, not the random fallback', async () => {
    givenRegistry({ [KEY]: 'pending' });
    fakeFiles[machinePath] = undefined;
    delete fakeFiles[machinePath];

    const result = await handlers['activate-license'](null, KEY);

    assert.equal(result.success, true, result.message);
    const saved = JSON.parse(fakeFiles[licensePath]);
    assert.equal(saved.licenseKey, KEY);
    // Regression guard: the hardware probe must actually run. `wmic` was removed in
    // Windows 11 24H2+, and a broken probe silently degrades to a random 'AHG-…' id
    // that changes whenever AppData is cleared, locking customers out.
    assert.ok(
      !saved.machineId.startsWith('AHG-'),
      `expected a hardware UUID but got the random fallback: ${saved.machineId}`
    );
  });

  test("key marked 'used' by seller tooling gets a distinct error, not \"another device\"", async () => {
    givenRegistry({ [KEY]: 'used' });
    const result = await handlers['activate-license'](null, KEY);
    assert.equal(result.success, false);
    assert.equal(result.error, 'used');
  });

  test('registry write rejected (403/404 token) fails loudly and saves nothing', async () => {
    givenRegistry({ [KEY]: 'pending' });
    writeStatus = 404;   // exactly what a wrong-account / wrong-scope token returns

    const result = await handlers['activate-license'](null, KEY);

    assert.equal(result.success, false);
    assert.equal(result.error, 'network');
    assert.ok(!(licensePath in fakeFiles), 'must not cache an activation the registry rejected');
  });
});

describe('deactivate-license', () => {
  test('keeps the machine ID so the same PC can re-activate', async () => {
    givenActivatedOn(THIS_MACHINE);

    await handlers['deactivate-license']();

    assert.ok(!(licensePath in fakeFiles), 'license must be removed');
    assert.ok(machinePath in fakeFiles, 'machine identity must survive deactivation');
  });
});
