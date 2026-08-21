// ── Custom Fixes Manager ──
// Handles GitHub release discovery + local persistence for AHG-Custom-Fixes
//
// Storage: {userData}/custom-fixes.json
// Format:
// {
//   lastCheckedTag: "v1",
//   fixes: [{ appid, name, badges, fix_count, download_url, source, versions, _releaseTag, _detectedAt }]
// }

const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_REPO = 'ahg-team/AHG-Custom-Fixes';
const STORAGE_FILE = 'custom-fixes.json';

let electronApp = null;

function setApp(app) {
  electronApp = app;
}

function getStoragePath() {
  if (!electronApp) throw new Error('App not set — call setApp() first');
  return path.join(electronApp.getPath('userData'), STORAGE_FILE);
}

function loadCustomFixes() {
  try {
    const p = getStoragePath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[CUSTOM-FIXES] Failed to load:', e.message);
  }
  return { lastCheckedTag: null, fixes: [] };
}

function saveCustomFixes(data) {
  try {
    const p = getStoragePath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    console.log('[CUSTOM-FIXES] Saved', data.fixes.length, 'fixes to', p);
  } catch (e) {
    console.warn('[CUSTOM-FIXES] Failed to save:', e.message);
  }
}

function fetchReleases() {
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
    console.log('[CUSTOM-FIXES] Fetching releases from', url);
    https.get(url, {
      headers: {
        'User-Agent': 'AHG/9.4',
        'Accept': 'application/vnd.github.v3+json',
      },
      timeout: 20000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`GitHub API returned ${res.statusCode}`));
        }
        try {
          const parsed = JSON.parse(data);
          if (!Array.isArray(parsed)) {
            return reject(new Error('GitHub API did not return an array'));
          }
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject)
      .on('timeout', function () { this.destroy(); reject(new Error('GitHub API timeout')); });
  });
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function parseRelease(release) {
  const appid = (release.body || '').trim();
  const name = release.name || `Fix #${release.tag_name}`;
  const asset = release.assets && release.assets[0];

  // Validate: must have appid (numeric), a release asset, and not be draft/prerelease
  if (!asset || !appid || !/^\d+$/.test(appid)) return null;
  if (release.draft) return null;

  const badges = ['sinfo', 'bypass'];

  return {
    appid,
    name,
    badges,
    fix_count: 1,
    download_url: asset.browser_download_url,
    download_urls: [asset.browser_download_url],
    source: 'ahg-custom',
    versions: [{
      name: name,
      url: asset.browser_download_url,
      size: formatSize(asset.size),
      badges,
    }],
    _releaseTag: release.tag_name,
    _detectedAt: Date.now(),
  };
}

/**
 * Check GitHub for new custom fixes.
 * Returns { newFixes: CustomFix[], allFixes: CustomFix[], error?: string }
 */
async function checkForNewCustomFixes() {
  try {
    const stored = loadCustomFixes();
    const allReleases = await fetchReleases();

    if (!Array.isArray(allReleases) || allReleases.length === 0) {
      console.log('[CUSTOM-FIXES] No releases found');
      return { newFixes: [], allFixes: stored.fixes };
    }

    // Track which tags we already know about
    const knownTags = new Set(stored.fixes.map(f => f._releaseTag));
    const newEntries = [];

    for (const release of allReleases) {
      if (knownTags.has(release.tag_name)) continue;
      if (release.prerelease) continue;

      const entry = parseRelease(release);
      if (entry) {
        console.log('[CUSTOM-FIXES] New fix detected:', entry.appid, entry.name);
        newEntries.push(entry);
        stored.fixes.push(entry);
      }
    }

    if (newEntries.length > 0) {
      stored.lastCheckedTag = allReleases[0].tag_name;
      saveCustomFixes(stored);
    }

    return { newFixes: newEntries, allFixes: stored.fixes };
  } catch (e) {
    console.warn('[CUSTOM-FIXES] Check failed:', e.message);
    const stored = loadCustomFixes();
    return { newFixes: [], allFixes: stored.fixes, error: e.message };
  }
}

function getAllCustomFixes() {
  return loadCustomFixes().fixes;
}

module.exports = {
  setApp,
  checkForNewCustomFixes,
  getAllCustomFixes,
};
