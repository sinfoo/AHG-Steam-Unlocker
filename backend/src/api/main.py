from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json
import os
from pathlib import Path

app = FastAPI(title="AHG Unlocker API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
BASE_DIR = Path(__file__).parent.parent
GAMES_FILE = BASE_DIR / "games.json"
FIXES_FILE = BASE_DIR / "fixes.json"

# Load data with lazy loading
_games_cache = None
_fixes_cache = None

def get_games():
    global _games_cache
    if _games_cache is None:
        if GAMES_FILE.exists():
            with open(GAMES_FILE, 'r', encoding='utf-8') as f:
                _games_cache = json.load(f)
        else:
            _games_cache = []
    return _games_cache

def get_fixes():
    global _fixes_cache
    if _fixes_cache is None:
        if FIXES_FILE.exists():
            with open(FIXES_FILE, 'r', encoding='utf-8') as f:
                _fixes_cache = json.load(f)
        else:
            _fixes_cache = []
    return _fixes_cache

# Models
class GameResponse(BaseModel):
    data: List[dict]
    page: int
    pageSize: int
    total: int
    hasMore: bool

class InstallRequest(BaseModel):
    appid: str
    includeDLC: bool = True

class InstallResult(BaseModel):
    success: bool
    message: str

# Routes
@app.get("/api/games", response_model=GameResponse)
async def get_games(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    genre: Optional[str] = None,
    sort: str = Query("popularity")
):
    games = get_games()
    
    # Filter
    if search:
        q = search.lower()
        games = [g for g in games if q in g.get('name', '').lower() or 
                 any(q in t.lower() for t in g.get('tags', []))]
    
    if genre:
        games = [g for g in games if genre in g.get('tags', [])]
    
    # Sort
    if sort == 'name':
        games = sorted(games, key=lambda g: g.get('name', ''))
    elif sort == 'added':
        games = sorted(games, key=lambda g: g.get('added_date', ''), reverse=True)
    elif sort == 'recent':
        games = sorted(games, key=lambda g: g.get('updated_date', ''), reverse=True)
    
    # Paginate
    total = len(games)
    start = (page - 1) * limit
    end = start + limit
    data = games[start:end]
    
    return GameResponse(
        data=data,
        page=page,
        pageSize=limit,
        total=total,
        hasMore=end < total
    )

@app.get("/api/games/{appid}")
async def get_game(appid: str):
    games = get_games()
    game = next((g for g in games if g.get('appid') == appid), None)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@app.get("/api/fixes", response_model=GameResponse)
async def get_fixes(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    fixes = get_fixes()
    total = len(fixes)
    start = (page - 1) * limit
    end = start + limit
    
    return GameResponse(
        data=fixes[start:end],
        page=page,
        pageSize=limit,
        total=total,
        hasMore=end < total
    )

@app.get("/api/fixes/{appid}")
async def get_fix(appid: str):
    fixes = get_fixes()
    fix = next((f for f in fixes if f.get('appid') == appid), None)
    return fix

@app.post("/api/steam/install", response_model=InstallResult)
async def install_game(request: InstallRequest):
    # TODO: Call C# backend for actual installation
    return InstallResult(success=True, message=f"Installing {request.appid}...")

@app.post("/api/steam/uninstall", response_model=InstallResult)
async def uninstall_game(request: InstallRequest):
    # TODO: Call C# backend
    return InstallResult(success=True, message=f"Uninstalled {request.appid}")

@app.get("/api/steam/status")
async def get_steam_status():
    # TODO: Check actual Steam status
    return {"running": False, "version": "3.0", "steamPath": ""}

@app.post("/api/steam/restart")
async def restart_steam():
    # TODO: Restart Steam
    return {"success": True, "message": "Steam restart initiated"}

@app.get("/api/config")
async def get_config():
    return {
        "theme": "dark",
        "includeDLC": True,
        "autoStartSteam": False,
        "backupLua": True,
        "showNSFW": False
    }

@app.put("/api/config")
async def save_config(config: dict):
    # TODO: Save to file
    return {"success": True}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765)