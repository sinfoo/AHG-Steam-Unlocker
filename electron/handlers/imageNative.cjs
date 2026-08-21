const { ipcMain } = require('electron');
const path = require('path');

function loadNativeAddon() {
  try {
    const vcpkgBin = 'C:\\Users\\sinfo\\vcpkg\\installed\\x64-windows\\bin';
    if (!process.env.PATH.includes(vcpkgBin)) {
      process.env.PATH = vcpkgBin + path.delimiter + process.env.PATH;
    }

    const addon = require('../../native');
    return addon;
  } catch (err) {
    console.error('[imageNative] Failed to load native addon:', err.message);
    return null;
  }
}

const nativeImageAddon = loadNativeAddon();

function detectFormat(buffer) {
  if (!buffer || buffer.length < 4) return 'unknown';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'webp';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'png';
  return 'unknown';
}

function decodeImage(buffer) {
  const fmt = detectFormat(buffer);
  if (fmt === 'webp') return nativeImageAddon.decodeWebP(buffer);
  if (fmt === 'jpeg') return nativeImageAddon.decodeJPEG(buffer);
  console.warn('[imageNative] Unsupported format:', fmt);
  return null;
}

// Robustly coerce whatever the renderer's image bytes arrive as into a Buffer.
// An ArrayBuffer sent through contextBridge does NOT reliably survive as an
// ArrayBuffer — it can arrive as a plain object of numeric indices, which made
// `Buffer.from(buffer)` throw ERR_INVALID_ARG_TYPE on every cover (the LQIP IPC
// then rejected and spammed the renderer console). Handle every plausible shape.
function toBuffer(input) {
  if (input == null) return null;
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  if (ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (Array.isArray(input)) return Buffer.from(input);
  if (input.data && (Array.isArray(input.data) || ArrayBuffer.isView(input.data))) return Buffer.from(input.data);
  if (typeof input === 'object') {
    const vals = Object.values(input);
    if (vals.length && vals.every(v => typeof v === 'number')) return Buffer.from(vals);
  }
  return null;
}

function registerImageNativeHandlers() {
  ipcMain.handle('native-image:health', async () => ({
    loaded: nativeImageAddon !== null,
    gpu: nativeImageAddon ? nativeImageAddon.isGPUSupported() : false,
    version: process.versions.node,
  }));

  ipcMain.handle('native-image:generateLQIP', async (_event, { buffer, lqipWidth = 20 } = {}) => {
    // Never throw across IPC — any failure returns a null LQIP so the renderer
    // falls back to its OffscreenCanvas path silently (no console spam).
    try {
      if (!nativeImageAddon) return { lqip: null, error: 'native_addon_not_loaded' };

      const raw = toBuffer(buffer);
      if (!raw || raw.length < 4) return { lqip: null, error: 'bad_buffer' };
      const decoded = decodeImage(raw);
      if (!decoded) return { lqip: null, error: 'unsupported_format' };

      const lqipResult = nativeImageAddon.generateLQIP(decoded.data, decoded.width, decoded.height, lqipWidth);

      let lqipDataUrl;
      if (typeof lqipResult === 'string' && lqipResult.startsWith('data:')) {
        lqipDataUrl = lqipResult;
      } else {
        const rawBuf = Buffer.isBuffer(lqipResult) ? lqipResult : Buffer.from(lqipResult);
        lqipDataUrl = `data:image/webp;base64,${rawBuf.toString('base64')}`;
      }

      return { lqip: lqipDataUrl, error: null };
    } catch (err) {
      return { lqip: null, error: 'lqip_failed' };
    }
  });

  ipcMain.handle('native-image:decode', async (_event, { buffer } = {}) => {
    try {
      if (!nativeImageAddon) return { width: 0, height: 0, format: 'unknown', error: 'native_addon_not_loaded' };

      const raw = toBuffer(buffer);
      if (!raw || raw.length < 4) return { width: 0, height: 0, format: 'unknown', error: 'bad_buffer' };
      const fmt = detectFormat(raw);
      const decoded = decodeImage(raw);
      if (!decoded) return { width: 0, height: 0, format: fmt, error: 'decode_failed' };

      return { width: decoded.width, height: decoded.height, format: fmt, error: null };
    } catch (err) {
      return { width: 0, height: 0, format: 'unknown', error: 'decode_failed' };
    }
  });

  console.log('[imageNative] IPC handlers registered' +
    (nativeImageAddon ? ' (native addon loaded)' : ' (FALLBACK — native addon NOT loaded)'));
}

module.exports = { registerImageNativeHandlers };
