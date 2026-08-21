// ── API Health Check — lightweight pre-flight probes with TTL cache ──
// Used by install pipeline to skip dead APIs before attempting full downloads.
const https = require('https');
const http = require('http');

const HEALTH_TTL = 60000;        // 60s cache before re-checking
const PROBE_TIMEOUT = 3000;      // 3s per probe (quick HEAD)

// In-memory cache: Map<apiName, { healthy, latency, checkedAt }>
const healthCache = new Map();

/**
 * Probe a single API endpoint with a HEAD request.
 * Returns { healthy: boolean, latency: number }.
 */
function probeEndpoint(url, signal) {
  return new Promise((resolve) => {
    const start = Date.now();
    let u;
    try {
      u = new URL(url);
    } catch {
      resolve({ healthy: false, latency: 0 });
      return;
    }
    const mod = u.protocol === 'https:' ? https : http;
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'HEAD',
      headers: {
        'User-Agent': 'AHG-Unlocker/1.0',
      },
    };

    const req = mod.request(opts, (res) => {
      const latency = Date.now() - start;
      // 2xx or redirect = healthy
      const healthy = res.statusCode >= 200 && res.statusCode < 400;
      resolve({ healthy, latency });
    });

    req.on('error', () => {
      resolve({ healthy: false, latency: Date.now() - start });
    });

    req.setTimeout(PROBE_TIMEOUT, () => {
      req.destroy();
      resolve({ healthy: false, latency: Date.now() - start });
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        req.destroy();
        resolve({ healthy: false, latency: Date.now() - start });
      }, { once: true });
    }

    req.end();
  });
}

/**
 * Check health of an API by name. Uses cache if fresh, probes if stale.
 * Returns { healthy, latency }.
 */
async function checkApi(name, url, signal) {
  const cached = healthCache.get(name);
  if (cached && (Date.now() - cached.checkedAt) < HEALTH_TTL) {
    return { healthy: cached.healthy, latency: cached.latency };
  }

  const result = await probeEndpoint(url, signal);
  healthCache.set(name, { ...result, checkedAt: Date.now() });
  return result;
}

/**
 * Filter a list of APIs to only those that are healthy.
 * Probes all in parallel (3s timeout each), returns healthy subset.
 * Each API entry should be { name, url }.
 */
async function getHealthyEndpoints(apis, sendLog) {
  if (!apis || apis.length === 0) return [];

  const results = await Promise.allSettled(
    apis.map(async (api) => {
      const healthUrl = api.url.replace(/<appid>/g, '0'); // use appid=0 as generic probe
      const { healthy, latency } = await checkApi(api.name, healthUrl);
      return { ...api, healthy, latency };
    })
  );

  const healthy = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      const api = r.value;
      if (api.healthy) {
        healthy.push(api);
      } else if (sendLog) {
        sendLog(`${api.name} API unreachable (${api.latency}ms), skipping`);
      }
    }
  }
  return healthy;
}

/**
 * Run full health check on all known LuaTools APIs (warm cache).
 * Called at startup so the cache is populated for the first install.
 */
async function warmupHealthChecks(sendLog) {
  const LUATOOLS_APIS = [
    { name: 'Sushi', url: 'https://raw.githubusercontent.com/sushi-dev55-alt/sushitools-games-repo-alt/refs/heads/main/0.zip' },
    { name: 'Ryuu', url: 'http://167.235.229.108/0' },
  ];

  if (sendLog) sendLog('Warming API health cache...');
  const results = await Promise.allSettled(
    LUATOOLS_APIS.map(async (api) => {
      const { healthy, latency } = await checkApi(api.name, api.url);
      if (sendLog) {
        sendLog(`API health [${api.name}]: ${healthy ? '✓' : '✗'} (${latency}ms)`);
      }
    })
  );
  return results;
}

/**
 * Invalidate cache entry for a specific API (e.g. after a successful download).
 */
function markHealthy(name) {
  healthCache.set(name, { healthy: true, latency: 0, checkedAt: Date.now() });
}

function markUnhealthy(name) {
  healthCache.set(name, { healthy: false, latency: 0, checkedAt: Date.now() });
}

module.exports = {
  checkApi,
  getHealthyEndpoints,
  warmupHealthChecks,
  markHealthy,
  markUnhealthy,
  probeEndpoint,
};
