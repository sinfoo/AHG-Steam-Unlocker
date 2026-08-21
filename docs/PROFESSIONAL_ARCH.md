# AHG Steam Unlocker - Professional Multi-Language Architecture

## Overview

This architecture separates concerns across three distinct layers:
1. **Presentation Layer** - React 19 + Vite + Tailwind (compiled, not interpreted)
2. **Orchestration Layer** - Python FastAPI (HTTP/API only, no UI)
3. **Performance Layer** - C++/C# (binary, direct OS access)

## Why Previous Versions Failed

| Issue | Cause | Fix |
|-------|-------|-----|
| Black screen | Browser in quirks mode, no styles loaded | Proper `<!DOCTYPE html>`, linked CSS |
| 2GB RAM | Loading 176K items on main thread | Worker thread + pagination |
| Thread lock | Sync loading blocking UI | Async + Web Workers |
| No styling | Missing Tailwind build step | Pre-compiled CSS |

## Directory Structure

```
ahg-unlocker/
│
├── frontend/                    # PRESENTATION LAYER
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── hooks/              # Custom React hooks  
│   │   ├── store/              # Zustand state (NOT Redux)
│   │   ├── workers/            # Web Workers for heavy lifting
│   │   ├── App.tsx             # Main entry
│   │   └── main.tsx            # DOM entry
│   ├── public/                 # Static assets (fonts, icons)
│   ├── dist/                   # ⭐ PRE-COMPILED OUTPUT
│   ├── package.json            # React dependencies
│   ├── vite.config.ts          # Vite build config
│   ├── tailwind.config.js      # Tailwind config
│   ├── tsconfig.json           # TypeScript config
│   └── index.html              # Entry HTML (with DOCTYPE!)
│
├── backend/                     # ORCHESTRATION LAYER
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/         # FastAPI endpoints
│   │   │   ├── middleware/     # Auth, logging
│   │   │   └── main.py         # FastAPI app
│   │   ├── services/           # Business logic
│   │   └── models/             # Pydantic models
│   ├── requirements.txt         # Python dependencies
│   └── pyproject.toml
│
├── core/                        # PERFORMANCE LAYER (C++/C#)
│   ├── src/
│   │   ├── game_db/            # Binary game database
│   │   ├── steam/              # Steam API wrapper
│   │   └── main.cpp            # Entry point
│   ├── include/                 # Header files
│   ├── lib/                    # Compiled binaries
│   └── CMakeLists.txt
│
├── webview/                     # DESKTOP WRAPPER
│   ├── main.cpp               # WebView2 host
│   ├── app.manifest            # DPI awareness
│   └── WebView2.cpp            # WebView2 integration
│
└── games.json                   # RAW DATA (176K entries)
```

## Build Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Vite      │───▶│   dist/     │───▶│  Electron   │
│   Build     │    │  (static)   │    │   Package   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Key Technical Decisions

### 1. WebView2 Over Electron (Critical)
- WebView2 uses Edge Chromium directly - no Electron abstraction
- Native DPI awareness support
- Modern CSS features (glassmorphism, backdrop-filter)
- Smaller memory footprint

### 2. Web Workers for 176K Data
```javascript
// workers/gameLoader.worker.ts
self.onmessage = async (e) => {
  const { page, limit, filter } = e.data
  // Load from C# core via IPC
  const games = await core.loadGames(page, limit, filter)
  self.postMessage({ games, total })
}
```

### 3. Virtual Scrolling
- Only render visible items (~20 on screen)
- Reuse DOM nodes
- 60fps even with 176K items

### 4. Component Architecture
```
App
├── LoadingScreen (animated, async)
├── Layout
│   ├── Sidebar (navigation)
│   └── MainContent
│       ├── SearchBar
│       ├── FilterBar
│       └── GameGrid
│           └── VirtualList
│               └── GameCard (memoized)
└── Modals
    ├── GameDetail
    └── Settings
```

## Critical Files

### frontend/index.html (MUST HAVE DOCTYPE)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AHG Unlocker</title>
  <link rel="stylesheet" href="/dist/assets/index.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/dist/assets/index.js"></script>
</body>
</html>
```

### webview/main.cpp (DPI Config)
```cpp
// Set DPI awareness BEFORE creating window
SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);

// Enable hardware acceleration
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
```

## API Contract (Python ↔ Frontend)

```typescript
// frontend/src/types/api.ts
interface PaginatedResponse<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

interface Game {
  appid: string
  name: string
  header_image: string
  tags: string[]
  drm: boolean
  // ... other fields
}

// API Endpoints
GET  /api/games?page=1&limit=50&search=term&genre=Action
GET  /api/games/{appid}
POST /api/steam/install { appid, withDLC: boolean }
GET  /api/fixes?page=1
```

## Build Commands

```bash
# Frontend
cd frontend && npm install && npm run build

# Backend  
cd backend && pip install -r requirements.txt

# Core (C++)
cd core && mkdir build && cd build && cmake .. && make

# Package
electron-builder --win
```

## Performance Targets

| Metric | Target | Previous |
|--------|--------|----------|
| Initial load | < 2s | 10s+ |
| Memory | < 300MB | 2GB |
| Search | < 100ms | 5s |
| Scroll | 60fps | < 10fps |

## Next Steps

1. Build React frontend separately (verify it works)
2. Create C++ core for game database queries  
3. Set up WebView2 host with proper config
4. Integrate all layers