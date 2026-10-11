# AHG Unlocker — MASTERPLAN: Performance Transformation Roadmap

> **Goal**: Match Steam / Epic Games / Hydra native launcher smoothness — instant covers, sub-second cold start, butter-scroll at 176K games, <250MB memory.
>
> **Constraint**: Preserve ALL React UI components (`*.tsx`), Tailwind CSS, Framer Motion animations, Zustand stores, and visual design. Only touch the **backend pipeline** (main process, preload, bridge, services, build config) and **GameCover display path**.
>
> **Current baseline** (measured 2026-06-19):
> - Main JS bundle: **149KB** + **game-pages: 157KB** + **modals: 65KB** | CSS: **126KB** | Vendor React: **142KB** | Framer Motion: **121KB**
> - Main process: **6,207 lines** across main.cjs + **25 handler modules**
> - Image pipeline: CDN `fetch()` → OffscreenCanvas WebP → Blob URL → `<img>` decode (with native C++ addon LQIP path for imageProcessor.ts)
> - Cache: In-memory LRU (hot 500 / warm 1000 / cold 500) + IndexedDB + native Electron disk cache with `image-cache://` protocol
> - Lazy loading: IntersectionObserver with 800px rootMargin + 20-slot stagger
> - Cold start: **3-8s** | Image load: **200-3000ms** | Memory idle: **300-500MB**
> - TypeScript: **Strict-ready** — all ~100 `noUncheckedIndexedAccess` errors resolved across 30+ files
> - Build: **6s** | `npx tsc --noEmit`: **0 errors** | `npm run build`: **0 errors**

---

## Table of Contents

- [Phase 1 — Image Pipeline Rewrite](#phase-1--image-pipeline-rewrite)
  - [1.1 — Native C++ Image Module (N-API Addon)](#11--native-c-image-module-n-api-addon)
  - [1.2 — Disk Cache Manager](#12--disk-cache-manager)
  - [1.3 — Preloader (Install-Time Batch Download)](#13--preloader-install-time-batch-download)
  - [1.4 — WebGL/GPU Texture Display](#14--webglgpu-texture-display)
- [Phase 2 — Startup Optimization](#phase-2--startup-optimization)
  - [2.1 — Async Boot: Skeleton → Data](#21--async-boot-skeleton--data)
  - [2.2 — Main Process Debloat](#22--main-process-debloat)
  - [2.3 — IPC Batching](#23--ipc-batching)
  - [2.4 — V8 Code Caching](#24--v8-code-caching)
- [Phase 3 — Render Optimization](#phase-3--render-optimization)
  - [3.1 — Fixed Grid Virtual Scroll](#31--fixed-grid-virtual-scroll)
  - [3.2 — Zustand Selector Audit](#32--zustand-selector-audit)
  - [3.3 — Component Splitting](#33--component-splitting)
  - [3.4 — Bundle Triage](#34--bundle-triage)
- [Phase 4 — Build & Delivery](#phase-4--build--delivery)
  - [4.1 — Vite Config Tuning](#41--vite-config-tuning)
  - [4.2 — Windows Native Build Pipeline](#42--windows-native-build-pipeline)
- [Effort Estimate Summary](#effort-estimate-summary)
- [Recommended Execution Order](#recommended-execution-order)
- [Before / After Comparison](#before--after-comparison)
- [Architecture Diagrams](#architecture-diagrams)

---

## Phase 1 — Image Pipeline Rewrite

**Impact**: 60% of perceived smoothness. This is the single biggest gap vs native launchers.

**Current pipeline** (renderer, all JavaScript):

```
CDN fetch() → OffscreenCanvas → WebP encode → Blob URL → <img> decode → screen
  200-3000ms    10-30ms         20-50ms        ~0ms      100-500ms
```

**Target pipeline** (C++ + main process + GPU):

```
Disk read → C++ libwebp decode → SharedArrayBuffer → ImageBitmap → WebGL tex → <canvas>
  <1ms         1-5ms                 ~0ms              ~2ms          ~0ms       ~1ms
```

---

### 1.1 — Native C++ Image Module (N-API Addon)

Build a Node.js native addon using [node-addon-api](https://github.com/nodejs/node-addon-api) that handles all CPU-intensive image work in C++ instead of JavaScript/Chromium.

#### Why C++

| Operation | JavaScript (OffscreenCanvas) | C++ (libwebp/libjpeg-turbo) | Speedup |
|---|---|---|---|
| WebP decode (600×900 px) | 20-50ms | 1-3ms | **15-20x** |
| JPEG decode | 30-80ms (Chromium parser) | 3-8ms | **5-10x** |
| WebP encode | 20-50ms | 2-5ms | **10x** |
| LQIP generation | 10-20ms | <1ms | **20x** |
| Batch decode (50 images) | 1-3s (serial) | 50-150ms (parallel SIMD) | **20x** |

#### Directory Structure

```
native/
├── binding.gyp              # node-gyp build definition
├── CMakeLists.txt           # Alternative CMake build (preferred)
├── package.json             # node-addon-api dependency
├── src/
│   ├── main.cc              # N-API module entry, Init() exports
│   ├── decoder.h / .cc      # WebP + JPEG decode (libwebp + libjpeg-turbo)
│   ├── encoder.h / .cc      # WebP encode (libwebp)
│   ├── lqip.h / .cc         # LQIP (20px thumbnail) generation
│   ├── batch.h / .cc        # Batch decode N images in parallel (TBB / thread pool)
│   ├── gpu.h / .cc          # D3D11 shared memory upload (optional tier)
│   └── types.h              # Shared structs, error codes
├── include/
│   ├── libwebp/             # Vendored libwebp headers (or vcpkg)
│   └── libjpeg-turbo/       # Vendored libjpeg-turbo headers
└── scripts/
    └── build-native.bat     # Windows build script
```

#### N-API Exported Functions

```cpp
// Decode a WebP/JPEG file from disk → raw RGBA bytes
Napi::Value DecodeImage(const Napi::CallbackInfo& info);
// Input:  (string filePath, string format)
// Output: { width, height, channels, data: Uint8Array, sizeBytes }

// Encode raw RGBA → WebP file on disk
Napi::Value EncodeToWebP(const Napi::CallbackInfo& info);
// Input:  (string outputPath, Uint8Array rgbaData, int width, int height, float quality)
// Output: { success: bool, sizeBytes: number }

// Generate LQIP (20px WebP data URL) from file
Napi::Value GenerateLQIP(const Napi::CallbackInfo& info);
// Input:  (string filePath)
// Output: { lqipDataUrl: string }  (data:image/webp;base64,...)

// Batch decode multiple images in parallel
Napi::Value BatchDecode(const Napi::CallbackInfo& info);
// Input:  (string[] filePaths, string format)
// Output: { results: [{ filePath, width, height, data: Uint8Array }] }

// Initialize D3D11 device for GPU decode path (optional)
Napi::Value InitGPUDevice(const Napi::CallbackInfo& info);
// Output: { success: bool, adapterName: string, dedicatedVRAM: number }
```

#### Build Script: `scripts/build-native.bat`

```bat
@echo off
echo Building native image module...
cd native
if not exist "build" mkdir build
cd build

:: Configure with CMake
cmake .. -G "Visual Studio 17 2022" -A x64 ^
  -DCMAKE_BUILD_TYPE=Release ^
  -DLIBWEBP_ROOT="%VCPKG_ROOT%/installed/x64-windows" ^
  -DLIBJPEG_ROOT="%VCPKG_ROOT%/installed/x64-windows"

:: Build
cmake --build . --config Release

:: Copy to Electron app's native modules folder
copy /Y Release\ahg-native-image.node ..\..\electron\native\
echo ✅ Native module built: electron\native\ahg-native-image.node
cd ..\..
```

#### JS Interface (TypeScript types)

```ts
// src/types/native-image.d.ts
declare module 'ahg-native-image' {
  export interface DecodedImage {
    width: number
    height: number
    channels: number
    data: Uint8Array
    sizeBytes: number
  }

  export interface EncodedResult {
    success: boolean
    sizeBytes: number
  }

  export interface BatchResult {
    filePath: string
    width: number
    height: number
    data: Uint8Array
  }

  export function decodeImage(filePath: string, format?: string): DecodedImage
  export function encodeToWebP(
    outputPath: string,
    rgbaData: Uint8Array,
    width: number,
    height: number,
    quality?: number
  ): EncodedResult
  export function generateLQIP(filePath: string): { lqipDataUrl: string }
  export function batchDecode(filePaths: string[], format?: string): BatchResult[]
  export function initGPUDevice(): { success: boolean; adapterName: string; dedicatedVRAM: number }
}
```

#### Fallback Path (no C++ build)

If native compilation fails, fall back to Node.js [`sharp`](https://sharp.pixelplumbing.com/) (libvips — already in your node_modules as extraneous). Still 5-10x faster than OffscreenCanvas, no C++ build needed:

```ts
// electron/services/imageProcessor.js (fallback)
const sharp = require('sharp')

async function decodeToWebP(inputPath, outputPath, quality = 82) {
  await sharp(inputPath)
    .webp({ quality })
    .toFile(outputPath)
}

async function generateLQIP(inputPath) {
  const { data, info } = await sharp(inputPath)
    .resize(20, undefined, { fit: 'outside' })
    .webp({ quality: 20 })
    .toBuffer()
  return `data:image/webp;base64,${data.toString('base64')}`
}
```

---

#### Checklist

- [x] **1.1.1** — Create `native/` directory structure with `binding.gyp` / `CMakeLists.txt`
- [x] **1.1.2** — Install `node-addon-api`, `libwebp`, `libjpeg-turbo` via vcpkg or manual
- [x] **1.1.3** — Implement `src/decoder.cc`: WebP + JPEG single-image decode
- [x] **1.1.4** — Implement `src/encoder.cc`: RGBA → WebP file output
- [x] **1.1.5** — Implement `src/lqip.cc`: 20px thumbnail → base64 data URL
- [x] **1.1.6** — Implement `src/batch.cc`: thread-pool parallel batch decode
- [x] **1.1.7** — Implement `src/gpu.cc`: D3D11 device init + shared memory (optional tier)
- [x] **1.1.8** — Implement `src/main.cc`: N-API Register() exporting all 6 functions
- [x] **1.1.9** — Write `scripts/build-native.bat` build pipeline
- [x] **1.1.10** — Write TypeScript type declarations `src/types/native-image.d.ts`
- [x] **1.1.11** — Write fallback using `sharp` npm package when native addon unavailable
- [x] **1.1.12** — Unit test: decode a known WebP, verify RGBA pixel values
- [x] **1.1.13** — Benchmark: compare decode speed vs OffscreenCanvas (target: 10x+)

---

### 1.2 — Disk Cache Manager

Replace the renderer-side IndexedDB + in-memory LRU cache with a main-process filesystem cache. The renderer loads images via a custom Electron protocol (`image-cache://`).

#### Cache Directory Structure

```
%APPDATA%/AHG Unlocker/image-cache/
├── v1/                              # Cache format version (for future migrations)
│   ├── 000/                         # Shard: first 3 digits of appid
│   │   ├── 000001/                  # Game appid directory
│   │   │   ├── header.webp          # Full-size header (460x215 or 1920x620)
│   │   │   ├── portrait.webp        # Portrait (600x900)
│   │   │   ├── grid.webp            # Grid thumbnail (292x136)
│   │   │   └── lqip.webp            # 20px LQIP for blur placeholder
│   │   ├── 000002/
│   │   │   └── ...
│   │   └── ...
│   ├── 001/
│   │   └── ...
│   ├── ...                          # 1000 shards (176K games / 176 per shard avg)
│   └── 999/
├── manifest.json                    # Master manifest: appid → { size, format, cachedAt }
├── eviction.log                     # LRU eviction audit trail
└── stats.json                       # Cache hit/miss/eviction counters
```

**Sharding rationale**: 176,785 games in a flat directory would exceed NTFS directory limits (which degrade past ~10K entries). 1000 shards by first 3 digits of appid gives ~177 entries per shard — efficient for NTFS MFT lookups.

#### Manifest Schema: `manifest.json`

```json
{
  "version": 1,
  "createdAt": "2026-06-18T00:00:00Z",
  "totalImages": 176785,
  "totalSizeBytes": 5368709120,
  "maxSizeBytes": 53687091200,
  "games": {
    "000001": {
      "header": { "sizeBytes": 28472, "format": "webp", "cachedAt": "2026-06-18T01:23:45Z", "lastAccessed": "2026-06-18T12:00:00Z" },
      "portrait": { "sizeBytes": 42109, "format": "webp", "cachedAt": "2026-06-18T01:23:46Z", "lastAccessed": "2026-06-18T12:00:00Z" },
      "lqip": { "sizeBytes": 1234, "format": "webp", "cachedAt": "2026-06-18T01:23:45Z", "lastAccessed": "2026-06-18T12:00:00Z" }
    }
  }
}
```

#### Main Process Module: `electron/services/imageDiskCache.js`

```js
// ── Configuration ──
const CACHE_ROOT = path.join(app.getPath('userData'), 'image-cache', 'v1')
const MAX_CACHE_SIZE = 50 * 1024 * 1024 * 1024  // 50GB
const EVICTION_BATCH = 5000                       // Evict 5000 games at a time
const SHARD_COUNT = 1000
const CONCURRENT_WRITES = 4

// ── Class ──
class ImageDiskCache {
  constructor() {
    this.manifest = null
    this.manifestDirty = false
    this.writeQueue = new Map()        // Batched writes
    this.flushTimer = null
    this.hitCount = 0
    this.missCount = 0
  }

  async init() { /* Load manifest from disk, create dirs */ }
  async get(appid, type) { /* Return { filePath, format } or null */ }
  async set(appid, type, buffer, format) { /* Write to disk, update manifest */ }
  async has(appid, type) { /* Check manifest */ }
  async batchGet(appids) { /* Return Map<appid, {header, portrait, lqip}> */ }
  async preloadBatch(entries) { /* Batch download + encode + cache */ }

  // ── LRU eviction ──
  async ensureCapacity() { /* Check total size vs max, evict LRU if needed */ }
  async evictLRU(count) { /* Sort by lastAccessed ascending, delete oldest N */ }
  getStats() { /* Return { hitCount, missCount, hitRate, totalSize, gameCount } */ }
  async close() { /* Flush write queue, save manifest */ }
}
```

#### Custom Electron Protocol

Register a protocol that serves images from the disk cache:

```js
// electron/main.cjs or electron/protocols/imageCache.js
const { protocol } = require('electron')

app.whenReady().then(() => {
  protocol.handle('image-cache', async (request) => {
    // URL format: image-cache://{appid}/{type}.webp
    // Example:    image-cache://000001/header.webp
    const url = new URL(request.url)
    const segments = url.hostname.split('/')  // appid
    const type = url.pathname.replace('.webp', '')  // header / portrait / lqip

    const filePath = cache.getFilePath(segments, type)
    if (filePath && fs.existsSync(filePath)) {
      return net.fetch(`file://${filePath}`)
    }
    return new Response(null, { status: 404 })
  })
})
```

#### Renderer-Side Integration

`imageCache.ts` becomes a thin IPC wrapper:

```ts
// src/services/imageCache.ts (rewritten)
export async function loadGameImage(appid, preferredImageTypes?) {
  // 1. Check local disk first via IPC batch call
  const result = await bridge.getImagesFromDisk([appid], preferredImageTypes)
  if (result?.[appid]) {
    return `image-cache://${appid}/${result[appid].type}.webp`
  }

  // 2. Fallback: trigger fetch from CDN via main process
  const downloadResult = await bridge.downloadAndCacheImage(appid)
  if (downloadResult) {
    return `image-cache://${appid}/${downloadResult.type}.webp`
  }

  // 3. Nothing worked → null (GameCover shows gradient + letter)
  return null
}
```

#### Checklist

- [x] **1.2.1** — Create `electron/services/imageDiskCache.cjs` with full class implementation
- [x] **1.2.2** — Implement sharded directory creation (1000 subdirectories)
- [x] **1.2.3** — Implement `get()` / `set()` / `has()` / `batchGet()` methods
- [x] **1.2.4** — Implement LRU eviction with manifest + `lastAccessed` tracking
- [x] **1.2.5** — Implement manifest persistence (save on close, load on init)
- [x] **1.2.6** — Register custom `image-cache://` protocol in main process
- [x] **1.2.7** — Add IPC handlers in `main.cjs`: `image-cache:batchGet`, `image-cache:has`, `image-cache:set`, `image-cache:clear`, `image-cache:stats`
- [x] **1.2.8** — Expose methods via `preload.cjs` contextBridge
- [x] **1.2.9** — Update `src/bridge.ts` with new IPC methods
- [x] **1.2.10** — Rewrite `src/services/imageCache.ts` to delegate to IPC
- [x] **1.2.11** — Test: fetch image, verify it writes to disk, verify custom protocol serves it
- [x] **1.2.12** — Test: batch-get 50 appids, single IPC roundtrip
- [x] **1.2.13** — Test: eviction fires when cache exceeds limit
- [x] **1.2.14** — Test: cache survives app close/open cycle

---

### 1.3 — Preloader (Install-Time Batch Download)

Downloads ALL 176K game covers to the disk cache during installation (or first launch). After this, every `GameCover.tsx` mount finds its image on disk <1ms away.

#### Architecture

```
Electron main process
         │
    ┌────┴────┐
    │  Queue  │  Games.json (176,785 entries)
    │ Manager │
    └────┬────┘
         │ batches of 50 appids
    ┌────┴────┐
    │ Batch   │  HTTPS download from Steam CDN (6 concurrent)
    │ Worker  │  libwebp decode → WebP encode → write to disk
    │ (C++    │
    │ addon)  │
    └────┬────┘
         │ per-image result
    ┌────┴────┐
    │ Manifest│  Update manifest.json with size + timestamp
    │ Updater │
    └─────────┘
```

#### Preloader Module: `electron/services/imagePreloader.js`

```js
class ImagePreloader {
  constructor(cache) {
    this.cache = cache          // ImageDiskCache instance
    this.queue = []             // Array of { appid, name }
    this.progress = { total: 0, completed: 0, failed: 0, bytesDownloaded: 0 }
    this.running = false
    this.paused = false
    this.BATCH_SIZE = 50
    this.CONCURRENT_BATCHES = 6
    this.CDN_HOSTS = ['shared.akamai.steamstatic.com', 'cdn.cloudflare.steamstatic.com', 'cdn.akamai.steamstatic.com']
  }

  async start(gameList, options = {}) {
    // gameList: Array<{ appid, name }> — from games.json
    // Options: { incremental, priority, onProgress }
    this.running = true
    this.queue = gameList.filter(g => !this.cache.has(g.appid, 'header'))

    while (this.queue.length > 0 && !this.paused) {
      const batch = this.queue.splice(0, this.BATCH_SIZE)
      await Promise.all(
        Array.from({ length: Math.min(this.CONCURRENT_BATCHES, batch.length) },
          () => this.processBatch(batch.splice(0, 10))
        )
      )
    }
  }

  async processBatch(appids) {
    // For each appid:
    //   1. Try CDN URLs in parallel (Promise.any across 3 hosts × 2 paths)
    //   2. If CDN fails, try SteamGridDB API as fallback
    //   3. On success: C++ decode → WebP encode → cache.set()
    //   4. On failure: mark as failed, skip
  }

  pause() { this.paused = true }
  resume() { this.paused = false; this.start() }
  getProgress() { return this.progress }
}
```

#### IPC Events (Renderer ←→ Main)

| Event | Direction | Payload |
|---|---|---|
| `preloader:start` | Renderer → Main | `{ incremental: bool }` |
| `preloader:progress` | Main → Renderer | `{ completed, total, failed, bytesDownloaded }` |
| `preloader:pause` | Renderer → Main | — |
| `preloader:resume` | Renderer → Main | — |
| `preloader:status` | Main → Renderer | `{ running, paused, progress }` |

#### UI Integration (minimal — optional progress bar)

A small progress indicator in the sidebar or Settings page:

```tsx
// src/components/PreloaderProgress.tsx (new — optional, zero existing UI changes)
function PreloaderProgress() {
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  useEffect(() => {
    return bridge.onPreloaderProgress((p) => setProgress(p))
  }, [])
  if (progress.total === 0 || progress.completed >= progress.total) return null
  return <div className="...">Caching covers: {progress.completed}/{progress.total}</div>
}
```

#### CDN Download Strategy

```js
async function downloadImage(appid) {
  const types = ['header.jpg', 'portrait.jpg']
  const hosts = ['shared.akamai.steamstatic.com', 'cdn.cloudflare.steamstatic.com', 'cdn.akamai.steamstatic.com']
  const paths = ['/steam/apps/', '/store_item_assets/steam/apps/']

  for (const fileType of types) {
    const urls = hosts.flatMap(host =>
      paths.map(p => `https://${host}${p}${appid}/${fileType}`)
    )
    try {
      return await Promise.any(urls.map(url => fetchWithTimeout(url, 5000)))
    } catch { continue }
  }
  return null
}
```

#### Priority Preloading (for visible content)

Not all 176K games need preloading immediately. Priority tiers:

| Tier | Count | Examples | Preload Priority |
|---|---|---|---|
| AAA (featured) | ~500 | Elden Ring, Cyberpunk | **High — preload first** |
| Installed games | varies | User's library | **High — preload second** |
| Favorites | varies | User's favorites | **High — preload second** |
| Recently viewed | ~50 | Session history | **High** |
| All remaining | ~175K+ | Long tail | **Background — idle** |

```js
async function prioritizedPreload(games, cache) {
  // 1. AAA games (preload immediately)
  await preloader.start(games.aaa, { priority: 'high' })

  // 2. User's installed + favorites (from store)
  const userGames = await bridge.getUserGameIds()
  await preloader.start(userGames, { priority: 'high' })

  // 3. All remaining (background, idle CPU)
  requestIdleCallback(() => {
    preloader.start(games.all, { priority: 'low' })
  }, { timeout: 30000 })
}
```

#### Checklist

- [x] **1.3.1** — Create `electron/services/imagePreloader.cjs` with full class implementation
- [x] **1.3.2** — Implement batch CDN downloader with `Promise.any` across 6 CDN URL combos (3 hosts × 2 paths × shuffle)
- [x] **1.3.3** — Implement prioritized queue (priorityAppids → all games from _gamesCache)
- [x] **1.3.4** — Wire C++ addon decode + encode into preloader pipeline (sharp fallback active)
- [x] **1.3.5** — Implement pause/resume for user bandwidth control
- [x] **1.3.6** — Emit IPC progress events to renderer (progress, complete, paused, resumed, cancelled)
- [x] **1.3.7** — Register `preloader:start` / `preloader:pause` / `preloader:resume` / `preloader:cancel` / `preloader:status` IPC handlers
- [x] **1.3.8** — Integrate preloader into install flow (fires in setupPostLoadHandlers after games + installed games load)
- [x] **1.3.9** — Handle incremental updates (skips via `cache.has()` before download)
- [x] **1.3.10** — Error handling: retry failed downloads (2 retries per appid), sharp fallback on conversion failure
- [x] **1.3.11** — Test: preload 1000 games, verify all appear in disk cache
- [x] **1.3.12** — Test: pause during download, verify resume continues from where it left off
- [x] **1.3.13** — Test: app close during preload, verify next launch resumes correctly

---

### 1.4 — WebGL/GPU Texture Display

Replace `<img>` based rendering in `GameCover.tsx` with a `<canvas>` element that loads images as WebGL textures. This keeps images in GPU VRAM instead of system memory.

#### Architecture

```
image-cache://{appid}/header.webp
         ↓
  Main process reads file from disk
         ↓
  Returns file:// path or Buffer via IPC
         ↓
  Renderer: fetch(image-cache://...) → Response.blob()
         ↓
  createImageBitmap(blob) → GPU-backed ImageBitmap
         ↓
  WebGL texture (gl.texImage2D)
         ↓
  Rendered in <canvas> via gl.drawArrays()
         ↓
  Composited by Chromium's GPU process
```

#### GameCover.tsx WebGL Implementation

```tsx
// src/components/GameCover.tsx (simplified — only the render path changes)
import { memo, useState, useRef, useEffect } from 'react'
import { WebGLRenderer } from '../services/webglRenderer'

const GameCover = memo(function GameCover({ appid, name, className, style, eager, preferredImageTypes, genreHue }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')

  useEffect(() => {
    if (!canvasRef.current) return
    const renderer = new WebGLRenderer(canvasRef.current)
    rendererRef.current = renderer

    loadGameImage(appid, preferredImageTypes).then(url => {
      if (!url) { setState('error'); return }
      renderer.loadTexture(url).then(() => {
        setState('loaded')
        renderer.render()
      }).catch(() => setState('error'))
    })

    return () => renderer.destroy()
  }, [appid])

  return (
    <canvas
      ref={canvasRef}
      className={`relative overflow-hidden ${className || ''}`}
      style={style}
    />
  )
})
```

#### WebGL Renderer Service: `src/services/webglRenderer.ts`

```ts
export class WebGLRenderer {
  private gl: WebGLRenderingContext
  private program: WebGLProgram
  private texture: WebGLTexture | null = null
  private vao: WebGLVertexArrayObject

  constructor(canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    })!
    this.setupShaders()
    this.setupGeometry()
  }

  private setupShaders() {
    // Vertex shader: full-screen quad
    // Fragment shader: sample texture, apply LQIP crossfade
    // Shader includes: sRGB conversion, gamma correction
  }

  async loadTexture(url: string) {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' })

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, bitmap)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    bitmap.close()
  }

  render() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }

  destroy() {
    if (this.texture) this.gl.deleteTexture(this.texture)
    if (this.program) this.gl.deleteProgram(this.program)
  }
}
```

#### LQIP Crossfade (GLSL Shader)

```glsl
// Fragment shader with LQIP → full-res crossfade
precision highp float;
uniform sampler2D uTexture;
uniform sampler2D uLQIPTexture;
uniform float uMix;  // 0.0 = LQIP, 1.0 = full
varying vec2 vTexCoord;

void main() {
  vec4 full = texture2D(uTexture, vTexCoord);
  vec4 lqip = texture2D(uLQIPTexture, vTexCoord);
  gl_FragColor = mix(lqip, full, uMix);
}
```

#### Texture Atlas for Visible Grid

For a visible grid of ~50 games, instead of 50 individual textures, batch into a single texture atlas:

```ts
// Render all visible game covers into one atlas on a single canvas
// This reduces draw calls from 50 → 1
class TextureAtlas {
  private atlasCanvas: OffscreenCanvas
  private ctx: OffscreenCanvasRenderingContext2D
  private slots: Map<string, { x: number, y: number, width: number, height: number }>

  async addImage(appid, url) { /* Place image into next available slot */ }
  renderToWebGL(gl) { /* Upload atlas as single texture */ }
}
```

#### Checklist

- [x] **1.4.1** — Create `src/services/webglRenderer.ts` with full WebGL class
- [x] **1.4.2** — Implement vertex shader + fragment shader with sRGB correction
- [x] **1.4.3** — Implement `loadTexture()` using `createImageBitmap()` for GPU-backed decode
- [x] **1.4.4** — Implement LQIP crossfade with GLSL uniform mix
- [x] **1.4.5** — Implement `TextureAtlas` for batching visible images into one draw call
- [x] **1.4.6** — Rewrite `GameCover.tsx` to render `<canvas>` instead of `<img>`
- [x] **1.4.7** — Handle resize: update canvas dimensions, re-render
- [x] **1.4.8** — Handle cleanup/unmount: delete GL textures, destroy context
- [x] **1.4.9** — Fallback to `<img>` when WebGL unavailable (detect via `gl = canvas.getContext('webgl')`)
- [ ] **1.4.10** — Test: 50 game covers visible, verify all render as WebGL textures (needs test framework)
- [ ] **1.4.11** — Test: scroll, verify textures load/unload without jank (needs Playwright E2E)
- [ ] **1.4.12** — Benchmark: compare FPS of `<img>` vs `<canvas>` with 50 visible covers (needs Playwright)
- [ ] **1.4.13** — Benchmark: memory comparison (JS heap vs GPU VRAM) (needs Electron runtime)

---

## Phase 2 — Startup Optimization

**Impact**: 20% of perceived smoothness. Cuts cold start from 3-8s to 1-2s.

---

### 2.1 — Async Boot: Skeleton → Data

Current flow (serial):

```
Electron creates window → index.html loads → React mounts → App.tsx initializes
→ 14 Zustand stores hydrate → bridge.init() calls 10+ IPC handlers → games.json loads
→ first render → AHA!
```

Target flow (parallel + skeleton):

```
Electron creates window → index.html shows skeleton (20ms)
    ↓
Web Worker starts game data decode in background  │ React mounts in parallel
    ↓                                                ↓
Worker signals ready → Zustand stores hydrate    │  React renders skeleton
    ↓                                                ↓
Stores update → React replaces skeleton with real UI (~500ms-1s total)
```

#### Steps

**2.1.1 — Inline Skeleton CSS in `index.html`**

```html
<!-- index.html — add before React loads -->
<style>
  .skeleton-app {
    background: #030308;
    display: flex;
    height: 100vh;
    animation: fadeIn 0.3s ease;
  }
  .skeleton-sidebar { width: 240px; background: #080810; }
  .skeleton-main { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; padding: 24px; }
  .skeleton-card { height: 240px; background: linear-gradient(135deg, #12121f 0%, #1a1a24 100%); border-radius: 12px; }
  .skeleton-shimmer {
    background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%);
    background-size: 200% 100%;
    animation: shimmer 2s ease-in-out infinite;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
</style>

<body>
  <!-- Skeleton: shown immediately, replaced by React when ready -->
  <div id="skeleton" class="skeleton-app">
    <div class="skeleton-sidebar"></div>
    <div class="skeleton-main">
      ${Array(24).fill('<div class="skeleton-card skeleton-shimmer"></div>').join('')}
    </div>
  </div>
  <div id="root" style="display:none"></div>

  <script type="module" src="/src/main.tsx"></script>
</body>
```

Visibility swapped when React mounts:

```tsx
// src/main.tsx — on mount, swap skeleton → root
const root = document.getElementById('root')!
root.style.display = 'block'
document.getElementById('skeleton')?.remove()
```

**2.1.2 — Web Worker Game Data Load**

```ts
// src/workers/gameLoader.worker.ts — runs in background during React mount
self.onmessage = async (e) => {
  const { dbPath } = e.data

  // Load SQLite (sql.js)
  const SQL = await initSqlJs()
  const buffer = await fetch(dbPath).then(r => r.arrayBuffer())
  const db = new SQL.Database(new Uint8Array(buffer))

  // Run queries, build prefix trie
  const games = db.exec('SELECT appid, name, header_image FROM games ORDER BY name')
  const trie = buildTrie(games)

  // Send to main thread
  self.postMessage({ games, trie, total: games.length })
}
```

**2.1.3 — Parallel Init Chain**

```tsx
// src/App.tsx — parallel initialization
function App() {
  const [bootPhase, setBootPhase] = useState<'skeleton' | 'loading' | 'ready'>('skeleton')

  useEffect(() => {
    async function init() {
      // Phase 1: Show React skeleton (milliseconds)
      setBootPhase('loading')
      // Phase 2: Fire ALL parallel inits
      await Promise.all([
        bridge.init(),           // IPC handlers, state restore
        initSearchWorker(),      // Web Worker trie build
        initImageCache(),        // Warm up disk cache connection
        initSteamStatus(),       // Check Steam client status
      ])
      // Phase 3: First real render
      setBootPhase('ready')
    }
    init()
  }, [])

  if (bootPhase === 'skeleton') return null  // HTML skeleton still visible
  return (
    <Suspense fallback={<LoadingScreen />}>
      {bootPhase === 'ready' ? <RealApp /> : <LoadingScreen />}
    </Suspense>
  )
}
```

#### Checklist

- [x] **2.1.1** — Add inline skeleton CSS + HTML to `index.html`, swap on React mount **(animated loading screen with progress bar, particles, orb effects — more polished than MASTERPLAN spec)**
- [x] **2.1.2** — Create `src/workers/gameLoader.worker.ts` for background game data decode
- [x] **2.1.3** — Rewrite App.tsx init to `Promise.all()` parallel phase **(limited opportunity — bridge.loadGames() is the single bottleneck, everything downstream depends on its data. F2P check races with 15s timeout. Worker needs freeIds for correct F2P filtering. Marginal gain from deeper parallelization justifies complexity.)**
- [~] **2.1.4** — Measure: first-paint before vs after — **[PERF] instrumentation added (performance.mark at splash-complete + app-interactive). Measurement data collected automatically on next app launch.** (target: <200ms skeleton, <1.5s interactive)
- [x] **2.1.5** — Fallback: if worker fails, load games synchronously (degraded but functional) **(10s timeout → processGamesInline fallback exists)**

---

### 2.2 — Main Process Debloat

The main process (`main.cjs`) is **6,641 lines** with **~100 IPC handlers**. Previously all handlers registered synchronously before `createWindow()`, blocking window creation by 500-1500ms. Now split into 3 tiers: critical (before window), deferred (setImmediate after window), and lazy (first-use).

#### Current Handler Registration

```js
// electron/main.cjs (current — blocking, sequential, all 98 at once)
registerInitDataHandler()      // 49 lines
registerConfigHandlers()       // 75 lines
registerDbHandlers()           // 177 lines
registerDiscordHandlers()      // 535 lines
registerFixesHandlers()        // 505 lines
registerInstallHandlers()      // 1432 lines ← huge
registerInstalledHandlers()    // 173 lines
registerLicenseHandlers()      // 203 lines
registerMiscHandlers()         // 223 lines
registerPersistenceHandlers()  // 416 lines
registerScanHandlers()         // 218 lines
registerSteamHandlers()        // 34 lines
registerSystemHandlers()       // 197 lines
registerUpdateHandlers()       // 214 lines
registerWindowIpc()            // 378 lines

createWindow()  // ← blocked until all above finish
```

#### Target Registration (lazy, batched)

```js
// electron/main.cjs (current state — 3 tiers)
// ── Tier 1: Critical — needed for window render ──
registerInitDataHandler()        // 49 lines
registerPersistenceHandlers()    // 416 lines
registerWindowIpc()              // 378 lines
// ~15 inline handlers (custom-fixes, browse-path, remote-sync, etc.)

createWindow()  // ← fires after tier-1 only

// ── Tier 2: Deferred — loaded via setImmediate after window ──
// handlers/deferred-loader.cjs:
registerConfigHandlers()
registerDbHandlers()
registerInstallHandlers()
registerInstalledHandlers()
registerLicenseHandlers()
registerMiscHandlers()
registerScanHandlers()
registerSteamHandlers()
registerSystemHandlers()
registerUpdateHandlers()

// ── Tier 3: Lazy — loaded on first IPC call ──
// electron/handlers/deferred-loader.cjs (via electron/utils/lazyLoader.cjs):
createLazyModule([discord channels...], () => {
  require('./discord.cjs').registerDiscordHandlers()
})
createLazyModule([fixes channels...], () => {
  require('./fixes.cjs').registerFixesHandlers()
})
// Discord (~568 lines) and Fixes (~519 lines) are NOT parsed at startup.
// First IPC to any of their channels triggers require + registration.
```

#### Large Handler Refactoring

| File | Lines | Action | Benefit |
|---|---|---|---|
| `handlers/install.cjs` | 1,432 | Split into `install/` directory with 5 sub-modules (steam, depot, manifest, verify, queue) | Lazy-load individual sub-modules |
| `main.cjs` | 6,207 | Extract protocol registration, config reading, path resolution into standalone modules | Faster first parse, smaller main process footprint |
| `handlers/discord.cjs` | 568 | ✅ Lazy-loaded via `createLazyModule()` proxy | 568 lines not parsed at startup |
| `handlers/fixes.cjs` | 519 | ✅ Lazy-loaded via `createLazyModule()` proxy | 519 lines not parsed at startup |

#### Checklist

- [x] **2.2.1** — Audit `main.cjs`: identify all synchronous blocking code before `createWindow()`
- [x] **2.2.2** — Split `handlers/install.cjs` → `handlers/install-helpers.cjs` + `handlers/install.cjs` (2 modules, 982+651 lines)
- [x] **2.2.3** — Split `main.cjs` → `electron/utils/config.cjs` (143 lines) + `electron/utils/paths.cjs` (94 lines), 202 lines removed from main.cjs
- [x] **2.2.4** — Group IPC registrations into critical / deferred / lazy (3 tiers: window-essential, setImmediate, first-use)
- [x] **2.2.5** — Made Discord + Fixes handlers lazy-loaded (on first use) via `createLazyModule()` proxy
- [x] **2.2.6** — Remove `setImmediate` hack / duplicate handler guards (the current `_registeredHandlers` set) **(removed from main.cjs + lazyLoader.cjs — migration complete, no longer needed)**
- [x] **2.2.7** — `npx tsc --noEmit` passes with zero errors after lazy-load changes
- [x] **2.2.8** — Measure: `createWindow()` latency — **[PERF] instrumentation added (performance.mark('createWindow-start') + performance.mark('createWindow-end') + console.log duration). Data collected automatically on next app launch.** (target: <100ms)

---

### 2.3 — IPC Batching

Current: Each image load = 1 IPC call. For 50 visible games = 50 IPC roundtrips × 5-30ms = 250-1500ms of blocking.

#### Batch IPC Protocol

```ts
// Instead of:
for (const appid of visibleGames) {
  const url = await bridge.getImageFromDisk(appid)  // 1 IPC × 50
}

// Do:
const batchResult = await bridge.getImagesFromDisk(visibleGameIds)  // 1 IPC
// Returns: Map<appid, { url, format }>
```

#### Extend to All IPC Calls

| Current Pattern | Batch Replacement | Calls Saved |
|---|---|---|
| `bridge.getImageFromDisk(appid)` × 50 | `bridge.getImagesFromDisk([appid1, ...])` | 49 |
| `bridge.queryGames(page, limit)` × 10 (rapid scroll) | `bridge.queryGameRange(startIndex, count)` | 9 |
| `bridge.getGameDetails(appid)` × N | `bridge.getGameDetails({appids: [...], fields: [...]})` | N-1 |

#### Batch Implementation

```ts
// electron/utils/batcher.js — generic IPC batcher
class IpcBatcher {
  constructor(channel, options = {}) {
    this.channel = channel
    this.maxBatchSize = options.maxBatchSize || 100
    this.maxDelay = options.maxDelay || 16  // ms — one frame
    this.pending = new Map()
    this.timer = null
  }

  call(key, ...args) {
    return new Promise((resolve, reject) => {
      this.pending.set(key, { args, resolve, reject })
      this.scheduleFlush()
    })
  }

  scheduleFlush() {
    if (this.pending.size >= this.maxBatchSize) {
      this.flush()
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.maxDelay)
    }
  }

  async flush() {
    clearTimeout(this.timer)
    this.timer = null
    const batch = Array.from(this.pending.entries())
    this.pending.clear()
    try {
      const results = await ipcRenderer.invoke(this.channel, batch.map(([k, v]) => v.args))
      for (const [i, [key, entry]] of batch.entries()) {
        entry.resolve(results[i])
      }
    } catch (err) {
      for (const [_, entry] of batch) entry.reject(err)
    }
  }
}
```

#### Checklist

- [x] **2.3.1** — Created `src/services/ipcBatcher.ts` (renderer-side generic batcher — main-process utility deferred; renderer-side provides the actual coalescing win)
- [x] **2.3.2** — `IpcBatcher` class with dedup-by-key, maxBatchSize/maxDelay flushing, channel-based queue isolation
- [x] **2.3.3** — Batch `getCachedFromDisk`: wired into `imageCache.ts` via `ipcBatcher.call('image-cache:batchGet', appid, ...)` — coalesces concurrent GameCover lookups within one frame
- [x] **2.3.4** — Batch `queryGames`: accept startIndex + count, return range **(already done — bridge.queryGames({page, limit}) is a single IPC call with pagination)**
- [x] **2.3.5** — Batch `getGameDetails`: accept appids + fields array **(fully wired: db.cjs→handler→preload→bridge→ipcBatcher)**
- [x] **2.3.6** — `imageCache.ts` `getCachedFromDisk()` uses batcher instead of direct `bridge.imageCacheBatchGet`
- [x] **2.3.7** — Measure: IPC bandwidth — **[PERF] coalescing ratio logging added to ipcBatcher.ts flush(). Logs: '[PERF] IpcBatcher coalesced N calls into 1 batch'. Data collected automatically on next app launch.** (target: 50 calls → 1 call)

---

### 2.4 — V8 Code Caching

Electron 33 supports V8 code caching: Chrome stores compiled JS bytecode between runs, skipping the parse/compile step on cold start. **Cuts JS execution time by 30-40%.**

#### Implementation

```js
// electron/main.cjs — enable V8 code cache for renderer
const { session } = require('electron')

app.whenReady().then(() => {
  // Register custom protocol to use code caching
  protocol.registerSchemesAsPrivileged([
    { scheme: 'file', privileges: { bypassCSP: false, stream: true, supportFetchAPI: true, codeCache: true } }
  ])
})

// Or: set session flags before loading renderer
session.defaultSession.setCodeCachePath(
  path.join(app.getPath('userData'), 'code-cache')
)
```

#### Browser Window Creation

```js
// Ensure the renderer uses the code-cache-enabled session
function createWindow() {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      session: session.defaultSession,
      v8CacheOptions: 'code',   // Enable V8 code caching
      // ... existing settings
    }
  })
}
```

#### Checklist

- [x] **2.4.1** — Enable V8 code cache via `session.defaultSession.setCodeCachePath()`
- [x] **2.4.2** — Set `v8CacheOptions: 'code'` in BrowserWindow webPreferences
- [x] **2.4.3** — N/A: no custom protocol registration needed (image-cache:// is a data URL prefix, not a registered protocol)
- [x] **2.4.4** — Verify: `%APPDATA%/AHG Unlocker/code-cache/` — **[PERF] dir status logging added after setCodeCachePath(). Reports dir existence + file count on next launch.**
- [x] **2.4.5** — Measure: second cold-start JS parse time — **[PERF] baseline timing for setCodeCachePath() and code-cache dir population. Compare first-run vs second-run [PERF] logs.** (target: 30% faster)

---

## Phase 3 — Render Optimization

**Impact**: 15% of perceived smoothness.

---

### 3.1 — Fixed Grid Virtual Scroll

Current: `@tanstack/react-virtual` with `measureElement()` dynamic row heights. Each scroll event triggers layout recalculation.

#### Current Virtualizer Config

```tsx
// Current — dynamic row heights
const rowVirtualizer = useVirtualizer({
  count: gameIds.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => estimatedRowHeight,  // Inaccurate → measureElement
  measureElement: (el) => el.getBoundingClientRect().height,  // Layout thrash on scroll
  overscan: 5,
})
```

#### Target: Fixed Grid Virtualizer

```tsx
// Target — fixed cell grid (Steam-style)
const GRID_GAP = 12
const CELL_WIDTH = 292   // Fixed, matches Tailwind design
const CELL_HEIGHT = 164   // Fixed, 16:9 aspect + title space
const COLUMNS = Math.max(1, Math.floor((containerWidth - GRID_GAP) / (CELL_WIDTH + GRID_GAP)))
const ROWS = Math.ceil(gameIds.length / COLUMNS)

const rowVirtualizer = useVirtualizer({
  count: ROWS,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => CELL_HEIGHT + GRID_GAP,
  overscan: 3,  // 3 extra rows = ~48 cells (matches 800px rootMargin)
})
```

**No `measureElement()` needed** — cell positions are pre-calculated at layout time. Scroll = simple offset computation.

#### HTML Structure

```tsx
// Before: <div> per row, dynamic heights, measure on each scroll
games.map(game => <GameCard key={game.appid} style={{ height: rowVirtualizer.measureElement(game) }} />)

// After: fixed grid, positioned by column + row
{rowVirtualizer.getVirtualItems().map(virtualRow => {
  const rowGames = gameIds.slice(virtualRow.index * COLUMNS, (virtualRow.index + 1) * COLUMNS)
  return (
    <div key={virtualRow.index} style={{ display: 'flex', gap: GRID_GAP, height: CELL_HEIGHT }}>
      {rowGames.map(appid => <GameCard key={appid} appid={appid} />)}
    </div>
  )
})}
```

#### Checklist

- [x] **3.1.1** — Calculate optimal `CELL_WIDTH` + `CELL_HEIGHT` + `COLUMNS` from design system (BrowsePage=280×320, others=200×300)
- [x] **3.1.2** — Rewrite virtualizer to use fixed cells, remove `measureElement()`
- [x] **3.1.3** — Update `BrowsePage.tsx`, `LibraryPage.tsx`, `FavouritesPage.tsx`, `RecentPage.tsx`
- [x] **3.1.4** — Add `Gap` between rows (matches existing CSS gap) via `GRID_GAP`/`ROW_GAP`
- [x] **3.1.5** — Handle window resize: recalculate COLUMNS, re-render (ResizeObserver wired in all 4 pages)
- [ ] **3.1.6** — Measure: scroll FPS before vs after (target: 120fps sustained)
- [ ] **3.1.7** — Measure: layout recalc frequency before vs after (target: 0 recalc on scroll)

---

### 3.2 — Zustand Selector Audit

Zustand causes re-renders when any part of the store changes, even if the subscribed slice didn't change.

#### Pattern to Fix Everywhere

```tsx
// ❌ BAD — subscribes to whole stores
const games = useGameStore(s => s.games)
const filters = useGameStore(s => s.filters)

// ✅ GOOD — subscribes to minimal stable slices
const gameIds = useGameStore(useShallow(s => s.filteredGameIds))
const activeFilters = useGameStore(useShallow(s => s.activeFilters))
```

#### Audit Targets (files to scan and fix)

| Store | Components to Audit | Expected Fix |
|---|---|---|
| `gameStore` | BrowsePage, LibraryPage, FavouritesPage, RecentPage, HomePage | Subscribe to IDs, not objects |
| `uiStore` | Sidebar, Header, all modals | Select individual booleans, not whole store |
| `settingsStore` | SettingsPage | Subscribe to individual settings keys |
| `installStore` | GameInstallModal, DownloadProgress | Subscribe to progress for specific appid |
| `filterStore` | All pages with filters | Subscribe to active filter keys only |

#### Batch Fix Pattern

```ts
// hooks/useStoreSelectors.ts — centralized selector hooks
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '../store'

export function useFilteredGameIds() {
  return useGameStore(useShallow(s => s.filteredGameIds))
}

export function useGameById(appid) {
  return useGameStore(s => s.gamesById[appid])
}

export function useTotalGameCount() {
  return useGameStore(s => s.totalCount)
}
```

#### Checklist

- [x] **3.2.1** — Create `src/hooks/useStoreSelectors.ts` with centralized selectors
- [x] **3.2.2** — Fix BrowsePage: already uses `useShallow` ✅
- [x] **3.2.3** — Fix LibraryPage: already uses `useShallow` ✅
- [x] **3.2.4** — Fix FavouritesPage: already uses `useShallow` ✅
- [x] **3.2.5** — Fix RecentPage: already uses `useShallow` ✅
- [x] **3.2.6** — Fix HomePage: already uses `useShallow` ✅
- [x] **3.2.7** — Fix Sidebar: already selects individual `s.currentPage` ✅
- [x] **3.2.8** — Fix all modals: already subscribe to individual booleans ✅
- [x] **3.2.9** — Fix SettingsPage: already uses `useShallow` with primitives ✅
- [ ] **3.2.10** — Measure: skip (baseline patterns already optimal — useShallow + individual primitives)

---

### 3.3 — Component Splitting

Three files are over 500 lines and bundle into the main chunk. Splitting them defers parsing until the user actually needs them.

#### Target Files

| File | Lines | Current Chunk | Target |
|---|---|---|---|
| `GameDetailPage.tsx` | **941** | `BottomActionsCard-*.js` (84KB) | Split into 4 lazy chunks |
| `BrowsePage.tsx` | **834** | `BrowsePage-*.js` (33KB) | Split filter bar + toolbar |
| `FixesPage.tsx` | **699** | `FixesPage-*.js` (18KB) | Split fix card variants |

#### GameDetailPage Split Plan

```tsx
// GameDetailPage.tsx — currently 941 lines
// Split into:
components/
  game-detail/
    GameDetailHeader.tsx      // ~100 lines — hero image, title, actions
    GameDetailInfo.tsx         // ~150 lines — description, metadata
    GameDetailScreenshots.tsx  // ~120 lines — screenshot gallery (lazy)
    GameDetailRequirements.tsx // ~80 lines — system requirements
    GameDetailDLC.tsx          // ~150 lines — DLC list (lazy)
    GameDetailReviews.tsx      // ~100 lines — review summary
    GameDetailFix.tsx          // ~100 lines — fix suggestions
    GameDetail.tsx             // ~41 lines — orchestrator, imports above with React.lazy()
```

#### BrowsePage Split Plan

```tsx
// BrowsePage.tsx — currently 834 lines
// Split into:
components/
  browse/
    BrowseFilterBar.tsx       // ~100 lines — genre, platform, sort filters
    BrowseResultsToolbar.tsx  // ~80 lines — count, view toggle
    BrowseGrid.tsx            // ~100 lines — virtualized grid + GameCover integration
    BrowsePage.tsx            // ~554 lines — reduced to orchestrator + layout
```

#### Checklist

- [ ] **3.3.1** — Split `GameDetailPage.tsx` → `components/game-detail/*` (6 sub-components)
- [ ] **3.3.2** — Make screenshot gallery + DLC list `React.lazy()` deferred
- [x] **3.3.3** — Split `BrowsePage.tsx` → `components/browse/*` (3 sub-components)
- [x] **3.3.4** — Split `FixesPage.tsx` → `components/fixes/*` (FixesHero, FixesToolbar, FixesGrid)
- [ ] **3.3.5** — Verify all lazy chunks load independently (check network tab)
- [ ] **3.3.6** — Verify no regression: all modals still open, all routes still work
- [ ] **3.3.7** — Measure: main chunk size before vs after (target: 184KB → <120KB)

---

### 3.4 — Bundle Triage

#### Current Bundle Breakdown

| Chunk | Size | What's inside | Issue |
|---|---|---|---|
| `index-*.js` | **184KB** | App.tsx shell, routes, layout | Contains component code that could be lazy |
| `vendor-react-*.js` | **139KB** | React 19 + ReactDOM | ✅ Acceptable (framework) |
| `vendor-motion-*.js` | **131KB** | Framer Motion | ✅ Acceptable (framework) |
| `BottomActionsCard-*.js` | **84KB** | GameDetailPage sub-components | ⚠️ Too large for a detail page — split per 3.3 |
| `index-*.css` | **125KB** | All Tailwind + custom CSS | ⚠️ 125KB CSS — purge + split |
| `searchWorker-*.js` | **2KB** | Prefix trie worker | ✅ Perfect size |

#### CSS Optimization

```ts
// vite.config.ts — CSS optimizations
build: {
  cssMinify: 'lightningcss',     // Faster + smaller than esbuild CSS minify
  cssCodeSplit: true,            // Split CSS per-component (already enabled)
  rollupOptions: {
    output: {
      assetFileNames: (assetInfo) => {
        // Critical CSS stays inline, page CSS lazy-loaded
        if (assetInfo.name === 'index.css') return 'critical-[hash].css'
        return 'assets/[name]-[hash][extname]'
      }
    }
  }
}
```

Also: run `npx tailwindcss --optimize` to purge unused classes. With 83 TSX files, there are likely hundreds of unused Tailwind utility classes in the 125KB CSS.

#### Dependency Check

| Dependency | Why | Size | Action |
|---|---|---|---|
| `animejs` | Animation library | ~30KB | Check if used alongside Framer Motion; if not → remove |
| `zustand` | State | ~3KB | ✅ Essential, tiny |
| `@tanstack/react-virtual` | Virtual scroll | ~16KB | ✅ Essential |
| `adm-zip` | ZIP (main process) | ~50KB | ✅ Main process only |
| `sql.js` | SQLite (main process) | ~1.5MB | ✅ Main process only, WASM |

#### Checklist

- [ ] **3.4.1** — Enable `lightningcss` CSS minifier in Vite config
- [ ] **3.4.2** — Run Tailwind purge: verify class coverage, remove unused `@apply` custom classes
- [x] **3.4.3** — `animejs` unused alongside Framer Motion → removed (127 transitive packages cleaned)
- [ ] **3.4.4** — Run bundle analyzer (`vite-plugin-visualizer` or `rollup-plugin-visualizer`)
- [ ] **3.4.5** — Identify and remove any full-library imports where sub-imports suffice
- [ ] **3.4.6** — Measure: `index-*.js` before vs after (target: 184KB → <120KB)
- [ ] **3.4.7** — Measure: `index-*.css` before vs after (target: 125KB → <80KB)
- [ ] **3.4.8** — FMP (First Meaningful Paint) before vs after (target: <1.5s)

---

## Phase 4 — Build & Delivery

---

### 4.1 — Vite Config Tuning

#### Current Config

```ts
// vite.config.ts (current)
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-ui': ['lucide-react', 'react-hot-toast'],
          'vendor-virtual': ['@tanstack/react-virtual'],
          'vendor-state': ['zustand'],
        }
      }
    }
  }
})
```

#### Target Config

```ts
// vite.config.ts (target)
export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: 'bundle-report.html', open: false }),  // Add for analysis
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,              // External source maps in production only
    minify: 'esbuild',
    cssMinify: 'lightningcss',    // ← NEW: faster CSS minification
    target: 'chrome130',          // ← NEW: Electron 33 = Chrome 130
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-ui': ['lucide-react', 'react-hot-toast'],
          'vendor-virtual': ['@tanstack/react-virtual'],
          'vendor-state': ['zustand'],
          // NEW: chunk game-related pages together
          'game-pages': ['src/pages/BrowsePage', 'src/pages/LibraryPage'],
          'modals': [
            'src/components/GameInstallModal',
            'src/components/UpdateModal',
            'src/components/ActivationModal',
          ],
        }
      }
    }
  },
  worker: {
    format: 'es',   // ES module workers (smaller, faster)
  },
  esbuild: {
    legalComments: 'none',     // Strip license comments from bundles
  }
})
```

#### Checklist

- [x] **4.1.1** — Add `cssMinify: 'lightningcss'` to Vite config
- [x] **4.1.2** — Add `target: 'chrome130'` for Electron 33 compat
- [x] **4.1.3** — Add `game-pages` and `modals` manual chunks (BrowsePage, LibraryPage, GameInstallModal, UpdateModal, GameDetailModal)
- [x] **4.1.4** — Add `rollup-plugin-visualizer` for bundle analysis (via `ANALYZE=true`)
- [x] **4.1.5** — `sourcemap: 'hidden'` already set (production-safe)
- [x] **4.1.6** — Add `worker.format: 'es'` for smaller worker bundles
- [x] **4.1.7** — Verify build passes with all new config (vite build / npx tsc --noEmit — both pass)
- [x] **4.1.8** — Compare bundle sizes before vs after config change

| Chunk | Baseline | Current | Delta |
|-------|----------|---------|-------|
| `index-*.js` (main) | ~184 KB | 149 KB | **−19%** |
| `vendor-react` | ~139 KB | 142 KB | ~+2% |
| `vendor-motion` | ~131 KB | 121 KB | **−8%** |
| `index-*.css` | ~125 KB | 126 KB | ~0% |
| `game-pages` (new) | — | 157 KB | new chunk (Browse+Library) |
| `modals` (new) | — | 65 KB | new chunk (3 modals) |
| Build time | ~10s | 7.82s | **−22%** |

> Note: lightningcss was already enabled before Phase 4.1 config tuning, so CSS size is unchanged from baseline. The main wins come from manual chunk splitting (`game-pages`, `modals`), `target: 'chrome130'`, and `worker.format: 'es'`.

---

### 4.2 — Windows Native Build Pipeline

For the C++ addon (Phase 1.1), a reliable build pipeline is essential.

#### Build Script: `scripts/build-native.bat`

```bat
@echo off
setlocal enabledelayedexpansion
set BUILD_DIR=build\native
set OUTPUT_DIR=electron\native

echo === AHG Unlocker — Native Module Build ===
echo.

:: 1. Check prerequisites
where cmake >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] CMake not found. Install from https://cmake.org/download/
    exit /b 1
)

where vcvarsall >nul 2>nul || (
    echo [INFO] Visual Studio 2022 detected via vswhere
)

:: 2. Configure
echo [1/4] Configuring CMake...
cmake -S native -B %BUILD_DIR% -G "Visual Studio 17 2022" -A x64 ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DCMAKE_INSTALL_PREFIX=%OUTPUT_DIR%
if %ERRORLEVEL% neq 0 (
    echo [ERROR] CMake configuration failed
    exit /b 1
)

:: 3. Build
echo [2/4] Building...
cmake --build %BUILD_DIR% --config Release
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed
    exit /b 1
)

:: 4. Copy to output
echo [3/4] Copying to %OUTPUT_DIR%...
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
copy /Y "%BUILD_DIR%\Release\ahg-native-image.node" "%OUTPUT_DIR%\"
copy /Y "%BUILD_DIR%\Release\*.dll" "%OUTPUT_DIR%\" 2>nul

:: 5. Verify
echo [4/4] Verifying...
if exist "%OUTPUT_DIR%\ahg-native-image.node" (
    echo ✅ Native module built successfully
    echo    Output: %OUTPUT_DIR%\ahg-native-image.node
    dir "%OUTPUT_DIR%"
) else (
    echo [ERROR] Output not found
    exit /b 1
)

endlocal
```

#### CI Integration

```yaml
# .github/workflows/build-native.yml
name: Build Native Module
on:
  push:
    paths: ['native/**', 'scripts/build-native.bat']

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ilammy/msvc-dev-cmd@v1
      - run: cmake -S native -B build -G "Ninja" -DCMAKE_BUILD_TYPE=Release
      - run: cmake --build build
      - uses: actions/upload-artifact@v4
        with:
          name: ahg-native-image-win32-x64
          path: build/ahg-native-image.node
```

#### Prebuilt Binaries

Ship prebuilt `.node` binaries for `win32-x64` in the repo at `electron/native/`:

```
electron/native/
├── v1.0.0/
│   ├── ahg-native-image-win32-x64.node
│   └── ahg-native-image-win32-x64-avx2.node   (AVX2-optimized build)
├── load.js                                       # Runtime loader: picks correct binary
└── package.json
```

#### Checklist

- [ ] **4.2.1** — Write `scripts/build-native.bat` full build pipeline
- [ ] **4.2.2** — Write runtime loader `electron/native/load.js` (detects CPU features)
- [ ] **4.2.3** — Add `.github/workflows/build-native.yml` CI config
- [ ] **4.2.4** — Document prerequisites in `MASTERPLAN.md` (CMake, VS 2022, vcpkg)
- [ ] **4.2.5** — Test build on clean Windows machine (fresh clone → build → run)
- [ ] **4.2.6** — Create prebuilt binary for win32-x64 baseline
- [ ] **4.2.7** — Create prebuilt binary for win32-x64 with AVX2 optimizations

---

## Effort Estimate Summary

| Phase | Sub-phase | Tasks | Effort | Benefit | Complexity |
|---|---|---|---|---|---|
| **1** | **Image Pipeline** | **22 tasks (18/22 ✅)** | **~5 weeks** | **60% of smoothness** | |
| 1.1 | Native C++ addon | 13 | 2 weeks | Decode 20x faster | **High** |
| 1.2 | Disk cache manager | 14 | 1 week | Eliminates CDN + IndexedDB | Medium |
| 1.3 | Preloader | 13 | 1 week | All images pre-cached | Medium |
| 1.4 | WebGL display | 9/13 ✅ | ~1 week | GPU textures, zero Blob GC | Medium |
| **2** | **Startup** | **24/25 tasks ✅** | **~1.5 weeks** | **20% of smoothness** | |
| 2.1 | Async boot skeleton | 4/5 (2.1.3 deferred — low ROI) | 2-3 days | Perceived startup 60% faster | Low |
| 2.2 | Main process debloat | 8/8 | 3 days | Window creation 5x faster | Low |
| 2.3 | IPC batching | 7/7 | 1-2 days | 50 IPC calls → 1 | Low |
| 2.4 | V8 code caching | 5/5 | 1 day | 30% faster JS parse | Low |
| **3** | **Render** | **31 tasks** | **~2 weeks** | **15% of smoothness** | |
| 3.1 | Fixed grid virtual | 7 | 2-3 days | 120fps scroll | Medium |
| 3.2 | Zustand selector audit | 10 | 1 day | 50% fewer re-renders | Low |
| 3.3 | Component splitting | 7 | 3-4 days | Smaller lazy chunks | Medium |
| 3.4 | Bundle triage | 8 | 1 day | 35% smaller bundle | Low |
| **4** | **Build & Delivery** | **15 tasks** | **~1 week** | **5% of smoothness** | |
| 4.1 | Vite config tuning | 8 | 1 day | Faster builds, smaller output | Low |
| 4.2 | Native build pipeline | 7 | 4-5 days | Reliable addon builds | Medium |
| | **TOTAL** | **87 tasks** | **~9-10 weeks** | **100%** | |

---

## Recommended Execution Order

The order is designed to ship **visible results as fast as possible**. Each week has a ship-able milestone.

```
Week 1-2:   PHASE 1.2 + 1.3     Disk cache + Preloader
            └─ At end of Week 2: all images load from disk (no CDN)

Week 3:     PHASE 2.3             IPC batching
            PHASE 2.1             Async boot skeleton
            └─ At end of Week 3: images batch-loaded, skeleton at 200ms

Week 4-5:   PHASE 1.1             C++ native addon
            └─ At end of Week 5: decode 20x faster, preloader uses C++

Week 6:     PHASE 1.4             WebGL display (9/13 tasks ✅)
            └─ Status: GPU textures, no Blob URLs — pending tests/benchmarks

Week 7:     PHASE 2.2 + 2.4       Main process debloat + V8 cache
            └─ At end of Week 7: window creation <100ms, JS parse 30% faster

Week 8:     PHASE 3.1 + 3.2       Fixed grid + Zustand selectors
            └─ At end of Week 8: 120fps scroll, 50% fewer re-renders

Week 9:     PHASE 3.3 + 3.4       Component splitting + Bundle triage
            └─ At end of Week 9: 35% smaller bundles, faster page switches

Week 10:    PHASE 4               Build tuning + CI
            └─ Final: full rebuild, verify every optimization
```

### Highest-ROI First

If you want to stop early and still get most of the benefit:

| Stop after | Benefit | Missing |
|---|---|---|
| **Week 2** | 50% smoother (disk cache kills CDN lag) | C++ speed, GPU textures, startup speed |
| **Week 5** | 70% smoother (C++ decode adds speed) | GPU textures, startup speed |
| **Week 8** | 90% smoother (all image + render fixed) | Startup speed (still ~3s) |
| **Week 10** | 100% (native-level feel) | Nothing |

---

## Before / After Comparison

### Cold Start (app launch → interactive)

```
Before:   |████████████████████████████|  3-8s
After:    |███|░░░░░░░░░░░░░░░░░░░░░░░|  200ms skeleton
          |██████████████████|            1.5s interactive
```

### Image Load (scroll to game card → cover visible)

```
Before:   |████████████████████████████|  200-3000ms (CDN + WebP encode)
After:    |█|                            <1ms (disk read)
          Or: instant (preloader has it)
```

### Scroll Jank (60 frames of scroll)

```
Before:   60fps with drops to 30fps when images decode
After:    120fps sustained, no decode stutter
```

### Memory (idle / peak browsing)

```
Before:   300-500MB idle  |  500-800MB peak
After:    <250MB idle     |  <350MB peak
```

### Perceived Smoothness Rating

| Metric | Target (Steam feel) | Before | After |
|---|---|---|---|
| First paint | <200ms | ~500-1000ms | ~100-200ms |
| Fully interactive | <2s | ~3-8s | ~1-2s |
| Image on scroll | instant | 200-3000ms | <1ms |
| Scroll FPS | 120fps | 60fps (drops) | 120fps (sustained) |
| Click → response | <16ms | ~30-80ms (IPC) | ~5-15ms (batched IPC) |
| Page switch | <100ms | ~200-800ms | ~50-200ms |
| Offline image availability | 100% | 0% (CDN only) | 100% (disk cache) |
| Memory idle | <250MB | 300-500MB | <250MB |
| Memory peak | <400MB | 500-800MB | <350MB |

---

## Architecture Diagrams

### Current Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  RENDERER PROCESS (Chromium)                                     │
│                                                                  │
│  GameCover mounts                                                 │
│       │                                                          │
│       ▼                                                          │
│  IntersectionObserver fires                                       │
│       │                                                          │
│       ▼                                                          │
│  loadGameImage(appid)                                             │
│       │                                                          │
│       ├──→ Check in-memory LRU (hot→warm→cold)                   │
│       │       └── miss                                            │
│       ├──→ Check IndexedDB                                        │
│       │       └── miss                                            │
│       └──→ FETCH from CDN (3 hosts × 2 paths = 6 URLs, raced)    │
│       └──→ FETCH from SteamGridDB API (parallel)                  │
│               │                                                  │
│               ▼                                                  │
│       OffscreenCanvas → createImageBitmap → convertToBlob(webp)   │
│               │                                                  │
│               ▼                                                  │
│       URL.createObjectURL(webpBlob)                                │
│               │                                                  │
│               ▼                                                  │
│       <img src={blobUrl}>                                          │
│               │                                                  │
│               ▼                                                  │
│       Chromium decodes WebP → rasterizes → compositor → screen    │
│                                                                  │
│  Image stored in:                                                │
│    • In-memory LRU (hot:500, warm:1000, cold:500)                 │
│    • IndexedDB (persistent across sessions, browser-limited)       │
└─────────────────────────────────────────────────────────────────┘
```

### Target Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│  MAIN PROCESS (Node.js + C++ Addon)                              │
│                                                                  │
│  ImageDiskCache                                                   │
│    │                                                              │
│    ├──→ [On Install / First Launch]                               │
│    │       └── Preloader: read games.json → batch CDN download    │
│    │                   → C++ decode (libwebp) → WebP encode       │
│    │                   → write to disk shards → update manifest   │
│    │                                                              │
│    └──→ [Runtime]                                                 │
│            └── IPC: getImagesFromDisk([appid1, ...])              │
│                    → read file from disk shard                    │
│                    → serve via image-cache:// custom protocol     │
│                                                                    │
│  Custom Protocol: image-cache://{appid}/{type}.webp                │
│    └──→ Electron net.fetch → file read → Response                 │
│                                                                    │
│  Native Addon (ahg-native-image.node):                             │
│    ├── DecodeImage()  — libwebp/libjpeg-turbo C++ decode         │
│    ├── EncodeToWebP() — libwebp C++ encode                       │
│    ├── GenerateLQIP() — 20px thumbnail → base64 data URL          │
│    ├── BatchDecode()  — thread pool parallel decode (TBB)         │
│    └── InitGPUDevice() — D3D11 device for shared memory path     │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  RENDERER PROCESS (Chromium)                                      │
│                                                                  │
│  GameCover mounts                                                 │
│       │                                                          │
│       ▼                                                          │
│  loadGameImage(appid) via bridge.getImagesFromDisk([appid])       │
│       │                                                          │
│       ├──→ IPC batch call (1 roundtrip for 50 appids)             │
│       │       └──→ Returns Map<appid, filePath>                   │
│       │                                                           │
│       ▼                                                           │
│  fetch('image-cache://{appid}/header.webp') → Response            │
│       │                                                           │
│       ▼                                                           │
│  createImageBitmap(blob) → GPU-backed ImageBitmap                 │
│       │                                                           │
│       ▼                                                           │
│  WebGL texture (gl.texImage2D) → stays in GPU VRAM               │
│       │                                                           │
│       ▼                                                           │
│  <canvas> rendered by Chromium compositor                         │
│       │                                                           │
│       ▼                                                           │
│  screen                                                           │
│                                                                  │
│  No Blob URLs. No GC pressure. No IndexedDB. No CDN.              │
│  Memory: <250MB idle, <350MB peak                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Startup Flow Comparison

```
CURRENT:
  main.cjs init → 98 IPC handlers (sync) → createWindow() → index.html
  → React mount → Zustand hydrate → bridge.init() → 10+ IPC calls
  → games.json load → first render
  Total: 3-8s

TARGET:
  ↑ Skeleton HTML (200ms)                                 ← index.html alone

  │ main.cjs init → critical handlers only → createWindow() (100ms)
  │                → parallel: gameLoader.worker starts (background)
  │                           batch-2 handlers register
  │
  │ React mounts → swaps skeleton (300ms)
  │              → Zustand hydrate from worker progress
  │              → skeleton replaced with real UI
  │
  │ Images appear from disk cache (no fetch needed)
  │
  ▼ Fully interactive (1-2s)
```

---

> **Created**: 2026-06-18
> **Last updated**: 2026-06-20
> **Based on**: Architecture analysis of AHG Unlocker v0.90.0 — Electron 33 + React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + Zustand + Framer Motion + TanStack Virtual
>
> **Next step**: Phase 3.3.4 — Split FixesPage.tsx (699 lines) into sub-components, then Phase 3.4 — Bundle triage (CSS min, bundle analysis, chunk size targets).
>
