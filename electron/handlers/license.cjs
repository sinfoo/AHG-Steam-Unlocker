// ── License system (GitHub Gist-based activation) ──
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ipcMain, app, BrowserWindow } = require('electron');
const { botApi } = require('../utils/botApi.cjs');
const { secrets } = require('../utils/secrets.cjs');
// Community/support invite link (overridable from secrets.json when an invite expires).
const DISCORD_INVITE_URL = 'https://discord.gg/' + (secrets.discordInvite || 'GGB4TzDxY9');

const LICENSE_FILE = path.join(app.getPath('userData'), 'ahg_license.json');
const MACHINE_ID_FILE = path.join(app.getPath('userData'), 'ahg_machine_id.json');

// Get or create persistent machine ID
function getMachineId() {
  try {
    if (fs.existsSync(MACHINE_ID_FILE)) {
      const saved = JSON.parse(fs.readFileSync(MACHINE_ID_FILE, 'utf-8'));
      if (saved && saved.machineId && saved.created) {
        return saved.machineId;
      }
    }
  } catch (e) {
    console.error('[LICENSE] Error reading machine ID file:', e.message);
  }

  // Machine-id file lost or corrupt: recover the identity the license was activated
  // with BEFORE re-probing hardware. Re-probing can yield a different id than the one
  // bound in the Gist (flaky CIM, cleared AppData), and any new id makes every restart
  // ask for the key again and re-activation fail with "activated on another device".
  const local = loadLocalLicense();
  if (local && local.machineId) {
    persistMachineId(local.machineId, 'license-recovery');
    return local.machineId;
  }

  const hardwareId = readHardwareUuid();
  if (hardwareId) {
    persistMachineId(hardwareId, 'hardware');
    return hardwareId;
  }

  const persistentId = 'AHG-' + crypto.randomBytes(16).toString('hex');
  persistMachineId(persistentId, 'generated');
  return persistentId;
}

// Some OEMs report a placeholder UUID identical across every unit they ship —
// binding a license to one of those would let every such machine share a key.
const BOGUS_UUIDS = new Set([
  '00000000-0000-0000-0000-000000000000',
  'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
  '03000200-0400-0500-0006-000700080009',
]);

function readHardwareUuid() {
  const { execSync } = require('child_process');
  // `wmic` was removed in Windows 11 24H2+, so CIM is tried first and wmic is
  // only a fallback for older builds. Without this, every modern machine fell
  // through to the random 'AHG-…' id, which resets whenever AppData is cleared.
  const probes = [
    ['CIM', 'powershell -NoProfile -NonInteractive -Command "(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID"'],
    ['wmic', 'wmic csproduct get uuid'],
  ];
  for (const [label, cmd] of probes) {
    try {
      const out = execSync(cmd, { encoding: 'utf-8', timeout: 10000, windowsHide: true });
      for (const line of out.trim().split(/\r?\n/)) {
        const id = line.trim();
        if (/^[0-9A-Fa-f-]{8,}$/.test(id) && id.length > 5 && !BOGUS_UUIDS.has(id.toUpperCase())) {
          console.log('[LICENSE] Hardware UUID resolved via', label);
          return id.toUpperCase();
        }
      }
    } catch (e) {
      console.warn('[LICENSE] Hardware UUID probe failed (' + label + '):', e.message);
    }
  }
  return null;
}

// Atomic write (tmp + rename) — a crash mid-write must not corrupt the identity
// files; a half-written JSON here is what caused machine-id drift on restart.
function writeJsonAtomic(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

function persistMachineId(machineId, source) {
  try {
    writeJsonAtomic(MACHINE_ID_FILE, { machineId, source, created: new Date().toISOString() });
  } catch (e) {
    console.error('[LICENSE] Error persisting machine ID:', e.message);
  }
}

// Same rules as the bot's _license_status: missing | used | pending | bound | other.
function keyStatus(licenses, key, machineId) {
  const value = licenses[key];
  if (value === undefined) return 'missing';
  if (value === 'used' || value === 'pending') return value;
  return value === machineId ? 'bound' : 'other';
}

const GIST_HEADERS = { 'User-Agent': 'AHG-Steam-Unlocker', Accept: 'application/vnd.github.v3+json' };

// Reads license_keys.json from the gist, or null when it could not be read.
// Unauthenticated on purpose: a secret gist is readable with its id, and a read
// must keep working even if the bundled token is revoked.
async function readLicenseGist() {
  try {
    const res = await fetch(`https://api.github.com/gists/${secrets.licenseGistId}`,
      { headers: GIST_HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) { console.warn('[LICENSE] Gist read failed — HTTP', res.status); return null; }
    const file = (await res.json()).files?.['license_keys.json'];
    if (!file) return null;
    // Content past 1 MB is truncated inline; a partial read would look like revocations.
    const text = file.truncated
      ? await (await fetch(file.raw_url, { signal: AbortSignal.timeout(15000) })).text()
      : file.content;
    return JSON.parse(text || '{}');
  } catch (e) {
    console.warn('[LICENSE] Gist read error:', e.message);
    return null;
  }
}

// Direct gist flow (as in v1.2.3): works on any PC without the bot being online.
// ponytail: read-modify-write of the whole file, so two activations in the same few
// seconds can overwrite each other (the loser is asked for its key again on next start).
// Move writes behind an always-on server if that ever shows up in practice.
async function gistLicenseApi(action, key, machineId) {
  const licenses = await readLicenseGist();
  if (licenses === null) return null;
  const status = keyStatus(licenses, key, machineId);
  if (action !== 'activate' || status !== 'pending') return status;
  licenses[key] = machineId;
  try {
    const res = await fetch(`https://api.github.com/gists/${secrets.licenseGistId}`, {
      method: 'PATCH',
      headers: { ...GIST_HEADERS, Authorization: `token ${secrets.githubToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { 'license_keys.json': { content: JSON.stringify(licenses, null, 2) } } }),
      signal: AbortSignal.timeout(20000),
    });
    // 404 here means the token cannot write this gist (wrong account or no `gist` scope).
    if (!res.ok) { console.error('[LICENSE] Gist update failed — HTTP', res.status); return null; }
    return 'bound';
  } catch (e) {
    console.error('[LICENSE] Gist update error:', e.message);
    return null;
  }
}

// Asks the registry about ONE key: straight from the gist when this build carries
// licenseGistId + githubToken, otherwise through the Discord bot's license API.
// Returns 'missing' | 'pending' | 'used' | 'bound' | 'other', or null when the
// registry could not be reached. null means "unknown" — callers must never treat it
// as a revocation (offline starts used to delete valid licenses that way).
async function licenseApi(action, key, machineId) {
  if (secrets.licenseGistId && secrets.githubToken) return gistLicenseApi(action, key, machineId);
  const res = await botApi(`license/${action}`, { key, machineId });
  if (!res || !res.ok) return null;
  const status = res.data && res.data.status;
  return typeof status === 'string' ? status : null;
}

function loadLocalLicense() {
  try {
    if (fs.existsSync(LICENSE_FILE)) {
      return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[LICENSE] Error loading local license:', e.message);
  }
  return null;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function getCodeIntegrityHash() {
  try {
    const mainPath = __filename;
    const content = fs.readFileSync(mainPath, 'utf-8');
    return simpleHash(content);
  } catch (e) { return 'unknown'; }
}

function saveLocalLicense(licenseKey, machineId) {
  try {
    const integrityHash = getCodeIntegrityHash();
    const version = require('../../package.json').version;
    writeJsonAtomic(LICENSE_FILE, {
      licenseKey, machineId, activated: true,
      date: new Date().toISOString(), integrityHash, version
    });
    return true;
  } catch (e) { return false; }
}

function registerLicenseHandlers() {
  ipcMain.handle('check-license', async () => {
    try {
      // Dev mode — bypass license check.
      // NOTE: do NOT key off the exe path. The packaged build ships in `dev-release\win-unpacked`,
      // so `process.execPath.includes('dev-release')` matched the real app and silently bypassed
      // activation entirely. Only genuine dev launches (unpackaged / --dev / NODE_ENV) bypass.
      if (!app.isPackaged || process.argv.includes('--dev') || process.env.NODE_ENV === 'development') {
        return { activated: true };
      }
      const local = loadLocalLicense();
      const currentMachineId = getMachineId();
      if (!local || !local.activated || !local.machineId) {
        return { activated: false };
      }
      // Fetch Gist to verify key still registered (seller can revoke by removing the key).
      // Only an authoritative read may revoke — a failed read (offline, rate limited,
      // GitHub down) must fall through to local validation, never delete the license.
      let gistValidated = false;
      const status = local.licenseKey ? await licenseApi('check', local.licenseKey, currentMachineId) : 'missing';
      if (status === null) {
        console.warn('[LICENSE] Registry unreachable — falling back to local validation');
      } else if (status === 'missing') {
        console.log('[LICENSE] License key removed from registry — revoking');
        try { if (fs.existsSync(LICENSE_FILE)) fs.unlinkSync(LICENSE_FILE); } catch (e) {
          console.error('[LICENSE] Failed to delete revoked license file:', e.message);
        }
        return { activated: false };
      } else if (status === 'pending' || status === 'bound') {
        gistValidated = true;
      }
      // 'other' / 'used': an authoritative answer that this machine may not use the key.
      // gistValidated stays false and we must NOT fall through to the local-file match.
      const gistLicenses = status === null ? null : true;
      // Trust the local file only when we could NOT reach the registry (offline).
      // When the read succeeded, the registry is the source of truth.
      if (gistValidated || (gistLicenses === null && local.machineId === currentMachineId)) {
        // Gist validated the current machine but the local file holds a stale id
        // (e.g. rebind after a seller reset) — refresh it so offline validation
        // keeps working on the next start.
        if (gistValidated && local.machineId !== currentMachineId) {
          saveLocalLicense(local.licenseKey, currentMachineId);
        }
        console.log('[MAIN] License validated for machine:', currentMachineId);
        return { activated: true, machineId: currentMachineId };
      }
      console.log('[MAIN] License bound elsewhere or machine mismatch - re-activation required');
      return { activated: false, machineMismatch: true };
    } catch (e) {
      console.error('[MAIN] License check error:', e);
      return { activated: false };
    }
  });

  ipcMain.handle('activate-license', async (event, licenseKey) => {
    try {
      if (typeof licenseKey !== 'string' || !licenseKey.trim()) {
        return { success: false, error: 'invalid', message: 'Please enter a license key' };
      }
      const machineId = getMachineId();
      const key = licenseKey.trim().toUpperCase();
      // The bot binds a 'pending' key to this machine atomically and returns the result.
      const status = await licenseApi('activate', key, machineId);
      if (status === null) {
        // Must not be reported as "invalid" — the key may well be fine.
        return { success: false, error: 'network', message: 'Could not reach the license server. Check your connection and try again.' };
      }
      if (status === 'missing') {
        return { success: false, error: 'invalid', message: 'Invalid License Key' };
      }
      if (status === 'used') {
        return { success: false, error: 'used', message: 'This key is marked as used in the registry. Contact support to have it reset.' };
      }
      if (status !== 'bound') {
        return { success: false, error: 'already_activated', message: 'License Already Activated on Another Device' };
      }
      const saved = saveLocalLicense(key, machineId);
      if (!saved) {
        // The key is bound in the registry but nothing persisted locally — without this
        // warning the user is silently asked for the key again on every restart.
        console.error('[LICENSE] Activation succeeded but local license save failed');
        return { success: true, message: 'Activated, but saving locally failed — you may be asked for the key again on next start.' };
      }
      return { success: true, message: 'Activation Successful!' };
    } catch (e) {
      return { success: false, error: 'network', message: 'Network Error: ' + e.message };
    }
  });

  ipcMain.handle('deactivate-license', async () => {
    try {
      let deletedLicense = false;
      if (fs.existsSync(LICENSE_FILE)) { fs.unlinkSync(LICENSE_FILE); deletedLicense = true; }
      // The machine ID is deliberately kept. It is this machine's identity, not the
      // license — deleting it changed the fingerprint, so re-entering the same key on
      // the same PC was rejected as "already activated on another device".
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('license-state-changed', { activated: false });
      });
      console.log('[MAIN] License deactivated — license file removed:', deletedLicense);
      return { success: true, message: 'License removed.' };
    } catch (e) {
      console.error('[MAIN] Deactivation error:', e);
      return { success: false, message: 'Failed to remove license: ' + e.message };
    }
  });

  ipcMain.handle('get-support-link', () => {
    return DISCORD_INVITE_URL;
  });
}

module.exports = { registerLicenseHandlers };
