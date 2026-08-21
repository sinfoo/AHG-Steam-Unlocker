/**
 * Lightweight CDN health-checking service.
 * Probes Steam CDN hosts with HEAD requests and tracks response times.
 * Results are cached for 60 seconds to avoid excessive probing.
 * No React dependencies — pure async service module.
 */

// ── CDN hosts to probe (mirrors imageCache.ts FALLBACK_HOSTS) ──

const FALLBACK_HOSTS = [
  'shared.akamai.steamstatic.com',
  'cdn.cloudflare.steamstatic.com',
  'cdn.akamai.steamstatic.com',
  'i.steamstatic.com',
  'steamcdn-a.akamaihd.net',
  'steamstatic-a.akamaihd.net',
  'media.steampowered.com',
] as const

const TEST_PATH = '/steam/apps/0/header.jpg'
const CACHE_TTL_MS = 60_000

// ── Module-level cache ──

interface CdnHealthSnapshot {
  hosts: Record<string, number>
  lastChecked: number
  fastest: string | null
}

let cachedSnapshot: CdnHealthSnapshot | null = null

// ── Public API ──

/**
 * Probe a single URL with a HEAD request (5s timeout).
 * Returns whether the host responded successfully and the measured latency.
 */
export async function checkHostHealth(
  url: string,
): Promise<{ alive: boolean; latencyMs: number }> {
  const start = performance.now()

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Math.round(performance.now() - start)
    return { alive: response.ok, latencyMs }
  } catch {
    const latencyMs = Math.round(performance.now() - start)
    return { alive: false, latencyMs }
  }
}

/**
 * Probe ALL CDN hosts and return a map of hostname → latency (ms).
 * Unreachable hosts are recorded with latency -1.
 * Results are cached for 60s — subsequent calls within the window return the cached result.
 */
export async function getCdnHealth(): Promise<Record<string, number>> {
  const now = Date.now()

  if (cachedSnapshot !== null && now - cachedSnapshot.lastChecked < CACHE_TTL_MS) {
    return { ...cachedSnapshot.hosts }
  }

  const results: Record<string, number> = {}

  const probes = FALLBACK_HOSTS.map(async (host) => {
    const url = `https://${host}${TEST_PATH}`
    const { alive, latencyMs } = await checkHostHealth(url)
    results[host] = alive ? latencyMs : -1
  })

  await Promise.all(probes)

  let fastest: string | null = null
  let lowest = Infinity

  for (const host of FALLBACK_HOSTS) {
    const lat = results[host]!
    if (lat >= 0 && lat < lowest) {
      lowest = lat
      fastest = host
    }
  }

  cachedSnapshot = {
    hosts: { ...results },
    lastChecked: now,
    fastest,
  }

  return results
}

/**
 * Returns the hostname of the fastest-responding CDN host,
 * or `null` if no host is reachable.
 */
export async function getFastestCdn(): Promise<string | null> {
  const now = Date.now()

  if (
    cachedSnapshot !== null &&
    now - cachedSnapshot.lastChecked < CACHE_TTL_MS
  ) {
    return cachedSnapshot.fastest
  }

  await getCdnHealth()
  return cachedSnapshot?.fastest ?? null
}

/**
 * Returns the most recent cached probe results without triggering a new probe.
 * If no probe has been run yet, returns an empty snapshot.
 */
export function getCdnHealthSnapshot(): CdnHealthSnapshot {
  if (cachedSnapshot === null) {
    return { hosts: {}, lastChecked: 0, fastest: null }
  }
  return { ...cachedSnapshot, hosts: { ...cachedSnapshot.hosts } }
}
