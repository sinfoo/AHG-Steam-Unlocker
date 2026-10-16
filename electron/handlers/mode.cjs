// ── Unlock backend mode (SteamTools / BetterSteamTools / Custom) ──
// BetterSteamTools = madoiscool/BetterSteamTools (OpenSteamTool fork): proxy DLLs in the Steam root.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const { app, ipcMain } = require('electron');
const AdmZip = require('adm-zip');
const { findSteamPath } = require('../utils/steamUtils.cjs');

const REPO = 'madoiscool/BetterSteamTools';
const TOML_URL = `https://raw.githubusercontent.com/${REPO}/refs/heads/updates/opensteamtool/latest.toml`;
const DLLS = ['OpenSteamTool.dll', 'dwmapi.dll', 'xinput1_4.dll'];
const MODES = ['steamtools', 'bst', 'custom'];
const BAK = '.ahg-bak';
const MAX_ZIP = 20 * 1024 * 1024;
const stateFile = () => path.join(app.getPath('userData'), 'unlock_mode.json');

function readState() {
  try { return { mode: 'steamtools', ...JSON.parse(fs.readFileSync(stateFile(), 'utf8')) }; } catch { return { mode: 'steamtools' }; }
}
function writeState(s) {
  const tmp = stateFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(s));
  fs.renameSync(tmp, stateFile());
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sha256File = (p) => { try { return sha256(fs.readFileSync(p)); } catch { return null; } };

async function getText(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

async function fetchLatest() {
  const toml = await getText(TOML_URL);
  const version = /^version\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
  const hash = /^sha256\s*=\s*"([0-9a-f]{64})"/m.exec(toml)?.[1];
  // version feeds a URL path: allow only vX.Y.Z-style tags
  if (!version || !hash || !/^v?\d+(\.\d+){1,3}$/.test(version)) throw new Error('Bad latest.toml');
  return { version, hash };
}

function steamRunning() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq steam.exe', '/NH'], { windowsHide: true }, (e, out) =>
      resolve(!e && /steam\.exe/i.test(out || '')));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args) => new Promise((r) => execFile(cmd, args, { windowsHide: true }, () => r()));

// Graceful shutdown first (lets Steam flush its config), force-kill if it hangs.
async function closeSteam(steam) {
  if (!(await steamRunning())) return false;
  spawn(path.join(steam, 'steam.exe'), ['-shutdown'], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 30 && (await steamRunning()); i++) await sleep(500);
  if (await steamRunning()) await run('taskkill', ['/F', '/T', '/IM', 'steam.exe']);
  for (let i = 0; i < 10 && (await steamRunning()); i++) await sleep(300);
  if (await steamRunning()) throw new Error('Could not close Steam');
  await sleep(800); // let steamwebhelper release DLL handles
  return true;
}

function startSteam(steam) {
  spawn(path.join(steam, 'steam.exe'), [], { detached: true, stdio: 'ignore' }).unref();
}

async function status() {
  const st = readState();
  const steam = findSteamPath();
  const dllHash = steam ? sha256File(path.join(steam, 'OpenSteamTool.dll')) : null;
  const out = { mode: st.mode, installed: !!dllHash, version: st.bstVersion || null, latest: null, updateAvailable: false, steamFound: !!steam };
  try {
    const latest = await fetchLatest();
    out.latest = latest.version;
    out.updateAvailable = !!dllHash && dllHash !== latest.hash;
  } catch (e) { out.error = e.message; }
  return out;
}

async function installBst(steam, progress) {
  progress('downloading');
  const { version, hash } = await fetchLatest();
  const r = await fetch(`https://github.com/${REPO}/releases/download/${version}/OpenSteamTool-${version}-Release.zip`,
    { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`Download failed: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_ZIP) throw new Error('Archive too large');
  const zip = new AdmZip(buf);
  const files = {};
  for (const name of DLLS) {
    const e = zip.getEntry(name); // exact top-level name only: no path traversal
    if (!e) throw new Error(`${name} missing from release`);
    files[name] = e.getData();
  }
  progress('verifying');
  if (sha256(files['OpenSteamTool.dll']) !== hash) throw new Error('OpenSteamTool.dll hash mismatch');
  progress('installing');

  // back up foreign proxy DLLs (e.g. SteamTools' own) once, never overwrite a backup
  for (const name of ['dwmapi.dll', 'xinput1_4.dll']) {
    const p = path.join(steam, name);
    if (fs.existsSync(p) && sha256File(p) !== sha256(files[name]) && !fs.existsSync(p + BAK)) fs.copyFileSync(p, p + BAK);
  }
  for (const name of DLLS) {
    const p = path.join(steam, name);
    fs.writeFileSync(p + '.tmp', files[name]);
    fs.renameSync(p + '.tmp', p);
  }
  writeState({ ...readState(), mode: 'bst', bstVersion: version });
  return { version };
}

function uninstallBst(steam) {
  for (const name of DLLS) {
    const p = path.join(steam, name);
    try { fs.rmSync(p, { force: true }); } catch (e) { throw new Error(`Could not remove ${name}: ${e.message}`); }
    if (fs.existsSync(p + BAK)) fs.renameSync(p + BAK, p);
  }
}

// Full switch: close Steam -> swap files -> start Steam again (only if it was running).
async function switchMode(mode, reinstall, progress) {
  if (!MODES.includes(mode)) throw new Error('Invalid mode');
  const cur = readState();
  if (mode === cur.mode && !reinstall) return {};
  const steam = findSteamPath();
  if (!steam || !fs.existsSync(steam)) throw new Error('Steam not found');
  progress('closing');
  const wasRunning = await closeSteam(steam);
  let out = {};
  try {
    if (mode === 'bst') out = await installBst(steam, progress);
    else {
      if (cur.mode === 'bst') { progress('restoring'); uninstallBst(steam); }
      writeState({ ...cur, mode });
    }
  } finally {
    if (wasRunning) { progress('starting'); startSteam(steam); }
  }
  return out;
}

function registerModeHandlers() {
  const wrap = (fn) => async (_e, ...a) => { try { return { success: true, ...(await fn(...a)) }; } catch (e) { return { success: false, message: e.message }; } };

  ipcMain.handle('get-unlock-mode', wrap(status));
  ipcMain.handle('set-unlock-mode', async (e, mode, reinstall) => {
    const progress = (step) => { if (!e.sender.isDestroyed()) e.sender.send('unlock-mode-progress', step); };
    try { return { success: true, ...(await switchMode(mode, !!reinstall, progress)) }; }
    catch (err) { return { success: false, message: err.message }; }
  });
}

module.exports = { registerModeHandlers };
