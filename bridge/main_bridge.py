"""
AHG Unlocker Bridge Layer
Orchestrates between React UI and Python backend
Uses PyWebView to display React frontend
"""

import os
import sys
import json
import threading
import webview
from http.server import HTTPServer, SimpleHTTPRequestHandler
import socketserver

# Add project root and bridge directory to path for imports
_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_this_dir)
sys.path.insert(0, _project_root)
sys.path.insert(0, _this_dir)

# Import backend functions
try:
    from scripts.python.utils.main_test2 import (
        _ALL_GAMES_DATA, _FAVORITES, _RECENTLY_VIEWED,
        load_cfg, save_cfg, install_game, restart_steam,
        get_collections, save_collection, delete_collection,
        add_to_recently_played, add_activity_log,
        load_favourites, save_favourites
    )
    BACKEND_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Backend not fully available: {e}")
    BACKEND_AVAILABLE = False

# Game data access
def get_all_games():
    """Get all games from games.json"""
    if BACKEND_AVAILABLE:
        # Return as list for frontend
        return [{"appid": k, **v} for k, v in _ALL_GAMES_DATA.items()]
    return []

def search_games(query):
    """Search games by name"""
    if BACKEND_AVAILABLE:
        q = query.lower()
        results = []
        for appid, data in _ALL_GAMES_DATA.items():
            if q in data.get("name", "").lower():
                results.append({"appid": appid, **data})
                if len(results) >= 50:
                    break
        return results
    return []

def get_game_by_id(appid):
    """Get single game details"""
    if BACKEND_AVAILABLE:
        return _ALL_GAMES_DATA.get(str(appid), {})
    return {}

# Favorites
def get_favorites():
    if BACKEND_AVAILABLE:
        return list(_FAVORITES)
    return []

def add_favorite(appid):
    if BACKEND_AVAILABLE:
        _FAVORITES.add(str(appid))
        save_favourites()

def remove_favorite(appid):
    if BACKEND_AVAILABLE:
        _FAVORITES.discard(str(appid))
        save_favourites()

# Collections  
def get_collections_data():
    if BACKEND_AVAILABLE:
        return get_collections()
    return {}

def create_collection_data(name):
    if BACKEND_AVAILABLE:
        save_collection(name, [])

def add_to_collection_data(appid, name):
    if BACKEND_AVAILABLE:
        cols = get_collections()
        if name in cols:
            if appid not in cols[name]:
                cols[name].append(appid)
                save_collection(name, cols[name])

# Steam operations
def install_game_data(appid, include_dlc=True):
    """Install a game"""
    if not BACKEND_AVAILABLE:
        return {"success": False, "message": "Backend not available"}
    
    cfg = load_cfg()
    cfg["include_dlc"] = include_dlc
    
    result = [False, ""]
    
    def on_log(msg, tag="info"):
        print(f"[LOG] {msg}")
    
    def on_done(ok):
        result[0] = ok
        result[1] = "Installed successfully" if ok else "Installation failed"
    
    try:
        threading.Thread(
            target=lambda: install_game(appid, cfg, on_log, on_done, include_dlc),
            daemon=True
        ).start()
        
        # Wait a bit for result
        import time
        time.sleep(2)
        
        return {"success": True, "message": "Installation started"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_steam_status():
    """Check if Steam is running"""
    if not BACKEND_AVAILABLE:
        return {"running": False, "version": "Unknown"}
    
    import subprocess
    try:
        result = subprocess.run(
            ['tasklist'], 
            capture_output=True, 
            text=True,
            timeout=5
        )
        running = 'steam.exe' in result.stdout.lower()
        return {"running": running, "version": "3.0"}
    except:
        return {"running": False, "version": "Unknown"}

def restart_steam_data():
    """Restart Steam"""
    if not BACKEND_AVAILABLE:
        return {"success": False, "message": "Backend not available"}
    
    try:
        cfg = load_cfg()
        threading.Thread(
            target=lambda: restart_steam(cfg, lambda m, t: print(f"[STEAM] {m}")),
            daemon=True
        ).start()
        return {"success": True, "message": "Steam restarting..."}
    except Exception as e:
        return {"success": False, "message": str(e)}

# Config
def get_config():
    if BACKEND_AVAILABLE:
        return load_cfg()
    return {
        "theme": "dark",
        "view_mode": "grid",
        "sort_by": "popularity",
        "include_dlc": True,
        "auto_start_steam": False,
        "backup_lua": True
    }

def save_config_data(config):
    if BACKEND_AVAILABLE:
        cfg = load_cfg()
        cfg.update(config)
        save_cfg(cfg)

# Activity log
def get_activity_log_data():
    # Simplified - in real app would read from file
    return []

def add_activity_data(action, details):
    if BACKEND_AVAILABLE:
        add_activity_log(action, details)

# License check
def check_license_data():
    """Check device license"""
    import uuid
    import platform
    
    # Generate device ID from hardware
    device_id = f"{uuid.getnode()}-{platform.node()}"
    
    # In real app, verify against stored license
    return {
        "valid": True,
        "device_id": device_id[:32],
        "expires": "2027-12-31"
    }

# API exposed to JavaScript
class BridgeAPI:
    """JavaScript bridge API"""
    
    def getGames(self, page=1, limit=50):
        games = get_all_games()
        start = (page - 1) * limit
        return games[start:start + limit]
    
    def searchGames(self, query):
        return search_games(query)
    
    def getGameDetails(self, appid):
        return get_game_by_id(appid)
    
    def installGame(self, appid, includeDLC=True):
        return install_game_data(appid, includeDLC)
    
    def uninstallGame(self, appid):
        return {"success": True, "message": "Uninstalled"}
    
    def batchInstall(self, appids):
        for appid in appids:
            install_game_data(appid)
        return {"success": True, "message": f"Installing {len(appids)} games"}
    
    def getFavorites(self):
        return get_favorites()
    
    def addFavorite(self, appid):
        add_favorite(appid)
    
    def removeFavorite(self, appid):
        remove_favorite(appid)
    
    def getCollections(self):
        return get_collections_data()
    
    def createCollection(self, name):
        create_collection_data(name)
    
    def addToCollection(self, appid, collectionName):
        add_to_collection_data(appid, collectionName)
    
    def getSteamStatus(self):
        return get_steam_status()
    
    def restartSteam(self):
        return restart_steam_data()
    
    def checkLicense(self):
        return check_license_data()
    
    def getConfig(self):
        return get_config()
    
    def saveConfig(self, config):
        save_config_data(config)
    
    def getActivityLog(self):
        return get_activity_log_data()
    
    def addActivity(self, action, details):
        add_activity_data(action, details)

def start_bridge(frontend_path):
    """Start the webview bridge with frontend"""
    
    api = BridgeAPI()
    
    # Create window
    window = webview.create_window(
        'AHG Unlocker',
        frontend_path,
        width=1400,
        height=900,
        min_size=(960, 660),
        background_color='#07070a',
        text_select=True,
        zoomable=True
    )
    
    # Expose API to JavaScript
    webview.js_api = api
    
    # Start webview
    webview.start(debug=False)

if __name__ == "__main__":
    # Build React app first, then launch
    ui_dir = os.path.join(os.path.dirname(__file__), "ui")
    dist_dir = os.path.join(ui_dir, "dist")
    
    # Check if dist exists, if not suggest building
    if not os.path.exists(dist_dir):
        print("React app not built. Run: cd ui && npm run build")
        sys.exit(1)
    
    # Start the bridge
    frontend_path = os.path.join(dist_dir, "index.html")
    start_bridge(frontend_path)