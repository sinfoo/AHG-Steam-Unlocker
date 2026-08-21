// ── IPC Rate Limiter ──
// Per-channel, per-window throttling to prevent renderer flooding.
// Single-user desktop app: generous limits, just enough to stop accidental/malicious floods.
// Stale entries cleaned every 60s.

'use strict';

var DEFAULT_WINDOW_MS = 200;   // 200ms window
var DEFAULT_MAX_CALLS = 10;    // max 10 calls per window
var CLEANUP_INTERVAL_MS = 60000;

var stores = {};

function getStore(channel) {
  if (!stores[channel]) {
    stores[channel] = { hits: [], cleanupTimer: null };
  }
  return stores[channel];
}

function scheduleCleanup(channel) {
  var store = stores[channel];
  if (store.cleanupTimer) return;
  store.cleanupTimer = setTimeout(function() {
    var now = Date.now();
    store.hits = store.hits.filter(function(t) { return now - t < DEFAULT_WINDOW_MS; });
    store.cleanupTimer = null;
    // If no active hits remain, delete the store to free memory
    if (store.hits.length === 0) {
      delete stores[channel];
    } else {
      scheduleCleanup(channel);
    }
  }, CLEANUP_INTERVAL_MS);
}

// Returns true if call is allowed, false if rate-limited
function checkRate(channel, opts) {
  opts = opts || {};
  var windowMs = opts.windowMs || DEFAULT_WINDOW_MS;
  var maxCalls = opts.maxCalls || DEFAULT_MAX_CALLS;

  var store = getStore(channel);
  var now = Date.now();

  // Prune expired hits
  store.hits = store.hits.filter(function(t) { return now - t < windowMs; });

  if (store.hits.length >= maxCalls) {
    return false;
  }

  store.hits.push(now);
  scheduleCleanup(channel);
  return true;
}

// Wraps an ipcMain.handle() with rate limiting
function wrapHandler(channel, handler, opts) {
  return async function(event) {
    if (!checkRate(channel, opts)) {
      console.warn('[RATE-LIMIT]', channel, '— too many calls, rejecting');
      throw new Error('Too many requests. Please wait.');
    }
    return handler.apply(this, arguments);
  };
}

module.exports = {
  checkRate: checkRate,
  wrapHandler: wrapHandler,
};
