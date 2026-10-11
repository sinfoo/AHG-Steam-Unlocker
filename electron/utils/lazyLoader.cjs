// ── Lazy IPC Handler Loader ──
// Defers requiring and registering handler modules until the first IPC call
// to any of their channels. This saves startup parsing of ~1,100 lines (fixes)
// when the user never opens those features.
//
// Usage:
//   const { createLazyModule } = require('../utils/lazyLoader.cjs');
//   createLazyModule(['channel-a', 'channel-b'], () => {
//     const { registerHandlers } = require('./handlers/some.cjs');
//     registerHandlers();
//   });

const { ipcMain } = require('electron');

// Tracks real handlers registered by lazy modules so the proxy can delegate
// on the first invocation (before the real handler replaces the proxy).
const _handlerStore = new Map();

// Wrap ipcMain.handle to capture real handler functions as they're registered
const _origHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = function wrappedHandle(channel, listener) {
  _handlerStore.set(channel, listener);
  // try/catch: lazy proxy may have already registered via _origHandle below
  try { return _origHandle(channel, listener); } catch (e) {}
};

function createLazyModule(channels, registerFn) {
  if (!channels || channels.length === 0) return;
  
  let loaded = false;

  for (const channel of channels) {
    // Register a lightweight proxy that loads the real module on first call
    _origHandle(channel, async (event, ...args) => {
      if (!loaded) {
        loaded = true;

        // Load and register the real handlers
        // This calls ipcMain.handle(ch, realHandler) for each channel,
        // which goes through our wrappedHandle above (stores in HandlerStore)
        // then through Electron's real ipcMain.handle
        registerFn();
      }

      // Delegate to the real handler (registered by the module load above)
      const realHandler = _handlerStore.get(channel);
      if (typeof realHandler === 'function') {
        return realHandler(event, ...args);
      }

      console.error(`[LAZY] No handler found for channel: ${channel}`);
    });
  }
}

module.exports = { createLazyModule };
