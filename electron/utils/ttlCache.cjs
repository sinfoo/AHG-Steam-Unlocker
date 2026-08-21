// ── Lightweight TTL cache for READ-heavy IPC handlers ──
// Each cache entry stores a value + expiry timestamp.
// Automatically evicts stale entries on read.

const DEFAULT_TTL_MS = 60_000; // 60 seconds

/**
 * Create a TTL cache.
 * @param {number} ttlMs - Time-to-live in milliseconds (default: 60s)
 * @returns {{ get, set, clear, has, invalidate, size }}
 */
function createTtlCache(ttlMs = DEFAULT_TTL_MS) {
  const store = new Map();

  function prune() {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expiry) store.delete(key);
    }
  }

  return {
    /** Get cached value (returns undefined if missing/expired). Prunes stale entries. */
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiry) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    /** Set a cached value with the cache's TTL. */
    set(key, value) {
      store.set(key, { value, expiry: Date.now() + ttlMs });
      // Prune every 100 writes to keep memory bounded
      if (store.size % 100 === 0) prune();
    },

    /** Remove a specific key. */
    invalidate(key) {
      store.delete(key);
    },

    /** Check if a key exists and is fresh. */
    has(key) {
      const entry = store.get(key);
      if (!entry) return false;
      if (Date.now() > entry.expiry) {
        store.delete(key);
        return false;
      }
      return true;
    },

    /** Clear all entries. */
    clear() {
      store.clear();
    },

    /** Current number of entries (approximate — does not prune). */
    get size() {
      return store.size;
    },
  };
}

/**
 * Wrap an async resolver function with TTL caching.
 * The resolver receives the same args as the returned function.
 */
function withCache(resolver, ttlMs = DEFAULT_TTL_MS) {
  const cache = createTtlCache(ttlMs);
  const fn = async (...args) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const value = await resolver(...args);
    cache.set(key, value);
    return value;
  };
  fn.cache = cache;
  return fn;
}

module.exports = { createTtlCache, withCache };
