// ── Secrets loading — shared by license, and main.cjs orchestrator ──
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let secrets = {};
let secretsDiag = {};

(function loadSecrets() {
  try {
    const rp = (typeof process.resourcesPath !== 'undefined' && process.resourcesPath)
      ? process.resourcesPath
      : '';
    let userDataSecretsPath = '';
    try { userDataSecretsPath = path.join(app.getPath('userData'), 'config', 'secrets.json'); } catch(e) {
      console.error('[SECRETS] Error getting userData secrets path:', e.message);
    }

    const possiblePaths = [
      path.join(__dirname, '..', '..', 'config', 'secrets.json'),
      path.join(__dirname, '..', 'config', 'secrets.json'),
      path.join(__dirname, '..', '..', '..', 'config', 'secrets.json'),
      path.join(process.cwd(), 'config', 'secrets.json'),
      path.join(rp, 'app', 'config', 'secrets.json'),
      path.join(rp, 'config', 'secrets.json'),
      userDataSecretsPath,
    ].filter(Boolean);

    let userDataTemplatePath = '';
    try { userDataTemplatePath = path.join(app.getPath('userData'), 'config', 'secrets.template.json'); } catch(e) {
      console.error('[SECRETS] Error getting userData template path:', e.message);
    }

    const possibleTemplates = [
      path.join(__dirname, '..', '..', 'config', 'secrets.template.json'),
      path.join(__dirname, '..', 'config', 'secrets.template.json'),
      path.join(__dirname, '..', '..', '..', 'config', 'secrets.template.json'),
      path.join(process.cwd(), 'config', 'secrets.template.json'),
      path.join(rp, 'app', 'config', 'secrets.template.json'),
      path.join(rp, 'config', 'secrets.template.json'),
      userDataTemplatePath,
    ].filter(Boolean);

    let src = null;
    for (const p of possiblePaths) {
      const exists = fs.existsSync(p);
      console.log('[MAIN] Trying secrets path: ' + p + ' — exists: ' + exists);
      if (exists) { src = p; console.log('[MAIN] Found secrets at:', p); break; }
    }
    if (!src) {
      for (const p of possibleTemplates) {
        const exists = fs.existsSync(p);
        console.log('[MAIN] Trying secrets template path: ' + p + ' — exists: ' + exists);
        if (exists) { src = p; console.log('[MAIN] Found secrets template at:', p); break; }
      }
    }
    if (src) {
      secrets = JSON.parse(fs.readFileSync(src, 'utf-8'));
    } else {
      console.warn('[MAIN] Secrets not found at any of:', JSON.stringify(possiblePaths));
    }
  } catch (e) {
    console.warn('[MAIN] Could not load secrets:', e.message);
  }

  // Packaged-mode fallback
  if (!Object.keys(secrets).length) {
    try {
      if (app.isPackaged) {
        const rpSafe = (typeof process.resourcesPath !== 'undefined' && process.resourcesPath)
          ? process.resourcesPath : '';
        if (rpSafe) {
          const packagedPath = path.join(rpSafe, 'config', 'secrets.json');
          if (fs.existsSync(packagedPath)) {
            secrets = JSON.parse(fs.readFileSync(packagedPath, 'utf-8'));
          }
        }
      }
    } catch (e2) {
      console.warn('[MAIN] Packaged-mode fallback failed:', e2.message);
    }
  }

  // Dev-mode fallback
  if (!Object.keys(secrets).length) {
    try {
      const devPath = path.join(__dirname, '..', '..', 'config', 'secrets.json');
      if (fs.existsSync(devPath)) {
        secrets = JSON.parse(fs.readFileSync(devPath, 'utf-8'));
      }
    } catch (e3) {
      console.warn('[MAIN] Dev fallback secrets not available:', e3.message);
    }
  }

  // Last-resort: exe-relative
  if (!Object.keys(secrets).length) {
    try {
      const exeDir = path.dirname(app.getPath('exe'));
      const lastResortPath = path.join(exeDir, 'resources', 'config', 'secrets.json');
      if (fs.existsSync(lastResortPath)) {
        secrets = JSON.parse(fs.readFileSync(lastResortPath, 'utf-8'));
      }
    } catch (e4) {
      console.warn('[MAIN] Last-resort secrets fallback failed:', e4.message);
    }
  }

  // Build diagnostics
  let userDataStr = '';
  try { userDataStr = app.getPath('userData'); } catch(e) { userDataStr = 'unavailable'; }
  secretsDiag = {
    loaded: Object.keys(secrets).length > 0,
    keysFound: Object.keys(secrets).join(', ') || 'none',
    __dirname: __dirname,
    cwd: process.cwd(),
    resourcesPath: (typeof process.resourcesPath !== 'undefined' && process.resourcesPath) || 'unset',
    isPackaged: app.isPackaged,
    userData: userDataStr,
  };
})();

module.exports = {
  secrets,
  secretsDiag,
};
