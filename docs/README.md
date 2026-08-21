# AHG Unlocker v1.0 - Polyglot Architecture

## Project Structure

```
/
├── ui/                    # React Frontend (Presentation Layer)
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── store.ts      # Zustand state management
│   │   ├── bridge.ts     # JS Bridge API
│   │   └── App.tsx       # Main app component
│   ├── dist/             # Built React app
│   └── package.json
│
├── bridge/               # Python Middleware (Orchestration Layer)
│   ├── main_bridge.py   # PyWebView bridge with JS API
│   └── launch.py        # Simple HTTP server launcher
│
├── core/                 # C# Performance Core (Hardware Layer)
│   ├── Program.cs       # Steam operations
│   └── AHGUnlocker.Core.csproj
│
├── src/                 # Legacy Python backend (to be deprecated)
│   └── main_test2.py    # Current working implementation
│
└── games.json           # 176,265 Steam games database
```

## Quick Start

### Option 1: Run React Dev Server (Recommended for development)

```bash
cd ui
npm run dev
```

Then open http://localhost:5173 in your browser.

### Option 2: Run Production Build

```bash
# Build React app
cd ui
npm run build

# Start server
cd ../bridge
python launch.py
```

Then open http://localhost:5173

### Option 3: Full Bridge with PyWebView (Requires pythonnet)

```bash
# Install dependencies
pip install pywebview

# Run bridge
cd bridge
python main_bridge.py
```

This opens the React app in a native window.

## Features Implemented

### Frontend (React + TypeScript + Vite)
- ✅ Bento Grid game display with virtualization
- ✅ Glassmorphism UI with "Midnight Neural" design
- ✅ Command Palette (Cmd/Ctrl + K)
- ✅ Dark/Light theme toggle
- ✅ Grid/List view toggle
- ✅ Search with instant filtering
- ✅ Genre filters
- ✅ Favorites system
- ✅ Framer Motion animations

### Bridge (Python)
- ✅ JSON-RPC style JS bridge API
- ✅ Game data access
- ✅ Favorites/Collections management
- ✅ Steam status checking
- ✅ License verification
- ✅ Config management

### Core (C#)
- ✅ Steam manifest scanning
- ✅ Registry operations
- ✅ Process management
- ✅ Backup/restore functions
- ✅ Memory-mapped file support

## Dependencies

### Frontend
- React 19
- Vite 7
- TypeScript
- Zustand (state)
- Framer Motion (animations)
- @tanstack/react-virtual (virtualization)
- Lucide React (icons)

### Bridge
- Python 3.12+
- PyWebView (optional, for native window)

### Core
- .NET 9 SDK (for C# compilation)

## Notes

- The current working implementation is in `src/main_test2.py` (Python/Tkinter)
- This new architecture is being developed in parallel
- The bridge currently uses mock data - needs full integration with main_test2.py backend

## Keyboard Shortcuts

- `Ctrl+K` or `Cmd+K` - Open Command Palette
- `Ctrl+1` - Home
- `Ctrl+2` - Favourites  
- `Ctrl+3` - Recent
- `Ctrl+T` - Toggle Theme
- `Ctrl+G` - Toggle View Mode