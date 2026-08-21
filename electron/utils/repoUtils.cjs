// ── Mirror repo utilities for main process ──
const https = require('https');
const state = require('./state.cjs');

// Download depotkeys.json from a repo (with caching)
async function downloadDepotKeys(repo) {
  const cached = state.depotKeysCache.get(repo);
  if (cached && (Date.now() - cached.timestamp) < state.NEGATIVE_CACHE_TTL) {
    console.log(`[MAIN] Using cached depotkeys from ${repo}`);
    return cached.data;
  }

  const urlFormats = [
    `https://raw.githubusercontent.com/${repo}/main/depotkeys.json`,
    `https://raw.githubusercontent.com/${repo}/master/depotkeys.json`
  ];

  console.log(`[MAIN] Trying depotkeys from ${repo} (racing 2 URLs)...`);
  const startTime = Date.now();

  const results = await Promise.allSettled(urlFormats.map(url =>
    new Promise((resolve, reject) => {
      const req = https.get(url, { headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
        if (res.statusCode === 200) {
          const chunks = [];
          const totalTimer = setTimeout(() => { req.destroy(); reject(new Error('Timeout')); }, state.REPO_TIMEOUT_MS);
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            clearTimeout(totalTimer);
            resolve({ data: Buffer.concat(chunks), url });
          });
          res.on('error', (e) => { clearTimeout(totalTimer); reject(e); });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
      req.on('error', reject);
      req.setTimeout(state.REPO_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
    })
  ));

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { data, url } = result.value;
      recordRepoSpeed(repo, Date.now() - startTime);
      console.log(`[MAIN] Got depotkeys from ${url.slice(0, 80)}...`);
      let parsed = null;
      try { parsed = JSON.parse(data.toString()); } catch (e) { /* not critical */ }
      state.depotKeysCache.set(repo, { data, parsed, timestamp: Date.now() });
      if (parsed) indexRepoAppids(repo, parsed);
      state.repoNegativeCache.delete(repo);
      return data;
    }
  }

  const firstError = results[0]?.reason?.message || 'Unknown';
  console.log(`[MAIN] All ${urlFormats.length} URLs failed for ${repo}: ${firstError}`);
  throw new Error(`Not found in any branch (${firstError})`);
}

// Check all cached depotkeys for an appid without any network request
function findInCachedDepotkeys(appid) {
  const appidStr = String(appid);
  const indexEntries = state.repoAppIndex.get(appidStr);
  if (indexEntries && indexEntries.length > 0) {
    for (const entry of indexEntries) {
      const cached = state.depotKeysCache.get(entry.repo);
      if (cached && cached.parsed && cached.parsed[appidStr]) {
        return { repo: entry.repo, appData: cached.parsed[appidStr] };
      }
    }
  }
  for (const [repo, cached] of state.depotKeysCache) {
    if (!cached.parsed) continue;
    if (cached.parsed[appidStr]) {
      return { repo, appData: cached.parsed[appidStr] };
    }
  }
  return null;
}

// Pre-fetch depotkeys from top repos in parallel and build fast reverse index
async function ensureRepoIndex(sendLog) {
  const log = sendLog || ((msg) => console.log('[MAIN] ' + msg));
  if (!state.repoIndexPromise) {
    state.setRepoIndexPromise((async () => {
      log('Preparing game index...');
      let succeeded = 0;
      for (let i = 0; i < state.TOP_INDEX_REPOS.length; i += state.INDEX_CHUNK_SIZE) {
        const chunk = state.TOP_INDEX_REPOS.slice(i, i + state.INDEX_CHUNK_SIZE);
        const results = await Promise.allSettled(chunk.map(async (repo) => {
          try {
            await downloadDepotKeys(repo);
            return { repo, status: 'fulfilled' };
          } catch (e) {
            return { repo, status: 'rejected' };
          }
        }));
        succeeded += results.filter(r => r.status === 'fulfilled').length;
      }
      state.pruneAllCaches(); // trim unbounded caches after index build
      log('Game index ready');
    })());
  }
  return state.repoIndexPromise;
}

// Build reverse index from a repo's parsed depotkeys
function indexRepoAppids(repo, parsed) {
  if (!parsed) return;
  const appids = Object.keys(parsed);
  for (const appid of appids) {
    if (!state.repoAppIndex.has(appid)) state.repoAppIndex.set(appid, []);
    const entries = state.repoAppIndex.get(appid);
    if (!entries.some(e => e.repo === repo)) {
      entries.push({ repo, depots: parsed[appid].depots || {} });
    }
  }
}

// Get repos ordered by priority, manifest count, hit rate, and speed
function getOrderedRepos() {
  const now = Date.now();
  const activeRepos = state.TOP_INDEX_REPOS.filter(repo => {
    const cached = state.repoNegativeCache.get(repo);
    return !cached || (now - cached) > state.NEGATIVE_CACHE_TTL;
  });
  const priorityRepos = [
    "WARDEN-DEV/Steam_ManifestHub",
    "SteamAutoCracks/ManifestHub",
    "pjy612/SteamManifestCache",
    "pjy612/ManifestAutoUpdate-bak",
    "X06W90X/pjy612",
  ];
  const rest = activeRepos.filter(repo => !priorityRepos.includes(repo));
  rest.sort((a, b) => {
    const aManifest = state.repoManifestCountCache.get(a);
    const bManifest = state.repoManifestCountCache.get(b);
    const aCount = aManifest ? aManifest.count : 0;
    const bCount = bManifest ? bManifest.count : 0;
    if (aCount !== bCount) return bCount - aCount;

    const aHit = state.repoHitCache.has(a);
    const bHit = state.repoHitCache.has(b);
    if (aHit !== bHit) return aHit ? -1 : 1;

    const aTime = state.repoSpeedCache.get(a) || Infinity;
    const bTime = state.repoSpeedCache.get(b) || Infinity;
    return aTime - bTime;
  });
  return [...priorityRepos, ...rest];
}

function recordRepoSpeed(repo, timeMs) {
  const prev = state.repoSpeedCache.get(repo);
  state.repoSpeedCache.set(repo, prev ? (prev * 0.7 + timeMs * 0.3) : timeMs);
}

function recordRepoManifestCount(repo, count) {
  if (count > 0) {
    state.repoManifestCountCache.set(repo, { count, timestamp: Date.now() });
    state.repoHitCache.add(repo);
  }
}

module.exports = {
  downloadDepotKeys,
  findInCachedDepotkeys,
  ensureRepoIndex,
  indexRepoAppids,
  getOrderedRepos,
  recordRepoSpeed,
  recordRepoManifestCount,
};
