# AHG Steam Unlocker - Decoupled Hybrid Architecture

## Executive Summary

The previous implementation failed due to tight coupling between React UI and backend logic in a constrained Electron environment. This architecture separates concerns into distinct layers with proper IPC communication.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                           │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  React 19 + TypeScript + Vite + Tailwind CSS                  ││
│  │  - Tailwind JIT for styling                                    ││
│  │  - Zustand for state management                                ││
│  │  - TanStack Virtual for 170K+ list rendering                   ││
│  │  - Framer Motion for animations                               ││
│  └────────────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP/WebSocket IPC
┌───────────────────────────▼─────────────────────────────────────────┐
│                     ORCHESTRATION LAYER                            │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Python 3.14+ (FastAPI + uvicorn)                             ││
│  │  - HTTP Server (uvicorn) on localhost:8765                    ││
│  │  - WebSocket for real-time updates                             ││
│  │  - RESTful API for game operations                             ││
│  │  - Session management                                          ││
│  └────────────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────────────┘
                            │ gRPC/JSON-RPC
┌───────────────────────────▼─────────────────────────────────────────┐
│                      PERFORMANCE LAYER (C#)                       │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  .NET 8 + Native AOT                                           ││
│  │  - Steam API integration (Facepunch.Steamworks)               ││
│  │  - Manifest file parsing                                      ││
│  │  - SteamDB web scraping                                       ││
│  │  - File system operations                                      ││
│  │  - Registry access                                             ││
│  └────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
ahg-unlocker/
├── frontend/                    # React Presentation Layer
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── MainLayout.tsx
│   │   │   ├── GameGrid/
│   │   │   │   ├── GameCard.tsx
│   │   │   │   ├── GameGrid.tsx
│   │   │   │   └── VirtualGameList.tsx
│   │   │   ├── Modals/
│   │   │   │   ├── GameDetailModal.tsx
│   │   │   │   ├── SettingsModal.tsx
│   │   │   │   └── LoadingScreen.tsx
│   │   │   └── Common/
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       └── Badge.tsx
│   │   ├── hooks/
│   │   │   ├── useGames.ts
│   │   │   ├── useSteam.ts
│   │   │   └── useWebSocket.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── websocket.ts
│   │   ├── store/
│   │   │   ├── gameStore.ts
│   │   │   ├── settingsStore.ts
│   │   │   └── uiStore.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/                     # Python Orchestration Layer
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── games.py
│   │   │   │   ├── steam.py
│   │   │   │   └── fixes.py
│   │   │   ├── deps.py
│   │   │   └── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── logging.py
│   │   │   └── security.py
│   │   ├── services/
│   │   │   ├── steam_service.py
│   │   │   └── game_service.py
│   │   └── __init__.py
│   ├── pyproject.toml
│   └── requirements.txt
│
├── core/                        # C# Performance Layer
│   ├── src/
│   │   ├── Steam/
│   │   │   ├── SteamClient.cs
│   │   │   ├── ManifestParser.cs
│   │   │   └── SteamDBClient.cs
│   │   ├── FileSystem/
│   │   │   ├── LuaBackup.cs
│   │   │   └── ConfigManager.cs
│   │   └── Program.cs
│   ├── AHGUnlocker.Core.csproj
│   └── README.md
│
├── electron/                    # Desktop Wrapper
│   ├── main.cjs
│   ├── preload.cjs
│   └── package.json
│
├── games.json                   # 176K games database
├── fixes.json                   # Online fixes database
└── README.md
```

## Key Technical Decisions

### 1. Pagination Strategy for 170K+ Games
- Load games in pages of 50-100
- Use TanStack Virtual for smooth scrolling
- Cache previously loaded pages in memory
- Lazy load images with intersection observer

### 2. IPC Communication
- **REST API** (HTTP): Game search, filters, settings
- **WebSocket**: Real-time progress updates, notifications
- **gRPC**: Core operations (install, uninstall)

### 3. Electron Configuration Fixes
- Enable hardware acceleration
- Proper DPI awareness manifest
- Efficient memory management
- Proper window lifecycle

### 4. Error Handling
- Graceful degradation
- Retry logic with exponential backoff
- Error boundaries in React

## Implementation Priority

1. **Phase 1**: Fix Electron + React UI (working state)
2. **Phase 2**: Add Python API layer
3. **Phase 3**: Add C# Steam operations
4. **Phase 4**: Optimize performance

## API Endpoints (Python Backend)

```
GET  /api/games?page=1&limit=50&search=xxx&genre=xxx
GET  /api/games/{appid}
POST /api/steam/install
POST /api/steam/uninstall
GET  /api/fixes
POST /api/fixes/download/{appid}
GET  /api/steam/status
POST /api/steam/restart
GET  /api/config
PUT  /api/config
WS   /ws/progress - Real-time updates
```

## Configuration Requirements

### Electron main.cjs
- `app.commandLine.appendSwitch('enable-gpu-rasterization')`
- `app.commandLine.appendSwitch('enable-zero-copy')`
- Proper `webPreferences` configuration

### DPI Awareness
- Embed manifest in electron binary
- Use `BrowserWindow` with `backgroundColor` set

## Performance Targets

- Initial load: < 2 seconds
- Search response: < 100ms
- Scroll performance: 60fps with 170K items
- Memory usage: < 500MB (not 2GB)