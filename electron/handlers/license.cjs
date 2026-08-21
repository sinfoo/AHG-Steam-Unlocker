// ── License system (GitHub Gist-based activation) ──
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { ipcMain, app, BrowserWindow } = require('electron');
const { secrets } = require('../utils/secrets.cjs');
const { DISCORD_INVITE_URL } = require('./discord.cjs');

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

// Resolves the license registry, or `null` when it could not be read.
// The null/{} distinction is load-bearing: an empty object means "the registry
// is genuinely empty" (every key revoked), while null means "we don't know".
// Returning {} on failure previously made every offline start look like a
// revocation and deleted the local license.
function fetchLicenses() {
  return new Promise((resolve) => {
    const url = `https://api.github.com/gists/${secrets.licenseGistId}`;
    // Deliberately unauthenticated. A secret gist is readable by anyone with the
    // id, so verification needs no token — and sending one only adds failure
    // modes: rotating or revoking it 401s every shipped build at once, and the
    // 5k/hr quota is shared by every customer. Unauthenticated reads get 60/hr
    // per IP instead, which is per-machine. The token stays on the PATCH below,
    // which genuinely needs write access.
    const options = {
      headers: {
        'User-Agent': 'AHG-Steam-Unlocker',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 15000,
    };
    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.warn('[LICENSE] Gist fetch failed — HTTP', res.statusCode);
          return resolve(null);
        }
        try {
          const json = JSON.parse(data);
          const file = json.files?.['license_keys.json'];
          if (!file) {
            console.warn('[LICENSE] Gist has no license_keys.json file');
            return resolve(null);
          }
          if (file.truncated && file.raw_url) {
            return fetchRaw(file.raw_url).then(resolve);
          }
          resolve(JSON.parse(file.content || '{}'));
        } catch (e) {
          console.warn('[LICENSE] Gist parse error:', e.message);
          resolve(null);
        }
      });
    });
    req.on('timeout', () => { req.destroy(); });
    req.on('error', (e) => {
      console.warn('[LICENSE] Gist fetch network error:', e.message);
      resolve(null);
    });
  });
}

// Gist responses inline only the first 1 MB of a file; past that the content is
// truncated and must be pulled from raw_url. At ~50 bytes/key that is ~20k keys
// away, but a truncated read would otherwise look like a mass revocation.
function fetchRaw(rawUrl) {
  return new Promise((resolve) => {
    https.get(rawUrl, { headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function updateGist(licenses) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      description: 'AHG License Keys',
      files: { 'license_keys.json': { content: JSON.stringify(licenses, null, 2) } }
    });
    const options = {
      hostname: 'api.github.com',
      path: `/gists/${secrets.licenseGistId}`,
      method: 'PATCH',
      headers: {
        'Authorization': `token ${secrets.githubToken}`,
        'User-Agent': 'AHG-Steam-Unlocker',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          // 404 here almost always means the token cannot write this gist
          // (wrong account, or missing the `gist` scope) rather than a missing gist.
          console.error('[LICENSE] Gist update failed — HTTP', res.statusCode, '|', data.slice(0, 200));
        }
        resolve(res.statusCode === 200);
      });
    });
    req.on('error', (e) => {
      console.error('[LICENSE] Gist update network error:', e.message);
      resolve(false);
    });
    req.write(postData);
    req.end();
  });
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
      const gistLicenses = await fetchLicenses();
      if (gistLicenses === null) {
        console.warn('[LICENSE] Registry unreachable — falling back to local validation');
      } else {
        const key = local.licenseKey;
        const gistMachineId = key ? gistLicenses[key] : undefined;
        if (gistMachineId === undefined) {
          console.log('[LICENSE] License key removed from Gist — revoking');
          try { if (fs.existsSync(LICENSE_FILE)) fs.unlinkSync(LICENSE_FILE); } catch (e) {
            console.error('[LICENSE] Failed to delete revoked license file:', e.message);
          }
          return { activated: false };
        }
        if (gistMachineId === 'pending' || gistMachineId === currentMachineId) {
          gistValidated = true;
        }
      }
      if (gistValidated || local.machineId === currentMachineId) {
        // Gist validated the current machine but the local file holds a stale id
        // (e.g. rebind after a seller reset) — refresh it so offline validation
        // keeps working on the next start.
        if (local.machineId !== currentMachineId) {
          saveLocalLicense(local.licenseKey, currentMachineId);
        }
        console.log('[MAIN] License validated for machine:', currentMachineId);
        return { activated: true, machineId: currentMachineId };
      }
      console.log('[MAIN] Machine ID mismatch - re-activation required');
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
      const licenses = await fetchLicenses();
      if (licenses === null) {
        // Must not be reported as "invalid" — the key may well be fine and we
        // simply could not read the registry.
        return { success: false, error: 'network', message: 'Could not reach the license server. Check your connection and try again.' };
      }
      const key = licenseKey.trim().toUpperCase();
      const registeredMachine = licenses[key];
      if (registeredMachine === undefined) {
        return { success: false, error: 'invalid', message: 'Invalid License Key' };
      }
      // 'used' is written by the seller-side tooling, never by the app — surface it
      // distinctly instead of the misleading "another device" message.
      if (registeredMachine === 'used') {
        return { success: false, error: 'used', message: 'This key is marked as used in the registry. Contact support to have it reset.' };
      }
      if (registeredMachine && registeredMachine !== 'pending' && registeredMachine !== machineId) {
        return { success: false, error: 'already_activated', message: 'License Already Activated on Another Device' };
      }
      licenses[key] = machineId;
      const updated = await updateGist(licenses);
      if (!updated) {
        return { success: false, error: 'network', message: 'Failed to update license' };
      }
      const saved = saveLocalLicense(key, machineId);
      if (!saved) {
        // The key is bound in the Gist but nothing persisted locally — without this
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
