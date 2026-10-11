"""
AHG Steam Unlocker  v9.2 - Modern Redesign
"""

import sys
import os
import logging

logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(levelname)s - %(message)s')

# Fix DPI scaling for cleaner text rendering
try:
    from ctypes import windll
    windll.shcore.SetProcessDpiAwareness(1)
except Exception:
    logging.debug("Failed to set DPI awareness", exc_info=True)

# Hide console window on startup (but keep it functional for initialization)
if sys.executable.endswith('pythonw.exe') is False:
    import ctypes
    try:
        kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
        user32 = ctypes.WinDLL('user32', use_last_error=True)
        SW_HIDE = 0
        hWnd = kernel32.GetConsoleWindow()
        if hWnd:
            user32.ShowWindow(hWnd, SW_HIDE)
    except Exception:
        logging.debug("Failed to hide console window", exc_info=True)

import tkinter as tk
from tkinter import messagebox, filedialog, ttk
import threading, zipfile, io, json, re, subprocess, time
import urllib.request, urllib.parse
import tkinter.font as tkfont
try:
    import pyperclip
except ImportError:
    pyperclip = None

try:
    from PIL import Image, ImageTk, ImageDraw, ImageFilter, ImageEnhance
    PIL_OK = True
except ImportError:
    PIL_OK = False

import requests

try:
    import customtkinter as ctk
    CTK_OK = True
except ImportError:
    try:
        import customtkinter as ctk
        CTK_OK = True
    except Exception:
        CTK_OK = False
        logging.warning("customtkinter import failed, using tkinter fallback", exc_info=True)

if CTK_OK:
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("dark-blue")

# ─────────────────────────────────────────────────────────────────────────────
#  MODERN DESIGN SYSTEM
# ─────────────────────────────────────────────────────────────────────────────

# Primary Colors - Red/Blue/Purple Gradient System
PRIMARY_RED = "#ef4444"
PRIMARY_BLUE = "#3b82f6"
PRIMARY_PURPLE = "#8b5cf6"
PRIMARY_INDIGO = "#6366f1"

# Theme system
def get_theme_colors(theme_name="dark"):
    if theme_name == "light":
        return {
            "bg_deep": "#f8f9fa",
            "bg_dark": "#ffffff",
            "bg_main": "#f0f2f5",
            "bg_card": "#ffffff",
            "bg_hover": "#e8eaed",
            "bg_active": "#dde1e6",
            "text_primary": "#1a1a1a",
            "text_secondary": "#4a5568",
            "text_muted": "#718096",
            "accent": "#7c3aed",
            "border": "#e2e8f0",
            "surface": "#ffffff",
            "sidebar": "#e2e8f0",
        }
    else:  # dark
        return {
            "bg_deep": "#07070a",
            "bg_dark": "#0d0d14",
            "bg_main": "#13131d",
            "bg_card": "#1a1a26",
            "bg_hover": "#252533",
            "bg_active": "#2a2a3a",
            "text_primary": "#f8fafc",
            "text_secondary": "#cbd5e1",
            "text_muted": "#64748b",
            "accent": "#8b5cf6",
            "border": "#2d2d3d",
            "surface": "#1e1e2d",
            "sidebar": "#12121f",
        }

# Apply default theme (dark)
THEME = get_theme_colors()
BG_DEEP = THEME["bg_deep"]
BG_DARK = THEME["bg_dark"]
BG_MAIN = THEME["bg_main"]
BG_CARD = THEME["bg_card"]
BG_HOVER = THEME["bg_hover"]
BG_ACTIVE = THEME["bg_active"]
TEXT_PRIMARY = THEME["text_primary"]
TEXT_SECONDARY = THEME["text_secondary"]
TEXT_MUTED = THEME["text_muted"]

# Accent Colors
ACCENT = PRIMARY_PURPLE
ACCENT_LIGHT = "#a78bfa"
ACCENT_GLOW = "#c4b5fd"
SUCCESS = "#22c55e"
WARNING = "#f59e0b"
ERROR = "#ef4444"
INFO = "#3b82f6"

# Text Colors
TEXT_PRIMARY = "#f8fafc"
TEXT_SECONDARY = "#cbd5e1"
TEXT_MUTED = "#64748b"
TEXT_DISABLED = "#475569"

# Border & Surface
BORDER = "#2d2d3d"
BORDER_LIGHT = "#3d3d52"
SURFACE = "#1e1e2d"

# ─────────────────────────────────────────────────────────────────────────────
#  GRADIENT & EFFECT HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def create_gradient_horizontal(width, height, colors):
    """Create horizontal gradient"""
    if not PIL_OK:
        return None
    img = Image.new("RGB", (width, height), colors[0])
    draw = ImageDraw.Draw(img)
    steps = len(colors) - 1
    if steps < 1:
        return ImageTk.PhotoImage(img)
    step_w = width // steps
    for i in range(steps):
        c1 = colors[i]
        c2 = colors[i + 1]
        for x in range(i * step_w, (i + 1) * step_w if i < steps else width):
            ratio = (x - i * step_w) / step_w if step_w > 0 else 0
            r = int(c1[0] * (1 - ratio) + c2[0] * ratio)
            g = int(c1[1] * (1 - ratio) + c2[1] * ratio)
            b = int(c1[2] * (1 - ratio) + c2[2] * ratio)
            draw.line([(x, 0), (x, height)], fill=f"#{r:02x}{g:02x}{b:02x}")
    return ImageTk.PhotoImage(img)

def create_mesh_background(width, height):
    """Create modern mesh gradient background with blurred blobs"""
    if not PIL_OK:
        return None
    img = Image.new("RGB", (width, height), BG_DEEP)
    draw = ImageDraw.Draw(img)
    
    # Color blobs for mesh effect
    blobs = [
        ((100, 200), 180, (239, 68, 68, 40)),    # Red blob
        ((width-150, 100), 200, (59, 130, 246, 35)),  # Blue blob  
        ((width//2, height-100), 220, (139, 92, 246, 30)),  # Purple blob
        ((200, height-150), 160, (99, 102, 241, 35)),  # Indigo blob
    ]
    
    for bx, by, radius, color in blobs:
        # Draw radial gradient blob
        for i in range(radius, 0, -2):
            alpha = int((1 - i/radius) * color[3])
            if alpha > 0:
                r = int(color[0])
                g = int(color[1])
                b = int(color[2])
                draw.ellipse([bx-i, by-i, bx+i, by+i], fill=f"#{r:02x}{g:02x}{b:02x}")
    
    # Apply blur for mesh effect
    img = img.filter(ImageFilter.GaussianBlur(80))
    
    # Add subtle noise/texture
    pixels = img.load()
    for y in range(0, height, 4):
        for x in range(0, width, 4):
            r, g, b = pixels[x, y]
            noise = (x + y) % 8 - 4
            pixels[x, y] = (
                max(0, min(255, r + noise)),
                max(0, min(255, g + noise)),
                max(0, min(255, b + noise))
            )
    
    return ImageTk.PhotoImage(img)

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def blend_colors(c1, c2, ratio):
    return tuple(int(c1[i] * (1 - ratio) + c2[i] * ratio) for i in range(3))

# ─────────────────────────────────────────────────────────────────────────────
#  CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

APP_NAME   = "AHG Steam Unlocker"
APP_VER    = "0.90.1"
SETTINGS_F = os.path.join(os.path.expanduser("~"), ".ahg9.json")
if getattr(sys, 'frozen', False):
    BUNDLE_DIR = sys._MEIPASS
    EXE_DIR = os.path.dirname(sys.executable)
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))
    EXE_DIR = BUNDLE_DIR

# Embedded data ZIP (for standalone EXE)
_EMBEDDED_ZIP = None
_EMBEDDED_ZIP_DATA = None

def _log_error(msg):
    """Log error to user's home directory"""
    try:
        import datetime
        log_path = os.path.join(os.path.expanduser("~"), "ahg_error.log")
        with open(log_path, "a") as f:
            f.write(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
        print(f"[ERROR] {msg}")
    except Exception as e:
        logging.error("Failed to write to error log: %s", e, exc_info=True)

def _log_startup():
    """Log startup information for debugging"""
    try:
        import datetime
        log_path = os.path.join(os.path.expanduser("~"), "ahg_error.log")
        with open(log_path, "w") as f:
            f.write(f"=== AHG Steam Unlocker v{APP_VER} Startup ===\n")
            f.write(f"Time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Frozen: {getattr(sys, 'frozen', False)}\n")
            f.write(f"sys._MEIPASS: {getattr(sys, '_MEIPASS', 'N/A')}\n")
            f.write(f"sys.executable: {sys.executable}\n")
            f.write(f"BUNDLE_DIR: {BUNDLE_DIR}\n")
            f.write(f"EXE_DIR: {EXE_DIR}\n")
            f.write(f"EXE exists: {os.path.exists(sys.executable) if getattr(sys, 'frozen', False) else 'N/A'}\n")
    except Exception as e:
        print(f"Startup log error: {e}")

_log_startup()

def _get_embedded_zip():
    """Get embedded ZIP data if available"""
    global _EMBEDDED_ZIP, _EMBEDDED_ZIP_DATA
    if _EMBEDDED_ZIP is not None:
        return _EMBEDDED_ZIP
    
    import io
    import zipfile
    
    # Check if we have a data.zip next to the EXE
    zip_path = os.path.join(EXE_DIR, "data.zip")
    if os.path.exists(zip_path):
        try:
            _EMBEDDED_ZIP = zipfile.ZipFile(zip_path, 'r')
            print(f"[DEBUG] Loaded ZIP from: {zip_path}")
            return _EMBEDDED_ZIP
        except Exception as e:
            err = f"Failed to load ZIP from {zip_path}: {e}"
            print(f"[ERROR] {err}")
            _log_error(err)
            pass
    
    # Check inside the bundle (for PyInstaller)
    bundled_zip = os.path.join(BUNDLE_DIR, "data.zip")
    if os.path.exists(bundled_zip):
        try:
            _EMBEDDED_ZIP = zipfile.ZipFile(bundled_zip, 'r')
            print(f"[DEBUG] Loaded ZIP from bundle: {bundled_zip}")
            return _EMBEDDED_ZIP
        except Exception as e:
            err = f"Failed to load ZIP from {bundled_zip}: {e}"
            print(f"[ERROR] {err}")
            _log_error(err)
            pass
    
    # Check if embedded in EXE itself (standalone mode)
    if getattr(sys, 'frozen', False):
        exe_path = sys.executable
        marker = b'___DATA_ZIP_START___'
        try:
            with open(exe_path, 'rb') as f:
                exe_data = f.read()
            idx = exe_data.find(marker)
            if idx != -1:
                zip_data = exe_data[idx + len(marker):]
                _EMBEDDED_ZIP_DATA = zip_data
                _EMBEDDED_ZIP = zipfile.ZipFile(io.BytesIO(zip_data), 'r')
                print(f"[DEBUG] Loaded embedded ZIP from EXE, files: {_EMBEDDED_ZIP.namelist()}")
                return _EMBEDDED_ZIP
            else:
                err = "No embedded ZIP marker found in EXE - EXE may be corrupted"
                print(f"[ERROR] {err}")
                _log_error(err)
        except Exception as e:
            print(f"[DEBUG] Failed to load embedded ZIP: {e}")
    
    print("[DEBUG] No embedded ZIP found")
    return None

def _find_file(filename):
    """Find a file - check embedded ZIP first, then EXE directory, then bundle directory, then _internal"""
    # Check embedded ZIP first
    embedded = _get_embedded_zip()
    if embedded and filename in embedded.namelist():
        print(f"[DEBUG] _find_file('{filename}'): FOUND IN EMBEDDED ZIP")
        return ("__embedded__", filename)
    
    # Check EXE directory
    exe_path = os.path.join(EXE_DIR, filename)
    if os.path.exists(exe_path):
        print(f"[DEBUG] _find_file('{filename}'): FOUND AT {exe_path}")
        return exe_path
    
    # Check bundle directory
    bundled_path = os.path.join(BUNDLE_DIR, filename)
    if os.path.exists(bundled_path):
        print(f"[DEBUG] _find_file('{filename}'): FOUND AT {bundled_path}")
        return bundled_path
    
    # Check _internal subfolder (pyinstaller puts datas here)
    internal_path = os.path.join(BUNDLE_DIR, "_internal", filename)
    if os.path.exists(internal_path):
        print(f"[DEBUG] _find_file('{filename}'): FOUND AT {internal_path}")
        return internal_path
    
    # Check in EXE directory _internal subfolder
    internal_exe_path = os.path.join(EXE_DIR, "_internal", filename)
    if os.path.exists(internal_exe_path):
        print(f"[DEBUG] _find_file('{filename}'): FOUND AT {internal_exe_path}")
        return internal_exe_path
    
    print(f"[DEBUG] _find_file('{filename}'): NOT FOUND")
    return exe_path

def _read_embedded_file(filename):
    """Read a file from embedded ZIP"""
    embedded = _get_embedded_zip()
    if embedded and filename in embedded.namelist():
        try:
            return embedded.read(filename)
        except Exception as e:
            _log_error(f"Error reading {filename} from ZIP: {e}")
            return None
    _log_error(f"File {filename} not found in embedded ZIP")
    return None

ICON_PATH  = _find_file("ahg_icon.ico")
GAMES_JSON = _find_file("games.json")
FIXES_JSON = _find_file("fixes.json")

STEAM_SEARCH  = "https://store.steampowered.com/api/storesearch/?term={}&l=en&cc=US"
STEAM_DETAIL  = "https://store.steampowered.com/api/appdetails?appids={}&filters=dlc,basic"
STEAM_NEW     = "https://store.steampowered.com/search/results/?term&sort_by=release DESC&force=1"
STEAM_IMG     = "https://i.steamstatic.com/store_item_assets/steam/apps/{}/header.jpg"
STEAM_IMG_FB1 = "https://i.steamstatic.com/store_item_assets/steam/apps/{}/library_600x900_2x.jpg"
STEAM_IMG_FB2 = "https://i.steamstatic.com/store_item_assets/steam/apps/{}/library_600x900.jpg"
DEPOT_KEYS    = "https://raw.githubusercontent.com/SteamAutoCracks/ManifestHub/main/depotkeys.json"
DL_HDR        = {"User-Agent": "AHGSteamUnlocker/9.2"}

MIRROR_REPOS = [
    "SteamAutoCracks/ManifestHub",
    "WARDEN-DEV/Steam_ManifestHub",
    "tympanicblock61/SteamManifestMirror",
    "pvzcxw/cai-install_stloader",
    "isurfer21/steam-manifests",
    "WoodenTiger000/SteamManifestHub",
    "TheSecondComing001/SteamManifestHub",
    "wsxsdyx/ManifestHub1",
    "frostheaven/steam-manifest-cache",
    "a60nt1/SteamManifest",
]

# GitHub Update Configuration
GITHUB_UPDATE_REPO = "ahg-team/AHG-Steam-Unlocker"
GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_UPDATE_REPO}/releases/latest"

POPULAR_GAMES = [
    "730", "3041230", "3321460", "230410", "578080", "2868840", "1172470", "570", "3564740", "2767030", "1973530", "2050650", "3764200", "2507950", "381210", "306130", "3240220", "236390", "359550", "1808500", "252490", "3405690", "2183900", "440", "2399830", "553850", "1151340", "3472040", "1086940", "1245620", "3065800", "1384160", "438100", "275850", "2344520", "2479810", "3527290", "2139460", "594650", "1963610", "2357570", "3679080", "3241660", "1144200", "2646460", "3280350", "3164500", "582660", "518790", "1145350", "227300", "418370", "266410", "1663850", "220200", "394360", "2073620", "1091500", "3513350", "1049590", "2483190", "413150", "1401590", "2246340", "3357650", "1449850", "431960", "3609080", "2807960", "1222670", "3552140", "1665460", "39210", "552990", "632360", "2300320", "4025700", "2141910", "1313140", "1716740", "1142710", "294100", "686060", "4069520", "1203220", "949230", "1675200", "2073850", "2221490", "739630", "3784030", "281990", "952060", "1874880", "2057760", "284160", "1286830", "530611", "1637320", "2852190", "883710", "582010", "1174180", "1145360", "1364780", "3949040", "2958130", "3932890", "2840770", "2764370", "1326470", "2001120", "376210", "2622380", "1721470", "1551360", "1196590", "1623730", "393380", "648800", "1172620", "2157830", "1903340", "2416450", "3028330", "1407200", "322330", "346110", "311210", "2694490", "2379740", "1158310", "108600", "2426960", "261550", "1771300", "2358720", "2138330", "1285190", "238960", "1284210", "2253100", "105600", "2385530", "2778580", "1446780", "489830", "599140", "1203620", "2536520", "435150", "269210", "1289670", "3008130", "1974050", "1476970", "2074920", "1466060", "2661300", "1643320", "219990", "2186680", "1371980", "371970", "3681010", "1984270", "1084600", "377160", "646570", "1669000", "538030", "2881150", "1913370", "3159330", "2322010", "1818450", "304390", "286160", "899770", "3214610", "1766060", "761890", "835570", "513710", "2927200", "814380", "292030", "1118010", "9900", "3164330", "1041320", "3720100", "246620", "703080", "427520", "526870", "2592160", "1611600", "1363080", "255710", "813780", "1466860", "1601580", "444200", "2688950", "2643390", "3314790", "1465460", "594570", "960090", "457140", "1569580", "2706020", "208650", "2738490", "529340", "322170", "3551340", "3274580", "2379780", "251570", "3840050", "1062090", "3656800", "686810", "1677280", "2426530", "1934680", "1295660", "2779120", "323190", "544810", "3230400", "1162750", "2975950", "3556750", "4508320", "645390", "364360", "602960", "1617400", "289070", "400750", "236850", "2537590", "3717070", "270880", "3224770", "3948120", "3643170", "2968420", "1631270", "3326230", "753640", "3419520", "1167630", "1190000", "1190970", "2670630", "221100", "244210", "3059520", "1588550", "714010", "2567870", "2397300", "2456740", "2744880", "1465360", "4000", "2399420", "2778610", "815370", "2104890", "1222140", "1284190", "1149460", "2129530", "2651280", "1085660", "1304930", "1659040", "4224910", "1943950", "412020", "1547000", "1426210", "264710", "2231380", "2417610", "2698940", "380600", "766570", "2138720", "431240", "805550", "4045750", "3354750", "1066890", "3483740", "3058630", "960170", "620980", "410340", "3226450", "2591280", "3983810", "436150", "3873970", "1451190", "1682970", "690790", "1222680", "2799860", "3174070", "3271000", "1114150", "2569510", "550320", "1205970", "1153410", "2669320", "1650010", "2815070", "4424610", "1954420", "3657850", "635260", "2290180", "2440510", "4010590", "571740", "1846380", "2383430", "211500", "621830", "2869680", "1511630", "1815780", "3194360", "4042800", "3376250", "1316840", "1546670", "1408610", "1874170", "4496350", "3260810", "460920", "2878980", "1166860", "4182010", "871540", "1292630", "1843410", "3570290", "1288320", "1267540", "389730", "2701860", "236690", "630940", "1093700", "695680", "1849250", "1263240", "1566200", "2878960", "2703850", "3590560", "2700610", "1432320", "3634520", "3501070", "2625420", "585420", "2814990", "3917090", "655500", "2486820", "516750", "3293010", "2225070", "2634950", "1369670", "293760", "1796470", "1203190", "675010", "4164420", "552100", "1262560", "1017180", "493490", "3745310", "2069310", "646910", "307690", "1677740", "2477340", "2973290", "1953520", "1262540", "228380", "1262580", "3151390", "3511300", "3558400", "1030840", "347990", "1520370", "3570070", "2280350", "394690", "3125250", "3260820", "1328660", "4380410", "2464230", "1537830", "578330", "3077390", "681280", "675590", "4192600", "404430", "250900", "4100940", "1621690", "2781620", "892970", "291550", "1030300", "1332010", "2827200", "2879840", "312520", "4331610", "1206560", "242760", "2780810", "367520", "3357960", "268910", "285900", "1260320", "2138710", "880940", "3897800", "3022790", "1040200", "3405340", "3070070", "1369700", "613100", "2737070", "361420", "3372530", "728880", "3097560",
]

GENRES = ["All", "Action", "Adventure", "RPG", "Strategy", "Simulation", "Sports", "Racing", "Puzzle", "Horror", "Casual", "Indie", "Multiplayer"]

GENRE_KEYWORDS = {
    "Action": ["shooter", "fps", "combat", "fight", "hack", "slash", "war", "gun", "shoot", "violent", "valve", "portal", "left 4 dead", "counter-strike", "team fortress", "day of defeat", "half-life", "rigs of rods", "gta", "grand theft", "call of duty", "battlefield", "doom", "halo", "mortal kombat", "street fighter", "quake", "unreal tournament", "titanfall", "overwatch", "apex", "valorant", "destiny", "borderlands", "far cry", "assassin's creed", "action", "tps"],
    "Adventure": ["adventure", "quest", "story", "journey", "explore", "survival", "minecraft", "terraria", "stardew", "undertale", "celeste", "god of war", "uncharted", "tomb raider", "a plague tale", "the legend", "story", "narrative"],
    "RPG": ["rpg", "role playing", "dragon", "dungeon", "rogue", "final fantasy", "elder scrolls", "skyrim", "witcher", "dark souls", "elden ring", "baldur", "pokemon", "persona", "fallout", "mass effect", "guild wars", "lost ark", "mmorpg"],
    "Strategy": ["strategy", "tactic", "tower defense", "turn based", "4x", "rts", "civilization", "age of empires", "starcraft", "total war", "xcom", "homeworld", "command and conquer", "anno", "civ"],
    "Simulation": ["sim", "simulator", "flight", "train", "farm", "city", "dovetail", "planet zoo", "planet coaster", "rollercoaster", "usa truck", "euro truck", "the sims", "war thunder", "construction", "management"],
    "Sports": ["football", "soccer", "basketball", "nba", "fifa", "madden", "ufc", "wwe", "mlb", "nfl", "2k", "pes", "football manager", "golf", "tennis", "hockey", "nhl", "sports", "ea sports"],
    "Racing": ["racing", "car", "drive", "rally", "forza", "gran turismo", "need for speed", "dirt", "assetto", "crew", "motorsport", "burnout", "GRID", "beamng"],
    "Puzzle": ["puzzle", "logic", "brain", "match", "match-3", "trivia", "tetris", "baba is you", "the witness", "monument valley", "picross", "sudoku", "brain age", "sokoban", "nonogram"],
    "Horror": ["horror", "scary", "fear", "zombie", "ghost", "haunt", "paranormal", "phasmophobia", "outlast", "dead space", "silent hill", "resident evil", "five nights", "freddy", "jumpscare", "amnesia", "Layers of Fear", "dead by daylight", "creepypasta"],
    "Casual": ["casual", "party", "mini", "arcade", "board", "among us", "fall guys", "overcooked", "jackbox", "uno", "draw", "skribbl", "gartic", "mario", "sonic", "nintendo", "wii", "party game"],
    "Indie": ["indie", "hollow knight", "shovel knight", "cuphead", "dead cells", "skul", "sable", "celeste", "binding of isaac", "stardew", "terraria", "hotline", "shovel knight"],
    "Multiplayer": ["multiplayer", "co-op", "coop", "online", "mmo", "pvp", "mmorpg", "fortnite", "apex legends", "league of legends", "roblox", "rust", "7 days to die", "gmod", "garry's mod"],
}

_GAMES_BY_GENRE = {}
_ALL_GAMES_TAGS = {}

# DRM Detection - Games with third-party DRM or require third-party launchers
# Sources: SteamDB, known DRM-protected games, launcher-required games
_DRM_GAMES = {
    # Denuvo (most common commercial DRM)
    "1091500", "1074180", "1134570", "1240440", "1328670", "1332010",  # Doom Eternal, etc.
    "752590", "814380", "812780", "761890", "990080", "1088950", "1158310",
    "2479810", "2358720", "2138330", "2412110", "2715900", "1328670", "1245620",
    "1551360", "1593500", "1671480", "1817070", "1983980", "2120300", "2221490",
    
    # EA Games (EA App/Origin required)
    "1293830", "1938760", "1943980", "1845810", "1963720", "1313140", "1174180",
    "1907820", "1952600", "1833230", "1743830", "1566690", "1875910", "1426210",
    "12200", "17450", "17460", "17470", "11010", "11020", "11040", "11080", "11160",
    "11200", "11210", "11230", "11240", "12820", "12830", "12840", "17300", "17330",
    "17390", "17420", "17570", "17600", "17710", "17860", "18020", "18170", "18190",
    "18489", "18500", "18530", "18700", "18860", "18920", "18930", "19030", "19120",
    "19330", "19480", "19900", "20030", "21040", "21100", "21170", "21200", "21580",
    "22040", "22130", "22170", "22240", "22270", "22540", "22580", "22600", "22690",
    "22730", "22780", "22800", "23010", "23070", "23210", "23370", "23527", "23531",
    "236150", "236390", "237310", "238430", "238960", "239030", "239140", "239160",
    "24030", "24160", "24190", "24240", "24280", "24300", "24430", "24450", "24470",
    "24510", "24630", "24790", "24900", "24950", "24980", "25010", "25050", "25070",
    "25230", "25250", "25270", "25290", "25330", "25390", "25400", "25430", "25450",
    "25470", "25560", "25570", "25590", "25600", "25630", "25650", "25710", "25730",
    "25800", "25820", "25850", "25870", "25890", "25930", "25940", "25960", "26010",
    "26040", "26070", "26090", "26110", "26130", "26150", "26180", "26200", "26210",
    
    # Ubisoft Games (Ubisoft Connect required)
    "814380", "812780", "752590", "761890", "990080", "1088950", "1158310", "2358720",
    "1671480", "1817070", "1983980", "2120300", "2221490", "1332010", "1240440",
    "1401590", "2415600", "2145490", "2126600", "2056500", "2360900", "1658700",
    "15712", "15740", "15770", "15840", "15910", "15920", "15930", "15940", "15950",
    "15960", "15970", "15980", "15990", "16010", "16020", "16030", "16040", "16050",
    "16060", "16120", "16130", "16140", "16150", "16160", "16170", "16180", "16190",
    "16220", "16230", "16250", "16260", "16330", "16340", "16350", "16360", "16380",
    "16430", "16450", "16460", "16470", "16480", "16490", "16500", "16510", "16520",
    "16530", "16540", "16550", "16560", "16570", "16580", "16590", "16600", "16610",
    "16620", "16630", "16640", "16650", "16660", "16670", "16680", "16690", "16700",
    "16710", "16720", "16730", "16740", "16750", "16760", "16770", "16780", "16790",
    "16800", "16810", "16820", "16830", "16840", "16850", "16860", "16870", "16880",
    
    # Epic Games (Epic Games Store required)
    "1063730", "1063731", "1063732", "1063733", "1063734", "1063735", "1063736",
    "1071210", "1086940", "1099790", "1101190", "1115650", "1120400", "1134550",
    "1474470", "1587050", "1593500", "1610530", "1612580", "1662750", "1696440",
    "1718170", "1733190", "1774580", "1817070", "1831360", "1878250", "1907790",
    
    # Games requiring other third-party launchers
    "2819750", "2074920", "1466060", "2661300", "1643320", "219990", "1551360",
    "1269260", "1269261", "1269262", "1269263", "1269264", "1269265", "1269266",
    "1313140", "1293830", "1952600", "2412110", "2715900", "2322010", "1462040",
    
    # More known DRM games
    "13230", "13240", "13370", "13460", "13880", "14030", "14420", "14450", "14520",
    "14530", "14540", "14570", "14630", "14640", "14650", "14690", "14780", "14910",
    "14920", "14930", "15030", "15040", "15120", "15150", "15170", "15200", "15470",
    "15540", "15620", "15660", "15750", "15830", "15860", "15880", "15890", "15900",
    "16090", "16100", "16140", "16210", "16230", "16240", "16270", "16280", "16320",
    "16360", "16400", "16410", "16420", "16440", "16450", "16520", "16550", "16590",
}

def _load_json_file(path):
    """Load JSON from file path or embedded ZIP"""
    try:
        if isinstance(path, tuple) and path[0] == "__embedded__":
            data = _read_embedded_file(path[1])
            if data:
                try:
                    return json.loads(data)
                except json.JSONDecodeError as e:
                    _log_error(f"Embedded JSON parse error in {path[1]}: {e}")
                    return None
            _log_error(f"Failed to read embedded file: {path[1]}")
            return None
        elif os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except FileNotFoundError:
                _log_error(f"JSON file vanished: {path}")
                return None
            except json.JSONDecodeError as e:
                _log_error(f"JSON parse error in {path}: {e}")
                return None
        _log_error(f"JSON file not found: {path}")
        return None
    except Exception as e:
        error_msg = f"Failed to load JSON from {path}: {e}"
        _log_error(error_msg)
        return None

# Lazy initialization flag for genre data
_GENRES_INITIALIZED = False

def _ensure_genres_initialized():
    """Lazily initialize genre data - only when needed"""
    global _GENRES_INITIALIZED
    if _GENRES_INITIALIZED:
        return
    _GENRES_INITIALIZED = True
    
    # Now populate _GAMES_BY_GENRE if not already done
    if not _GAMES_BY_GENRE or all(len(v) == 0 for v in _GAMES_BY_GENRE.values()):
        json_data = _load_json_file(GAMES_JSON)
        if json_data and isinstance(json_data, list):
            for g in json_data:
                if isinstance(g, dict):
                    aid = str(g.get("appid", ""))
                    if aid:
                        name = g.get("name", f"App {aid}")
                        tags = g.get("tags", [])
                        if tags:
                            _add_to_genres(aid, tags, name)

def _load_featured_games():
    try:
        json_data = _load_json_file(GAMES_JSON)
        if json_data:
            data = json_data
            
            if not isinstance(data, list):
                return [(aid, f"Game {aid}") for aid in POPULAR_GAMES]
            
            global _ALL_GAMES_DATA, _GAMES_BY_GENRE
            _ALL_GAMES_DATA = {}
            _GAMES_BY_GENRE = {}
            
            for g in data:
                if isinstance(g, dict):
                    aid = str(g.get("appid", ""))
                    if aid:
                        name = g.get("name", f"App {aid}")
                        header = g.get("header_image", "")
                        drm = g.get("drm", False)
                        
                        existing = _ALL_GAMES_DATA.get(aid, {})
                        drm = drm or existing.get("drm", False)
                        _ALL_GAMES_DATA[aid] = {"name": name, "header_image": header, "drm": drm}
            
            result = []
            seen = set()
            for aid in POPULAR_GAMES:
                if aid in _ALL_GAMES_DATA and aid not in seen:
                    seen.add(aid)
                    result.append((aid, _ALL_GAMES_DATA[aid]["name"]))
            
            others = []
            for aid, game_data in _ALL_GAMES_DATA.items():
                if aid not in seen:
                    others.append((aid, game_data["name"]))
            others.sort(key=lambda x: x[1].lower())
            result.extend(others)
            
            if result:
                return result
    except Exception:
        pass
    return [(aid, f"Game {aid}") for aid in POPULAR_GAMES[:100]]

FEATURED = _load_featured_games()
CARDS_PER_PAGE = 50

# Load favorites from disk
_FAVORITES = set()
try:
    fav_path = os.path.join(os.path.expanduser("~"), ".ahg_favorites")
    if os.path.exists(fav_path):
        with open(fav_path, "r") as f:
            _FAVORITES = set(str(x) for x in json.load(f))
except Exception:
    pass
_RECENTLY_VIEWED = []

# ─────────────────────────────────────────────────────────────────────────────
#  SMOOTH SCROLL SYSTEM
# ─────────────────────────────────────────────────────────────────────────────

import math
import random

# Native scroll only - no animation to prevent layout issues
class NativeScrollMixin:
    def _wheel_native(self, e):
        delta = 0
        if hasattr(e, 'delta') and e.delta:
            delta = -1 if e.delta > 0 else 1
        elif hasattr(e, 'num'):
            delta = -1 if e.num == 4 else 1 if e.num == 5 else 0
        if delta:
            self._cv.yview_scroll(delta, "units")
    
    def scroll_top(self):
        self._cv.yview_moveto(0)

# ─────────────────────────────────────────────────────────────────────────────
#  LICENSE SYSTEM
# ─────────────────────────────────────────────────────────────────────────────

GIST_ID = os.environ.get("LICENSE_GIST_ID", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
if not GITHUB_TOKEN:
    print("ERROR: GITHUB_TOKEN env var not set")
    sys.exit(1)
LICENSE_FILE = os.path.join(os.path.expanduser("~"), ".ahg_license")

def _get_machine_id():
    try:
        import uuid
        h = str(uuid.getnode())
        c = os.environ.get("COMPUTERNAME", "")
        u = os.environ.get("USERNAME", "")
        raw = f"{h}{c}{u}".encode()
        import hashlib
        return hashlib.sha256(raw).hexdigest()[:32]
    except Exception:
        logging.warning("Failed to generate machine ID", exc_info=True)
        return "unknown"

def _fetch_licenses():
    try:
        url = f"https://api.github.com/gists/{GIST_ID}"
        resp = requests.get(url, headers={
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json"
        }, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            content = data.get("files", {}).get("license_keys.json", {}).get("content", "{}")
            licenses = json.loads(content) if content else {}
            return licenses
        return {}
    except Exception:
        logging.warning("Failed to fetch licenses from GitHub gist", exc_info=True)
        return {}

def _update_gist(licenses):
    try:
        url = f"https://api.github.com/gists/{GIST_ID}"
        content = json.dumps(licenses, indent=2)
        payload = {
            "description": "AHG License Keys",
            "files": {
                "license_keys.json": {
                    "content": content
                }
            }
        }
        resp = requests.patch(url, headers={
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }, json=payload, timeout=15)
        return resp.status_code == 200
    except Exception:
        logging.warning("Failed to update gist", exc_info=True)
        return False

def _load_local_license():
    try:
        if os.path.exists(LICENSE_FILE):
            with open(LICENSE_FILE, "r") as f:
                return json.load(f)
    except Exception:
        logging.warning("Failed to load local license file", exc_info=True)
    return None

def _save_local_license(discord_id, machine_id):
    try:
        with open(LICENSE_FILE, "w") as f:
            json.dump({
                "discord_id": str(discord_id),
                "machine_id": str(machine_id),
                "activated": True
            }, f)
    except Exception:
        logging.warning("Failed to save local license file", exc_info=True)

class LicenseWindow:
    def __init__(self):
        if CTK_OK:
            self._modern_window()
        else:
            self._fallback_window()
    
    def _modern_window(self):
        self.root = ctk.CTk()
        self.root.title("AHG Steam Unlocker - Activation")
        self.root.geometry("450x400")
        self.root.resizable(False, False)
        
        try:
            self.root.iconbitmap(ICON_PATH)
        except Exception:
            logging.debug("Icon file not found, using default")
        
        self.root.protocol("WM_DELETE_WINDOW", sys.exit)
        self._setup_modern_ui()
        self.root.mainloop()
    
    def _setup_modern_ui(self):
        self.main_frame = ctk.CTkFrame(self.root, fg_color="#0d0d1a")
        self.main_frame.pack(fill="both", expand=True)
        
        ctk.CTkLabel(self.main_frame, text="⬡", font=("Segoe UI", 40), text_color="#6366f1").pack(pady=(30, 5))
        ctk.CTkLabel(self.main_frame, text="AHG Steam Unlocker", font=("Segoe UI", 22, "bold"),
                    text_color="white").pack()
        ctk.CTkLabel(self.main_frame, text="License Activation", font=("Segoe UI", 12),
                    text_color="#94a3b8").pack(pady=(0, 25))
        
        self.entry = ctk.CTkEntry(self.main_frame, font=("Segoe UI", 14),
                                  width=320, height=50,
                                  fg_color="#1a1a2e", text_color="white",
                                  border_color="#6366f1", border_width=2,
                                  placeholder_text="Enter License Key",
                                  placeholder_text_color="#64748b")
        self.entry.pack(pady=(0, 15))
        self.entry.focus()
        
        self.paste_btn = ctk.CTkButton(self.main_frame, text="📋 Paste from Clipboard", font=("Segoe UI", 12, "bold"),
                                       width=200, height=40, fg_color="#6366f1",
                                       hover_color="#4f46e5", text_color="white",
                                       corner_radius=10, command=self._paste_from_clipboard)
        self.paste_btn.pack(pady=(0, 15))
        
        self.activate_btn = ctk.CTkButton(self.main_frame, text="Activate License", font=("Segoe UI", 14, "bold"),
                                         width=220, height=50, fg_color="#10b981",
                                         hover_color="#059669", text_color="white",
                                         corner_radius=12, command=self._activate)
        self.activate_btn.pack(pady=(0, 12))
        
        self.msg_label = ctk.CTkLabel(self.main_frame, text="", font=("Segoe UI", 11),
                                     text_color="#f87171")
        self.msg_label.pack(pady=(10, 2))
        
        self.progress_frame = ctk.CTkFrame(self.main_frame, fg_color="#6366f1", corner_radius=6)
        self.progress_frame.pack(pady=(8, 8))
        
        self.progress_bar = ctk.CTkProgressBar(self.progress_frame, progress_color="white",
                                              width=260, height=6, corner_radius=3,
                                              border_width=0, fg_color="#3a3a5a")
        self.progress_bar.pack(padx=3, pady=3)
        self.progress_bar.set(0)
        
        self.verifying_label = ctk.CTkLabel(self.main_frame, text="", font=("Segoe UI", 10),
                                           text_color="#94a3b8")
        self.verifying_label.pack(pady=(0, 5))
        
        ctk.CTkLabel(self.main_frame, text="Get your license key after purchase",
                    font=("Segoe UI", 9), text_color="#64748b").pack(side="bottom", pady=15)
        
        self.entry.bind("<Return>", lambda e: self._activate())
    
    def _paste_from_clipboard(self):
        try:
            if pyperclip:
                clipboard_text = pyperclip.paste()
                if clipboard_text:
                    self.entry.delete(0, "end")
                    self.entry.insert(0, clipboard_text.strip())
        except Exception:
            logging.debug("Failed to paste from clipboard", exc_info=True)
    
    def _activate(self):
        license_key = self.entry.get().strip().upper()
        if not license_key:
            self.msg_label.configure(text="Please enter your License Key", text_color="#f87171")
            return
        
        self.msg_label.configure(text="", text_color="#94a3b8")
        self.activate_btn.configure(state="disabled", text="Verifying...")
        self.entry.configure(state="disabled")
        self.paste_btn.configure(state="disabled")
        
        self.progress_bar.configure(progress_color="white")
        self.progress_bar.set(0)
        self.verifying_label.configure(text="Verifying license...")
        
        self._progress_running = True
        self._progress_value = 0
        self._animate_progress()
        
        def do_verify():
            licenses = _fetch_licenses()
            machine_id = _get_machine_id()
            
            if license_key not in licenses:
                self._progress_running = False
                self.root.after(0, lambda: self._show_error("Invalid License Key. Contact support."))
                return
            
            registered_machine = licenses.get(license_key, "")
            
            # Allow reactivation - simply update to new machine ID
            if registered_machine and registered_machine != "pending":
                # Just allow it - user can reactivate
                pass
            
            licenses[license_key] = machine_id
            update_success = False
            for attempt in range(3):
                if _update_gist(licenses):
                    update_success = True
                    break
                time.sleep(0.5)
            
            if not update_success:
                self._progress_running = False
                self.root.after(0, lambda: self._show_error("Connection error. Try again."))
                return
            
            _save_local_license(license_key, machine_id)
            self._progress_running = False
            self.root.after(0, self._on_activation_success)
        
        threading.Thread(target=do_verify, daemon=True).start()
    
    def _animate_progress(self):
        if not self._progress_running:
            return
        if self._progress_value < 0.95:
            self._progress_value += 0.02
            self.progress_bar.set(self._progress_value)
            self.root.after(25, self._animate_progress)
    
    def _show_error(self, msg):
        self._progress_running = False
        self.msg_label.configure(text=msg, text_color="#f87171")
        self.activate_btn.configure(state="normal", text="Activate License")
        self.entry.configure(state="normal")
        self.paste_btn.configure(state="normal")
        self.progress_bar.set(0)
        self.verifying_label.configure(text="")
        self.progress_frame.configure(fg_color="#6366f1")
    
    def _on_activation_success(self):
        self.verifying_label.configure(text="Activation complete!", text_color="#10b981")
        self.progress_bar.configure(progress_color="white")
        self.progress_frame.configure(fg_color="#10b981")
        self.activate_btn.configure(text="Launching...")
        for i in range(1, 21):
            self.progress_bar.set(i / 20)
            self.root.update()
            time.sleep(0.02)
        self._show_success_window()
    
    def _show_success_window(self):
        self.root.destroy()
        success_win = SuccessWindow()
        if success_win.continue_app:
            launch_main_app()
    
    def _fallback_window(self):
        self.root = tk.Tk()
        self.root.title("AHG Steam Unlocker - Activation")
        self.root.configure(bg=BG)
        self.root.geometry("420x300")
        self.root.resizable(False, False)
        
        try:
            self.root.iconphoto(False, tk.PhotoImage(file=ICON_PATH))
        except Exception:
            logging.debug("Icon photo not found, using default")
        
        self.root.protocol("WM_DELETE_WINDOW", sys.exit)
        main = tk.Frame(self.root, bg=BG)
        main.pack(fill="both", expand=True)
        
        tk.Label(main, text="AHG Steam Unlocker", font=(FN, 20, "bold"), fg=WHITE, bg=BG).pack(pady=(40, 5))
        tk.Label(main, text="License Activation", font=(FN, 12), fg=OFFWHITE, bg=BG).pack(pady=(0, 30))
        
        tk.Label(main, text="Enter your License Key:", font=(FN, 11), fg=OFFWHITE, bg=BG).pack(pady=(0, 8))
        
        self.entry = tk.Entry(main, font=(FN, 14), bg=ENTRY, fg=WHITE,
                              insertbackground=WHITE, relief="flat", width=30, justify="center")
        self.entry.pack(pady=(0, 15))
        self.entry.focus()
        
        self.msg_label = tk.Label(main, text="", font=(FN, 10), fg=RED, bg=BG)
        self.msg_label.pack(pady=(0, 15))
        
        btn = tk.Button(main, text="Activate", font=(FN, 12, "bold"),
                        bg=ACCENT, fg=WHITE, activebackground=ACCENT_DARK,
                        relief="flat", cursor="hand2", width=20, height=2,
                        command=self._activate_fallback)
        btn.pack(pady=(0, 20))
        
        self.entry.bind("<Return>", lambda e: self._activate_fallback())
        
        tk.Label(main, text="Enter the license key you received after purchase",
                 font=(FN, 9), fg=SUB, bg=BG, justify="center").pack()
        
        self.root.mainloop()
    
    def _activate_fallback(self):
        license_key = self.entry.get().strip()
        if not license_key:
            self.msg_label.config(text="Please enter your License Key", fg=RED)
            return
        
        self.msg_label.config(text="Verifying license...", fg=BLUE)
        self.root.update()
        
        licenses = _fetch_licenses()
        machine_id = _get_machine_id()
        
        if license_key not in licenses:
            self.msg_label.config(text="Invalid License Key. Contact support.", fg=RED)
            return
        
        registered_machine = licenses[license_key]
        
        # Allow reactivation - simply update to new machine ID
        if registered_machine and registered_machine != "pending":
            licenses[license_key] = machine_id  # Allow override
        
        if not _update_gist(licenses):
            self.msg_label.config(text="Connection error. Try again.", fg=RED)
            return
        
        _save_local_license(license_key, machine_id)
        self.root.destroy()
        success = SuccessWindow()
        if success.continue_app:
            launch_main_app()


class SuccessWindow:
    def __init__(self):
        self.continue_app = False
        if CTK_OK:
            self._modern_window()
        else:
            self._fallback_window()
    
    def _modern_window(self):
        self.root = ctk.CTk()
        self.root.title("Activation Successful!")
        self.root.geometry("480x450")
        self.root.resizable(False, False)
        
        try:
            self.root.iconbitmap(ICON_PATH)
        except Exception:
            logging.debug("Icon file not found for license check window")
        
        self._setup_modern_ui()
        self.root.mainloop()
    
    def _setup_modern_ui(self):
        main = ctk.CTkFrame(self.root, fg_color="#0d0d1a")
        main.pack(fill="both", expand=True)
        
        ctk.CTkLabel(main, text="✓", font=("Segoe UI", 60, "bold"),
                    text_color="#10b981").pack(pady=(50, 10))
        
        ctk.CTkLabel(main, text="Activation Successful!", font=("Segoe UI", 26, "bold"),
                    text_color="#10b981").pack(pady=(10, 5))
        
        ctk.CTkLabel(main, text="Your license has been activated.", font=("Segoe UI", 13),
                    text_color="white").pack()
        
        ctk.CTkLabel(main, text="Thank you for purchasing AHG Steam Unlocker.\n"
                    "Your device is now linked to this license.",
                    font=("Segoe UI", 11), text_color="#94a3b8", justify="center").pack(pady=(10, 30))
        
        self.proceed_btn = ctk.CTkButton(main, text="🚀 Proceed to App", font=("Segoe UI", 16, "bold"),
                                        width=240, height=55, fg_color="#10b981",
                                        hover_color="#059669", text_color="white",
                                        corner_radius=14, command=self._start_app)
        self.proceed_btn.pack(pady=(0, 20))
        
        ctk.CTkLabel(main, text="📱 This license is linked to this device",
                    font=("Segoe UI", 10), text_color="#64748b").pack(side="bottom", pady=20)
    
    def _start_app(self):
        self.continue_app = True
        self.root.quit()
    
    def _fallback_window(self):
        self.root = tk.Tk()
        self.root.title("Activation Successful!")
        self.root.configure(bg=BG)
        self.root.geometry("450x350")
        self.root.resizable(False, False)
        
        try:
            self.root.iconphoto(False, tk.PhotoImage(file=ICON_PATH))
        except Exception:
            logging.debug("Icon photo not found for tk license check window")
        
        main = tk.Frame(self.root, bg=BG)
        main.pack(fill="both", expand=True)
        
        try:
            logo = tk.PhotoImage(file=ICON_PATH)
            logo = logo.subsample(4, 4)
            tk.Label(main, image=logo, bg=BG).pack(pady=(30, 10))
        except Exception:
            logging.debug("Failed to load logo image, using fallback")
            tk.Label(main, text="✓", font=(FN, 40), fg=GREEN, bg=BG).pack(pady=(30, 10))
        
        tk.Label(main, text="Welcome!", font=(FN, 22, "bold"), fg=GREEN, bg=BG).pack(pady=(0, 5))
        
        msg = ("Your license has been activated successfully!\n\n"
               "Thank you for purchasing AHG Steam Unlocker.\n\n"
               "For support, join our Discord server.")
        tk.Label(main, text=msg, font=(FN, 10), fg=OFFWHITE, bg=BG, justify="center").pack(pady=(10, 20))
        
        btn = tk.Button(main, text="Start Using App", font=(FN, 12, "bold"),
                       bg=GREEN, fg=WHITE, activebackground="#2ecc71",
                       relief="flat", cursor="hand2", width=20, height=2,
                       command=self._start_app)
        btn.pack(pady=(10, 20))
        
        tk.Label(main, text="This license is linked to this device.", font=(FN, 8), fg=SUB, bg=BG).pack()
        
        self.root.mainloop()

def check_license():
    license_data = _load_local_license()
    
    if license_data and license_data.get("activated"):
        stored_machine = license_data.get("machine_id", "")
        current_machine = _get_machine_id()
        
        if stored_machine == current_machine:
            license_key = license_data.get("discord_id", "").upper()
            
            for attempt in range(3):
                licenses = _fetch_licenses()
                if licenses:
                    for key, value in licenses.items():
                        if key.upper() == license_key and value == stored_machine:
                            return True
                    break
                if attempt < 2:
                    time.sleep(0.5)
    
    return False

# ─────────────────────────────────────────────────────────────────────────────
#  THEME - Using Modern Design System
# ─────────────────────────────────────────────────────────────────────────────

# Alias for backwards compatibility
BG = BG_MAIN
SIDEBAR = "#0d0d14"
PANEL = BG_CARD
PANEL2 = BG_ACTIVE
HOV = BG_HOVER
SEL_BG = BG_ACTIVE
ACCENT = PRIMARY_PURPLE
ACCENT_LIGHT = PRIMARY_PURPLE
ACCENT_DARK = PRIMARY_INDIGO
GREEN = SUCCESS
GREEN_D = "#16a34a"
AMBER = WARNING
BLUE = INFO
RED = ERROR
WHITE = TEXT_PRIMARY
OFFWHITE = TEXT_SECONDARY
SUB = TEXT_MUTED
BORDER = BORDER
ENTRY = SURFACE
MUTED = BG_CARD
CARD_BG = BG_CARD

CW, CH = 275, 158
COLS_MIN = 3

FN = "Segoe UI"

def _pick_font():
    try:
        avail = tkfont.families()
        for f in ("Nunito","Inter","Poppins","Segoe UI","Ubuntu","Roboto","Arial"):
            if f in avail: return f
    except Exception:
        logging.debug("Failed to pick font from available families", exc_info=True)
    return "Segoe UI"

# ─────────────────────────────────────────────────────────────────────────────
#  SETTINGS
# ─────────────────────────────────────────────────────────────────────────────

def _auto_steam():
    try:
        import winreg
        k = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                           r"SOFTWARE\WOW6432Node\Valve\Steam")
        p, _ = winreg.QueryValueEx(k,"InstallPath")
        winreg.CloseKey(k)
        if os.path.isdir(p): return p
    except Exception:
        logging.debug("Failed to auto-detect Steam path from registry", exc_info=True)
    for p in [r"C:\Program Files (x86)\Steam",r"C:\Program Files\Steam",
              r"D:\Steam",r"E:\Steam"]:
        if os.path.isdir(p): return p
    return r"C:\Program Files (x86)\Steam"

def load_cfg():
    sp = _auto_steam()
    d = {"steam_path":sp,"steam_exe":os.path.join(sp,"steam.exe"),
         "lua_path":os.path.join(sp,"config","stplug-in"),
         "manifest_path":os.path.join(sp,"depotcache"),"include_dlc":True,
         "theme":"dark","view_mode":"list","show_favorites":True,
         "recently_played":[],"collections":{},"last_db_update":"",
         "favorites":list(_FAVORITES)}
    try:
        if os.path.exists(SETTINGS_F):
            with open(SETTINGS_F) as f: 
                loaded = json.load(f)
                # Handle legacy favorites from .ahg_favorites file
                if "favorites" not in loaded:
                    d["favorites"] = list(_FAVORITES)
                d.update(loaded)
    except Exception:
        logging.warning("Failed to load config, using defaults", exc_info=True)
    return d

def save_cfg(s):
    try:
        # Save favorites to settings file too
        if "favorites" not in s:
            s["favorites"] = list(_FAVORITES)
        # Clean collections for JSON (keys must be strings)
        if "collections" in s:
            s["collections"] = {str(k): v for k, v in s.get("collections", {}).items()}
        with open(SETTINGS_F,"w") as f: json.dump(s,f,indent=2)
    except Exception:
        logging.warning("Failed to save config", exc_info=True)

def toggle_favorite(appid):
    """Toggle favorite status and save"""
    global _FAVORITES
    if str(appid) in _FAVORITES:
        _FAVORITES.discard(str(appid))
    else:
        _FAVORITES.add(str(appid))
    # Save immediately
    try:
        fav_path = os.path.join(os.path.expanduser("~"), ".ahg_favorites")
        with open(fav_path, "w") as f:
            json.dump(list(_FAVORITES), f)
    except Exception:
        pass
    return str(appid) in _FAVORITES

def get_collections():
    """Get user's collections"""
    try:
        cfg = load_cfg()
        return cfg.get("collections", {})
    except Exception:
        logging.warning("Failed to get collections", exc_info=True)
        return {}

def save_collection(name, games):
    """Save a collection"""
    try:
        cfg = load_cfg()
        collections = cfg.get("collections", {})
        collections[name] = games
        cfg["collections"] = collections
        save_cfg(cfg)
    except Exception:
        pass

def delete_collection(name):
    """Delete a collection"""
    try:
        cfg = load_cfg()
        collections = cfg.get("collections", {})
        if name in collections:
            del collections[name]
            cfg["collections"] = collections
            save_cfg(cfg)
    except Exception:
        pass

def add_to_recently_played(appid):
    """Add game to recently played list"""
    try:
        cfg = load_cfg()
        recent = cfg.get("recently_played", [])
        # Remove if already exists
        if appid in recent:
            recent.remove(appid)
        # Add to front
        recent.insert(0, appid)
        # Keep only last 20
        recent = recent[:20]
        cfg["recently_played"] = recent
        save_cfg(cfg)
    except Exception:
        pass

def get_recently_played():
    """Get recently played games"""
    try:
        cfg = load_cfg()
        return cfg.get("recently_played", [])[:20]
    except Exception:
        logging.warning("Failed to get recently played", exc_info=True)
        return []

def export_settings(path):
    """Export all settings to a JSON file"""
    try:
        import datetime as dt
        cfg = load_cfg()
        export_data = {
            "version": APP_VER,
            "favorites": list(_FAVORITES),
            "recently_played": cfg.get("recently_played", []),
            "collections": cfg.get("collections", {}),
            "theme": cfg.get("theme", "dark"),
            "view_mode": cfg.get("view_mode", "list"),
            "exported_at": dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=2)
        return True
    except Exception as e:
        print(f"Export error: {e}")
        return False

def import_settings(path):
    """Import settings from a JSON file"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        cfg = load_cfg()
        
        # Import favorites
        if "favorites" in data:
            global _FAVORITES
            _FAVORITES = set(str(x) for x in data["favorites"])
            fav_path = os.path.join(os.path.expanduser("~"), ".ahg_favorites")
            with open(fav_path, "w") as f:
                json.dump(list(_FAVORITES), f)
        
        # Import other settings
        if "recently_played" in data:
            cfg["recently_played"] = data["recently_played"]
        if "collections" in data:
            cfg["collections"] = data["collections"]
        if "theme" in data:
            cfg["theme"] = data["theme"]
        if "view_mode" in data:
            cfg["view_mode"] = data["view_mode"]
        
        save_cfg(cfg)
        return True
    except Exception as e:
        print(f"Import error: {e}")
        return False

def get_activity_log():
    """Get activity log entries"""
    try:
        cfg = load_cfg()
        return cfg.get("activity_log", [])[:50]
    except Exception:
        logging.warning("Failed to get activity log", exc_info=True)
        return []

def add_activity_log(action, details=""):
    """Add entry to activity log"""
    try:
        import datetime as dt
        cfg = load_cfg()
        log = cfg.get("activity_log", [])
        entry = {
            "time": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
            "action": action,
            "details": details
        }
        log.insert(0, entry)
        log = log[:100]  # Keep last 100
        cfg["activity_log"] = log
        save_cfg(cfg)
    except Exception:
        pass
    """Advanced search with filters"""
    if filters is None:
        filters = {}
    q_lower = q.lower().strip()
    results = []
    
    # Get filter options
    drm_filter = filters.get("drm", None)
    genre_filter = filters.get("genre", None)
    sort_by = filters.get("sort", "relevance")
    
    for aid, name in FEATURED:
        name_lower = name.lower()
        
        # Skip if doesn't match search query
        if q_lower and q_lower not in name_lower:
            # Check fuzzy match
            if q_lower.split():
                score = sum(1 for word in q_lower.split() if word in name_lower)
                if score == 0:
                    continue
            else:
                continue
        
        # Get game data for filtering
        game_data = _ALL_GAMES_DATA.get(aid, {})
        
        # DRM filter
        if drm_filter is not None:
            has_drm = game_data.get("drm", False)
            if drm_filter and not has_drm:
                continue
            if not drm_filter and has_drm:
                continue
        
        results.append((aid, name))
    
    # Sort results
    if sort_by == "name_asc":
        results.sort(key=lambda x: x[1].lower())
    elif sort_by == "name_desc":
        results.sort(key=lambda x: x[1].lower(), reverse=True)
    elif sort_by == "popularity":
        # Use POPULAR_GAMES order
        pop_order = {g: i for i, g in enumerate(POPULAR_GAMES[:200])}
        results.sort(key=lambda x: pop_order.get(x[0], 999))
    
    return results[:200]

def search_steam(q):
    q_lower = q.lower().strip()
    results = []
    for aid, name in FEATURED:
        if q_lower in name.lower():
            results.append((aid, name))
            if len(results) >= 100:
                break
    return results

def fuzzy_search(q):
    q_lower = q.lower().strip()
    results = []
    for aid, name in FEATURED:
        name_lower = name.lower()
        if q_lower in name_lower:
            results.append((aid, name, 0))
        elif q_lower.split():
            score = sum(1 for word in q_lower.split() if word in name_lower)
            if score > 0:
                results.append((aid, name, -score))
    results.sort(key=lambda x: (x[2], x[1].lower()))
    return [(a, n) for a, n, _ in results[:50]]

def get_dlcs(appid):
    """Get DLCs using concurrent requests for faster loading"""
    try:
        r = requests.get(STEAM_DETAIL.format(appid), timeout=10)
        d = r.json().get(str(appid), {})
        if d.get("success"):
            dlc_list = [str(x) for x in d.get("data",{}).get("dlc",[])]
            return dlc_list
    except Exception:
        pass
    return []

def fetch_dlc_bulk(appids):
    """Fetch DLCs for multiple games concurrently"""
    def fetch_one(appid):
        try:
            r = requests.get(STEAM_DETAIL.format(appid), timeout=8)
            d = r.json().get(str(appid), {})
            if d.get("success"):
                return appid, [str(x) for x in d.get("data",{}).get("dlc",[])]
        except Exception:
            logging.debug("Failed to fetch DLC for appid %s", appid, exc_info=True)
        return appid, []
    
    # Use thread pool for concurrency
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(fetch_one, appids)
        return {aid: dlcs for aid, dlcs in results}

def fetch_keys(ids):
    keys={}
    try:
        r=requests.get(DEPOT_KEYS,headers=DL_HDR,timeout=15)
        if r.status_code==200:
            data=r.json()
            for d in ids:
                if d in data: keys[d]=data[d]
    except Exception:
        logging.warning("Failed to fetch depot keys", exc_info=True)
    return keys

def make_lua(appid,dm,keys):
    lines=[f"-- AppID: {appid}",f"-- {APP_NAME} v{APP_VER}","",
           f'addappid({appid},1,"common")','']
    for did in sorted(dm):
        mid=dm[did];k=keys.get(did,"")
        lines.append(f'addappid({did},1,"{k}")'if k else f'addappid({did},1,"common")')
        lines.append(f'setManifestid({did},"{mid}")')
    lines.append("")
    return "\n".join(lines)

def install_game(appid,cfg,log,done,include_dlc=True):
    dc=cfg["manifest_path"];pd=cfg["lua_path"]
    
    # Test write permissions first
    try:
        os.makedirs(dc,exist_ok=True)
        test_file = os.path.join(dc, "_write_test.tmp")
        with open(test_file, "w") as f: f.write("test")
        os.remove(test_file)
    except Exception as e:
        log(f"ERROR: Cannot write to depotcache folder!","error")
        log(f"Path: {dc}","error")
        log(f"Error: {e}","error")
        log("SOLUTION: Run as Administrator or check folder permissions","error")
        done(False)
        return
    
    os.makedirs(dc,exist_ok=True);os.makedirs(pd,exist_ok=True)
    log(f"Installing App ID {appid}...","info")
    log(f"Writing to: {dc}","info")
    all_ids=[appid]
    if include_dlc:
        log("Fetching DLC list...","info")
        dlcs=get_dlcs(appid)
        log(f"Found {len(dlcs)} DLC(s)" if dlcs else "No DLCs.","ok"if dlcs else"sub")
        all_ids+=dlcs
    all_depots={};bundled_lua=None
    for tid in all_ids:
        tag=f"[{'Base'if tid==appid else'DLC '}  {tid}]"
        log(f"{tag} scanning repos...","info")
        zip_data=None
        for repo in MIRROR_REPOS:
            url=f"https://github.com/{repo}/archive/refs/heads/{tid}.zip"
            log(f"  {repo}...","sub")
            try:
                r=requests.get(url,headers=DL_HDR,timeout=20,stream=True)
                if r.status_code==404:continue
                if r.status_code!=200:continue
                log(f"  Found in {repo}","ok")
                chunks,total,recv=[],int(r.headers.get("content-length",0)),0
                for chunk in r.iter_content(65536):
                    if chunk:
                        chunks.append(chunk);recv+=len(chunk)
                        if total:log(f"  {int(recv*100/total)}%  {recv//1024}KB/{total//1024}KB","sub")
                zip_data=b"".join(chunks);log(f"  {len(zip_data)//1024}KB done","sub");break
            except Exception as e:log(f"  Error:{e}","warn")
        if zip_data is None:
            if tid==appid:log(f"Game {appid} not found.","error");done(False);return
            else:log(f"DLC {tid} not found,skipping.","warn");continue
        try: z=zipfile.ZipFile(io.BytesIO(zip_data))
        except Exception as e:log(f"Bad ZIP:{e}","error");continue
        raw={};lua_entry=None
        for entry in z.namelist():
            fn=os.path.basename(entry)
            if fn.endswith(".manifest"):
                st=fn[:-9].split("_",1)
                if len(st)==2 and all(s.isdigit() for s in st):
                    raw.setdefault(st[0],[]).append((st[1],entry))
            elif fn.endswith(".lua") and lua_entry is None and tid==appid:
                lua_entry=entry
        log(f"  {sum(len(v)for v in raw.values())} manifests/{len(raw)} depots","info")
        for did,entries in sorted(raw.items()):
            entries.sort(key=lambda x:int(x[0]),reverse=True)
            mid,entry=entries[0];all_depots[did]=mid
            log(f"  Depot {did}→{mid}"+(f"({len(entries)}ver)"if len(entries)>1 else""),"info")
            dest=os.path.join(dc,f"{did}_{mid}.manifest")
            try:
                with open(dest,"wb")as fh:fh.write(z.read(entry))
                log(f"  ✓ Saved: {os.path.basename(dest)}","ok")
            except Exception as e:
                log(f"  ✗ FAILED to write: {e}","error")
                log(f"    File: {dest}","error")
                log(f"    Run as ADMINISTRATOR!","error")
        if lua_entry and bundled_lua is None:
            bundled_lua=z.read(lua_entry);log("  Bundled lua extracted","ok")
        z.close()
    lua_dest=os.path.join(pd,f"{appid}.lua")
    log(f"Lua destination: {lua_dest}","info")
    if bundled_lua:
        try:
            with open(lua_dest,"wb")as fh:fh.write(bundled_lua)
            log("Lua saved (bundled).","ok")
        except Exception as e:log(f"Lua ERROR: Cannot write lua file: {e}","error")
    else:
        log("Generating lua script...","info")
        keys=fetch_keys(list(all_depots.keys()))
        log(f"  {len(keys)} key(s) found","ok"if keys else"sub")
        try:
            lua_content = make_lua(appid,all_depots,keys)
            with open(lua_dest,"w",encoding="utf-8")as fh:fh.write(lua_content)
            log(f"Lua saved ({len(lua_content)} bytes).","ok")
        except Exception as e:log(f"Lua ERROR: {e}","error")
    
    # Verify lua file exists
    log(f"Full lua path: {lua_dest}","info")
    log(f"Full manifest path: {dc}","info")
    if os.path.exists(lua_dest):
        log(f"✓ Lua file verified: {os.path.basename(lua_dest)}","ok")
    else:
        log(f"✗ Lua file NOT found at: {lua_dest}","error")
    
    # Verify manifest files exist
    manifest_count = 0
    manifest_files = []
    try:
        for f in os.listdir(dc):
            if f.endswith(".manifest") and f.startswith(tuple(all_depots.keys())):
                manifest_count += 1
                manifest_files.append(f)
        log(f"Manifests in depotcache: {manifest_count} files","info")
        if manifest_files:
            for mf in manifest_files[:5]:
                log(f"  - {mf}","ok")
            if len(manifest_files) > 5:
                log(f"  ... and {len(manifest_files)-5} more","ok")
    except Exception as e:
        log(f"Error checking manifests: {e}","error")
    
    # Check if depotcache folder exists and is writable
    try:
        if not os.path.exists(dc):
            log(f"WARNING: depotcache folder does not exist!","warn")
        else:
            test_file = os.path.join(dc, "_ahg_test.tmp")
            try:
                with open(test_file, 'w') as f:
                    f.write("test")
                os.remove(test_file)
                log("depotcache folder is writable","ok")
            except Exception as e:
                log(f"WARNING: Cannot write to depotcache: {e}","warn")
                log("Try running AHG as ADMINISTRATOR","warn")
    except Exception:
        logging.warning("Failed to test depotcache permissions", exc_info=True)
    
    log("","info")
    log("✓  DONE! Restart Steam to find the game.","ok")
    log("NOTE: Ensure SteamTools plugin is ENABLED in Steam settings.","sub")
    done(True)

def restart_steam(cfg,log):
    exe=cfg.get("steam_exe","")
    if not exe or not os.path.exists(exe):
        exe=os.path.join(cfg.get("steam_path",""),"steam.exe")
    if not os.path.exists(exe):log("steam.exe not found. Set path in Settings.","error");return
    try:
        log("Closing Steam...","info")
        subprocess.run(["taskkill","/F","/IM","steam.exe"],capture_output=True,timeout=10)
        time.sleep(2);log("Launching Steam...","info")
        subprocess.Popen([exe]);log("Steam restarted.","ok")
    except Exception as e:log(f"Error:{e}","error")

def fix_no_internet(log):
    log("Fixing 'No Internet' Steam error...","info")
    steps = [
        ("Flushing DNS cache","ipconfig /flushdns"),
        ("Resetting WinSock","netsh winsock reset"),
        ("Resetting TCP/IP","netsh int ip reset"),
    ]
    for label,cmd in steps:
        try:
            log(f"  {label}...","info")
            result = subprocess.run(cmd,shell=True,capture_output=True,text=True,timeout=15)
            if result.returncode==0: log(f"  ✓ Done","ok")
            else: log(f"  ✗ {result.stderr.strip()[:80]}","warn")
        except Exception as e: log(f"  ✗ {e}","warn")
    log("Network reset complete.","ok")
    log("Also try: Steam → Settings → Downloads → Clear Download Cache","sub")
    log("Then restart Steam as Administrator.","sub")

# ─────────────────────────────────────────────────────────────────────────────
#  IMAGE CACHE
# ─────────────────────────────────────────────────────────────────────────────

_img_cache = {}
_img_lock = threading.Lock()
_ph_cache = {}
_loading_cards = set()

import datetime as _dt

def _log(msg):
    ts = _dt.datetime.now().strftime("%H:%M:%S.%f")[:-3]
    line = f"[{ts}] {msg}\n"
    print(line.strip())
    try:
        with open(os.path.join(os.path.expanduser("~"), "ahg_debug.log"), "a") as f:
            f.write(line)
    except Exception:
        logging.debug("Failed to write debug log", exc_info=True)

_log(f"=== APP START === PIL_OK={PIL_OK}")

def make_placeholder(w,h):
    if not PIL_OK:
        _log(f"make_placeholder: PIL not available!")
        return None
    img=Image.new("RGB",(w,h),"#12121f")
    d=ImageDraw.Draw(img)
    for x in range(0,w,35):
        d.line([(x,0),(x,h)],fill="#1a1a2d",width=1)
    for y in range(0,h,35):
        d.line([(0,y),(w,y)],fill="#1a1a2d",width=1)
    cx,cy=w//2,h//2
    d.ellipse([cx-14,cy-14,cx+14,cy+14],outline="#2a2a4a",width=2)
    photo=ImageTk.PhotoImage(img)
    _log(f"make_placeholder: Created placeholder {w}x{h}")
    return photo

def get_ph(w,h):
    k=(w,h)
    if k not in _ph_cache: _ph_cache[k]=make_placeholder(w,h)
    return _ph_cache[k]

def fetch_cover(appid,w,h,cb):
    appid = str(appid) if appid else ""
    if not appid:
        return
    
    key=f"{appid}_{w}_{h}"
    with _img_lock:
        if key in _img_cache:
            try:cb(appid,_img_cache[key])
            except Exception:
                logging.debug("Failed to invoke cache callback for %s", appid, exc_info=True)
            return
    
    # Build URLs list - check games.json first, then CDN fallbacks
    urls = []
    
    # Check if we have a custom header_image in our database
    game_data = _ALL_GAMES_DATA.get(appid, {})
    db_header = game_data.get("header_image", "")
    if db_header and (".jpg" in str(db_header) or ".png" in str(db_header)):
        urls.append(db_header)
    
    # Add Steam CDN fallbacks
    urls.extend([
        STEAM_IMG.format(appid),
        STEAM_IMG_FB1.format(appid),
        STEAM_IMG_FB2.format(appid),
    ])
    
    def _fit_image(img, max_w, max_h):
        """Resize image to fill max_w x max_h (crop to fit)"""
        iw, ih = img.size
        scale = max(max_w / iw, max_h / ih)
        new_w, new_h = int(iw * scale), int(ih * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        left = (new_w - max_w) // 2
        top = (new_h - max_h) // 2
        img = img.crop((left, top, left + max_w, top + max_h))
        return img
    
    def _run():
        for url in urls:
            try:
                req=urllib.request.Request(url, headers={"User-Agent":"AHG/8.1"})
                data=urllib.request.urlopen(req,timeout=8).read()
                if len(data) < 500:
                    continue
                img=Image.open(io.BytesIO(data))
                if img.format not in ("JPEG", "JPG", "PNG"):
                    continue
                img=img.convert("RGB")
                img=_fit_image(img,w,h)
                photo=ImageTk.PhotoImage(img)
                with _img_lock: _img_cache[key]=photo
                try:cb(appid,photo)
                except Exception:
                    logging.debug("Failed to invoke cover callback for %s", appid, exc_info=True)
                return
            except Exception:
                continue
    
    threading.Thread(target=_run,daemon=True).start()

# ─────────────────────────────────────────────────────────────────────────────
#  ICON LOADER
# ─────────────────────────────────────────────────────────────────────────────

_icon_photo = None

def _load_image_from_path(path):
    """Load image from file path or embedded tuple"""
    if isinstance(path, tuple) and path[0] == "__embedded__":
        data = _read_embedded_file(path[1])
        if data:
            return Image.open(io.BytesIO(data))
    elif os.path.exists(path):
        return Image.open(path)
    return None

def set_window_icon(root):
    global _icon_photo
    candidates = [
        _find_file("ahg_icon.png"),
        _find_file("AHG_logo.png"),
        os.path.join(os.path.expanduser("~"), "AHG_logo.png"),
    ]
    for path in candidates:
        img = _load_image_from_path(path)
        if img and PIL_OK:
            try:
                img = img.convert("RGBA").resize((32,32), Image.LANCZOS)
                _icon_photo = ImageTk.PhotoImage(img)
                root.iconphoto(True, _icon_photo)
                return
            except Exception:
                logging.debug("Failed to set window icon from image", exc_info=True)
    try: root.iconbitmap(default="")
    except Exception:
        logging.debug("Failed to set default icon", exc_info=True)

# ─────────────────────────────────────────────────────────────────────────────
#  SCROLLBAR
# ─────────────────────────────────────────────────────────────────────────────

class ThinScrollbar(tk.Canvas):
    W = 6
    def __init__(self, parent, command=None, **kw):
        super().__init__(parent, width=self.W, bg=BG,
                         highlightthickness=0, bd=0, **kw)
        self._cmd = command
        self._pos = 0.0
        self._size = 1.0
        self._dragging = False
        self._drag_y = 0
        self._thumb_top = 0
        self._thumb_bot = 0
        self.bind("<Configure>", self._draw)
        self.bind("<ButtonPress-1>",   self._on_click)
        self.bind("<B1-Motion>",       self._on_drag)
        self.bind("<ButtonRelease-1>", self._on_release)

    def set(self, lo, hi):
        self._pos  = float(lo)
        self._size = float(hi) - float(lo)
        self._draw()

    def _draw(self, *_):
        try:
            if not self.winfo_exists(): return
            self.delete("all")
        except Exception: return
        h = self.winfo_height()
        if h < 2: return
        thumb_h = max(25, int(h * self._size))
        thumb_y = int(h * self._pos)
        thumb_y = min(thumb_y, h - thumb_h)
        self.create_rectangle(0, 0, self.W, h, fill=SIDEBAR, outline="")
        self.create_rectangle(1, thumb_y+3, self.W-1, thumb_y+thumb_h-3,
                              fill="#2a2a4a", outline="", tags="thumb")
        self._thumb_top = thumb_y
        self._thumb_bot = thumb_y + thumb_h

    def _on_click(self, e):
        if self._thumb_top <= e.y <= self._thumb_bot:
            self._dragging = True
            self._drag_y = e.y - self._thumb_top
        else:
            h = self.winfo_height()
            if h > 0:
                frac = e.y / h
                if self._cmd: self._cmd("moveto", str(frac))

    def _on_drag(self, e):
        if not self._dragging: return
        h = self.winfo_height()
        if h > 0:
            new_y = e.y - self._drag_y
            frac  = new_y / h
            if self._cmd: self._cmd("moveto", str(max(0.0, frac)))

    def _on_release(self, _):
        self._dragging = False

class ScrollFrame(tk.Frame, NativeScrollMixin):
    def __init__(self, parent, **kw):
        super().__init__(parent, bg=BG_MAIN, **kw)
        self._cv = tk.Canvas(self, bg=BG_MAIN, highlightthickness=0, bd=0)
        self._sb = ThinScrollbar(self, command=self._cv.yview)
        self._cv.configure(yscrollcommand=self._sb.set)
        self._sb.pack(side="right", fill="y")
        self._cv.pack(fill="both", expand=True, padx=(0,4))
        self.inner = tk.Frame(self._cv, bg=BG_MAIN)
        self._win  = self._cv.create_window((0,0), window=self.inner, anchor="nw")
        self.inner.bind("<Configure>", self._reconf)
        self._cv.bind("<Configure>",   self._resize)
        
        self.bind("<MouseWheel>", self._wheel_native)
        self._cv.bind("<MouseWheel>", self._wheel_native)
        self.inner.bind("<MouseWheel>", self._wheel_native)

    def _reconf(self, _):
        self._cv.configure(scrollregion=self._cv.bbox("all"))

    def _resize(self, e):
        self._cv.itemconfig(self._win, width=e.width)

    def add_wheel(self, w):
        self._bind_wheel_recursive(w)

    def _bind_wheel_recursive(self, w):
        w.bind("<MouseWheel>", self._wheel_native, add="+")
        try:
            for child in w.winfo_children():
                self._bind_wheel_recursive(child)
        except Exception:
            logging.debug("Failed to bind wheel recursively", exc_info=True)

# ─────────────────────────────────────────────────────────────────────────────
#  TOGGLE SWITCH
# ─────────────────────────────────────────────────────────────────────────────

class ToggleSwitch(tk.Frame):
    W, H = 44, 22

    def __init__(self, parent, variable, label="", **kw):
        super().__init__(parent, bg=kw.pop("bg", BG), cursor="hand2")
        self._var = variable
        self._anim = None
        self._knob_x = None

        self._cv = tk.Canvas(self, width=self.W, height=self.H,
                             bg=self["bg"], highlightthickness=0, bd=0,
                             cursor="hand2")
        self._cv.pack(side="left")
        if label:
            tk.Label(self, text=label, font=(FN,9), fg=OFFWHITE,
                     bg=self["bg"], cursor="hand2").pack(side="left", padx=(6,0))

        self._cv.bind("<Button-1>", self._toggle)
        self.bind("<Button-1>", self._toggle)
        on = variable.get()
        pad = 3
        h = self.H
        w = self.W
        self._knob_x = w - pad - (h-2*pad)//2 if on else pad + (h-2*pad)//2
        self._draw_at(self._knob_x)
        variable.trace_add("write", lambda *_: self._start_anim())

    def _toggle(self, _=None):
        self._var.set(not self._var.get())

    def _start_anim(self):
        if self._anim:
            try: self.after_cancel(self._anim)
            except Exception:
                logging.debug("Failed to cancel animation", exc_info=True)
        on  = self._var.get()
        pad = 3
        h, w = self.H, self.W
        target_x = w - pad - (h-2*pad)//2 if on else pad + (h-2*pad)//2
        self._animate_knob(self._knob_x, target_x, steps=8, step=0)

    def _animate_knob(self, start_x, end_x, steps, step):
        try:
            if not self._cv.winfo_exists(): return
        except Exception: return
        if step > steps:
            self._knob_x = end_x
            self._draw_at(end_x)
            return
        t = step / steps
        t = t * t * (3 - 2 * t)
        cx = int(start_x + (end_x - start_x) * t)
        self._knob_x = cx
        self._draw_at(cx)
        self._anim = self.after(16, lambda: self._animate_knob(start_x, end_x, steps, step+1))

    def _draw_at(self, knob_x):
        try:
            if not self._cv.winfo_exists(): return
            self._cv.delete("all")
        except Exception: return
        on  = self._var.get()
        bg  = ACCENT if on else "#1e1e2e"
        h, w = self.H, self.W
        r   = h // 2
        self._cv.create_oval(0,0,h,h,fill=bg,outline="")
        self._cv.create_oval(w-h,0,w,h,fill=bg,outline="")
        self._cv.create_rectangle(r,0,w-r,h,fill=bg,outline="")
        pad = 3
        kr  = (h - 2*pad) // 2
        ky  = h // 2
        self._cv.create_oval(knob_x-kr, ky-kr, knob_x+kr, ky+kr, fill=WHITE, outline="")

# ─────────────────────────────────────────────────────────────────────────────
#  BUTTONS
# ─────────────────────────────────────────────────────────────────────────────

def RoundedBtn(parent, text, cmd, bg=MUTED, fg=WHITE,
               hover_bg=None, fs=9, padx=16, pady=6, **kw):
    if hover_bg is None:
        hover_bg = _lighten(bg, 20)
    
    # Use a Button widget - more reliable for clicks
    btn = tk.Button(parent, text=text, font=(FN, fs, "bold"),
                    bg=bg, fg=fg, cursor="hand2",
                    padx=padx, pady=pady,
                    relief="flat", bd=0, highlightthickness=0,
                    command=cmd)
    
    # Style the button to remove default button appearance
    try:
        btn.configure(takefocus=False)
    except Exception:
        logging.debug("Failed to configure button takefocus", exc_info=True)
    
    def on_enter(e):
        btn.configure(bg=hover_bg)
    
    def on_leave(e):
        btn.configure(bg=bg)
    
    btn.bind("<Enter>", on_enter)
    btn.bind("<Leave>", on_leave)
    
    return btn

def _lighten(hx, amt=20):
    h = hx.lstrip("#")
    if len(h) != 6: return hx
    return "#{:02x}{:02x}{:02x}".format(
        min(255,int(h[0:2],16)+amt),
        min(255,int(h[2:4],16)+amt),
        min(255,int(h[4:6],16)+amt))

def _darken(hx, amt=15):
    h = hx.lstrip("#")
    if len(h) != 6: return hx
    return "#{:02x}{:02x}{:02x}".format(
        max(0,int(h[0:2],16)-amt),
        max(0,int(h[2:4],16)-amt),
        max(0,int(h[4:6],16)-amt))

def HSep(parent, padx=0, pady=0):
    tk.Frame(parent, bg=BORDER, height=1).pack(fill="x", padx=padx, pady=pady)

# ─────────────────────────────────────────────────────────────────────────────
#  GAME CARD
# ─────────────────────────────────────────────────────────────────────────────

class GameCard(tk.Frame):
    def __init__(self, parent, appid, name, on_click, card_w=CW, card_h=CH, **kw):
        super().__init__(parent, bg=BORDER, cursor="hand2", **kw)
        self._appid = appid
        self._name = name
        self._on_click = on_click
        self._photo = None
        self._selected = False
        self._card_w = card_w
        self._card_h = card_h
        
        self.configure(width=card_w, height=card_h, bd=0)
        
        self._inner = tk.Frame(self, bg=CARD_BG)
        self._inner.pack(fill="both", expand=True, padx=2, pady=2)
        
        self._img_lbl = tk.Label(self._inner, bg=CARD_BG, bd=0)
        self._img_lbl.pack(fill="both", expand=True)
        ph = get_ph(card_w, card_h)
        self._img_lbl.configure(image=ph)
        self._ph = ph
        
        overlay = tk.Frame(self._inner, bg="#0a0a14", height=55)
        overlay.place(x=0, y=card_h-57, width=card_w-4)
        
        self._star_btn = tk.Label(overlay, text="☆", font=(FN,16,"bold"),
                                   bg="#1a1a28", fg="#666666", cursor="hand2")
        self._star_btn.place(x=card_w-32, y=2, width=28, height=28)
        self._star_btn.bind("<Button-1>", lambda e: self._toggle_favorite(e))
        self._star_btn.bind("<Enter>", lambda _: self._star_btn.configure(fg="#ffd700"))
        self._star_btn.bind("<Leave>", lambda _: self._update_star_hover())
        
        short = (name[:22]+"…") if len(name)>23 else name
        self._name_lbl = tk.Label(overlay, text=short, font=(FN,9,"bold"),
                                   bg="#0a0a14", fg=WHITE, anchor="w", cursor="hand2")
        self._name_lbl.pack(fill="x", padx=10, pady=(6,0))
        self._id_lbl = tk.Label(overlay, text=f"App ID  {appid}", font=(FN,7),
                                  bg="#0a0a14", fg=OFFWHITE, anchor="w", cursor="hand2")
        self._id_lbl.pack(fill="x", padx=10)
        
        # Make overlay also trigger hover
        overlay.bind("<Enter>", self._enter)
        overlay.bind("<Leave>", self._leave)
        
        # Star button placed after other widgets so it's on top
        self._star_btn.lift()
        
        # DRM Label - Bold yellow with glow effect - moved left
        game_data = _ALL_GAMES_DATA.get(appid, {})
        if game_data.get("drm", False):
            # Moved left for better visibility
            drm_frame = tk.Frame(self._inner, bg="#1a1a00", cursor="hand2")
            drm_frame.place(x=card_w-48, y=4, width=36, height=18)
            
            # Bold yellow label with lock - very visible
            drm_lbl = tk.Label(drm_frame, text="🔒 DRM", font=(FN, 6, "bold"),
                               bg="#fbbf24", fg="#1a1a00", cursor="hand2",
                               relief="flat", padx=3, pady=1)
            drm_lbl.pack(fill="both", expand=True)
            
            # Yellow glow border effect
            drm_frame.configure(highlightbackground="#fbbf24", highlightthickness=2)
        
        self.bind("<Button-1>", lambda _: on_click(appid,name))
        self._inner.bind("<Button-1>", lambda _: on_click(appid,name))
        self._img_lbl.bind("<Button-1>", lambda _: on_click(appid,name))
        overlay.bind("<Button-1>", lambda _: on_click(appid,name))
        self._name_lbl.bind("<Button-1>", lambda _: on_click(appid,name))
        self._id_lbl.bind("<Button-1>", lambda _: on_click(appid,name))
        self.bind("<Enter>", self._enter)
        self.bind("<Leave>", self._leave)
        self._inner.bind("<Enter>", self._enter)
        self._inner.bind("<Leave>", self._leave)
        self._img_lbl.bind("<Enter>", self._enter)
        self._img_lbl.bind("<Leave>", self._leave)
        
        # Initial star state
        if appid in _FAVORITES:
            self._star_btn.configure(text="★", fg="#ffd700", bg="#2a2a00")
        
        fetch_cover(appid, card_w, card_h, self._set_img)
    
    def _set_img(self, appid, photo):
        global _loading_cards
        self._photo = photo
        _loading_cards.discard(id(self))
        try:
            self._img_lbl.configure(image=photo)
        except Exception:
            logging.debug("Failed to set card image", exc_info=True)

    def _toggle_favorite(self, e):
        e.widget.update_idletasks()
        if self._appid in _FAVORITES:
            _FAVORITES.discard(self._appid)
            self._star_btn.configure(text="☆", fg="#666666", bg="#1a1a28")
        else:
            _FAVORITES.add(self._appid)
            self._star_btn.configure(text="★", fg="#ffd700", bg="#2a2a00")
        self._on_favorite_changed()

    def _update_star_hover(self):
        if self._appid in _FAVORITES:
            self._star_btn.configure(fg="#ffd700", bg="#2a2a00")
        else:
            self._star_btn.configure(fg="#888888", bg="#1a1a28")

    def _on_favorite_changed(self):
        pass

    def update_favorite(self):
        if self._appid in _FAVORITES:
            self._star_btn.configure(text="★", fg="#ffd700", bg="#2a2a00")
        else:
            self._star_btn.configure(text="☆", fg="#666666", bg="#1a1a28")

    def _enter(self, _=None):
        # Purple hover effect for visibility
        self.configure(bg="#4c1d95")  # Deep purple
        self._inner.configure(bg="#2e1065")  # Lighter purple inner
        self._inner._hovered = True  # Mark as hovered
        try: self._star_btn.lift()
        except Exception:
            logging.debug("Failed to lift star button on hover")
        self.lift()
        
        # Hover on name area
        self._name_lbl.configure(fg="white")
        self._id_lbl.configure(fg="#c0b0d0")

    def _leave(self, _=None):
        self._inner._hovered = False  # Mark as not hovered
        # Keep green border if selected regardless of hover
        if self._selected:
            self.configure(bg="#00ff00", bd=2)  # Bright green border stays
            self._inner.configure(bg="#0a2a0a")
        else:
            self.configure(bg="#0a0a12", bd=0)  # No border when not selected
            self._inner.configure(bg=CARD_BG)
        self._update_star_hover()
        
        # Reset name area colors
        self._name_lbl.configure(fg=WHITE)
        self._id_lbl.configure(fg=OFFWHITE)

    def set_selected(self, val):
        self._selected = val
        if val:
            # Bright green border - persistent until another is clicked
            self.configure(bg="#00ff00", bd=2)
            self._inner.configure(bg="#0a2a0a")
        else:
            self.configure(bg="#0a0a12", bd=0)
            self._inner.configure(bg=CARD_BG)

# ─────────────────────────────────────────────────────────────────────────────
#  GAME ROW
# ─────────────────────────────────────────────────────────────────────────────

class GameRow(tk.Frame):
    def __init__(self, parent, appid, name, on_click,
                 badges=None, action_text=None, action_cmd=None,
                 action_bg="#1e2a3a", **kw):
        super().__init__(parent, bg=PANEL2, cursor="hand2", **kw)
        self._bg=PANEL2; self._hbg=HOV
        self._action_bg = action_bg
        self._action_hbg = _lighten(action_bg, 20)
        
        # Skip hover for action button
        self._skip_hover_for = []

        self._cv = tk.Canvas(self, width=120, height=60,
                             bg="#0d0d18", highlightthickness=0, bd=0)
        self._cv.pack(side="left", padx=12, pady=8)
        ph = get_ph(120, 60)
        if ph:
            self._ph_id = self._cv.create_image(0,0,anchor="nw",image=ph)
            self._cv._ph = ph
        self._photo=None
        fetch_cover(appid, 120, 60, self._set_cover)

        mid = tk.Frame(self, bg=PANEL2)
        mid.pack(side="left", fill="both", expand=True, pady=8)
        self._name_lbl = tk.Label(mid, text=name, font=(FN,10,"bold"),
                                   fg=WHITE, bg=PANEL2, anchor="w")
        self._name_lbl.pack(anchor="w")
        meta = tk.Frame(mid, bg=PANEL2)
        meta.pack(anchor="w", pady=(3,0))
        tk.Label(meta, text=f"AppID  {appid}", font=(FN,8),
                 fg=SUB, bg=PANEL2).pack(side="left")
        if badges:
            for b in badges:
                c={"online":GREEN,"tested":BLUE,"bypass":AMBER}.get(b.lower(),SUB)
                tk.Label(meta, text=f" {b.upper()} ", font=(FN,7,"bold"),
                         bg=c+"33",fg=c).pack(side="left",padx=(5,0))

        self._action_btn = None
        if action_cmd:
            btn = tk.Button(self, text=action_text or "Install",
                font=(FN,9,"bold"), bg=action_bg, fg=WHITE,
                relief="flat", cursor="hand2",
                padx=12, pady=4, bd=0, command=action_cmd)
            btn.pack(side="right", padx=12)
            # Button keeps its own red color - override row hover
            btn.bind("<Enter>", lambda e: btn.configure(bg="#b82a2a"))
            btn.bind("<Leave>", lambda e: btn.configure(bg=action_bg))
            self._action_btn = btn
            # Add to skip list so row hover won't affect button color
            self._skip_hover_for.append(btn)

        tk.Frame(self, bg=BORDER, width=1).pack(side="right", fill="y", pady=6)

        self._bind_hover_recursive(self)
        self.bind("<Button-1>", lambda _: on_click(appid,name))
        for w in (self._cv, mid, self._name_lbl, meta):
            w.bind("<Button-1>", lambda _: on_click(appid,name))

    def _bind_hover_recursive(self, widget):
        # Skip widgets in _skip_hover_for list
        if widget in self._skip_hover_for:
            return
        widget.bind("<Enter>", self._hin, add="+")
        widget.bind("<Leave>", self._hout, add="+")
        try:
            for child in widget.winfo_children():
                if child not in self._skip_hover_for:
                    self._bind_hover_recursive(child)
        except Exception:
            logging.debug("Failed to bind hover recursively", exc_info=True)

    def _set_cover(self, appid, photo):
        self._photo=photo
        try:
            root = self.winfo_toplevel()
            root.after(0, lambda: self._cv.itemconfig(self._ph_id, image=photo))
        except Exception as e: _log(f"_set_cover error: {e}")

    def _hin(self, _=None):
        self._setBg(self._hbg)

    def _hout(self, _=None):
        self._setBg(self._bg)

    def _setBg(self, c):
        try: self.configure(bg=c)
        except Exception:
            logging.debug("Failed to set background color", exc_info=True)
        for w in self.winfo_children():
            # Skip widgets in _skip_hover_for list (like action button)
            if w in self._skip_hover_for:
                continue
            try: w.configure(bg=c)
            except Exception:
                logging.debug("Failed to set child background color", exc_info=True)
            try:
                for ww in w.winfo_children():
                    if ww in self._skip_hover_for:
                        continue
                    try: ww.configure(bg=c)
                    except Exception:
                        logging.debug("Failed to set grandchild background color", exc_info=True)
            except Exception:
                logging.debug("Failed to iterate grandchild widgets", exc_info=True)

# ─────────────────────────────────────────────────────────────────────────────
#  LOG BOX
# ─────────────────────────────────────────────────────────────────────────────

class LogBox(tk.Frame):
    def __init__(self, parent, height=4, **kw):
        super().__init__(parent, bg=SIDEBAR, **kw)
        self._expanded = False
        self._height   = height

        hdr = tk.Frame(self, bg=PANEL2, cursor="hand2")
        hdr.pack(fill="x")
        self._toggle_lbl = tk.Label(hdr, text="▶  LOG", font=(FN,8,"bold"),
                                     fg=SUB, bg=PANEL2, pady=5, cursor="hand2")
        self._toggle_lbl.pack(side="left", padx=12)
        tk.Button(hdr, text="Clear", font=(FN,8), bg=PANEL2, fg=SUB,
                  activebackground=HOV, activeforeground=WHITE,
                  relief="flat", cursor="hand2", bd=0,
                  command=self.clear).pack(side="right", padx=8)
        hdr.bind("<Button-1>", self._toggle)
        self._toggle_lbl.bind("<Button-1>", self._toggle)
        hdr.bind("<Enter>", lambda _: self._toggle_lbl.configure(fg=OFFWHITE))
        hdr.bind("<Leave>", lambda _: self._toggle_lbl.configure(fg=SUB))

        self._wrap = tk.Frame(self, bg="#050510")
        self._t = tk.Text(self._wrap, bg="#050510", fg="#6a6aaa",
                          font=("Consolas",8), relief="flat",
                          state="disabled", wrap="none", height=height,
                          highlightthickness=0, bd=0)
        sb = ThinScrollbar(self._wrap, command=self._t.yview)
        self._t.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        self._t.pack(fill="both", expand=True, padx=8, pady=4)
        for tag,col in [("ok",GREEN),("error",RED),("warn",AMBER),
                        ("info","#8888cc"),("sub","#333350")]:
            self._t.tag_config(tag, foreground=col)

    def _toggle(self, _=None):
        self._expanded = not self._expanded
        if self._expanded:
            self._toggle_lbl.configure(text="▼  LOG")
            self._wrap.pack(fill="both", expand=True)
        else:
            self._toggle_lbl.configure(text="▶  LOG")
            self._wrap.pack_forget()

    def log(self, msg, tag="info"):
        if not self._expanded:
            self._toggle()
        self._t.configure(state="normal")
        self._t.insert("end", msg+"\n", tag)
        self._t.see("end")
        self._t.configure(state="disabled")

    def clear(self):
        self._t.configure(state="normal")
        self._t.delete("1.0","end")
        self._t.configure(state="disabled")

# ─────────────────────────────────────────────────────────────────────────────
#  PAGINATION BAR
# ─────────────────────────────────────────────────────────────────────────────

class PaginationBar(tk.Frame):
    def __init__(self, parent, on_page, **kw):
        super().__init__(parent, bg=BG, **kw)
        self._on_page = on_page
        self._page = 1
        self._total = 1

    def set_total(self, total_pages, current=1):
        self._page = current
        self._total = max(1, total_pages)
        self._rebuild()

    def _rebuild(self):
        for w in self.winfo_children():
            w.destroy()
        p = self._page
        n = self._total

        def _btn(text, page, active=False, enabled=True):
            bg = ACCENT if active else MUTED
            b = tk.Button(self, text=text, font=(FN,9,"bold"),
                          bg=bg, fg=WHITE,
                          activebackground=_lighten(bg,15),
                          activeforeground=WHITE,
                          relief="flat", bd=0, padx=10, pady=5,
                          cursor="hand2" if enabled else "arrow",
                          state="normal" if enabled else "disabled",
                          command=(lambda pg=page: self._go(pg)) if enabled else None)
            b.pack(side="left", padx=2)
            return b

        _btn("‹ Prev", p-1, enabled=(p>1))

        pages_to_show = sorted(set(filter(lambda x: 1<=x<=n,
            [1, 2, p-1, p, p+1, n-1, n])))
        prev = None
        for pg in pages_to_show:
            if prev is not None and pg - prev > 1:
                tk.Label(self, text="…", font=(FN,9), fg=OFFWHITE,
                         bg=BG).pack(side="left", padx=2)
            _btn(str(pg), pg, active=(pg==p))
            prev = pg

        tk.Label(self, text=f"  Page {p} of {n}  ",
                 font=(FN,9), fg=SUB, bg=BG).pack(side="left", padx=6)

        _btn("Next ›", p+1, enabled=(p<n))

    def _go(self, page):
        page = max(1, min(page, self._total))
        self._page = page
        self._rebuild()
        self._on_page(page)

# ─────────────────────────────────────────────────────────────────────────────
#  LIST ROW (for list view) - Enhanced design
# ─────────────────────────────────────────────────────────────────────────────

class ListRow(tk.Frame):
    def __init__(self, parent, appid, name, on_click, **kw):
        super().__init__(parent, bg=BORDER, cursor="hand2", height=64, **kw)
        self._appid = appid
        self._name = name
        self._on_click = on_click
        self._selected = False
        self._photo = None
        
        self.configure(highlightbackground=BORDER, highlightthickness=0)
        self.pack_propagate(False)
        
        # Outer container with slight border
        self._outer = tk.Frame(self, bg="#1a1a26", bd=1, relief="solid")
        self._outer.pack(fill="both", expand=True, padx=4, pady=2)
        
        # Left: Game thumbnail (larger, Steam-style)
        self._img_frame = tk.Frame(self._outer, bg="#0d0d14", width=92, height=35)
        self._img_frame.pack(side="left", padx=(2,8), pady=4)
        self._img_frame.pack_propagate(False)
        
        self._img_lbl = tk.Label(self._img_frame, bg="#0d0d14", bd=0)
        self._img_lbl.pack(fill="both", expand=True)
        self._load_image()
        
        # Middle: Game info
        info_frame = tk.Frame(self._outer, bg="#1a1a26")
        info_frame.pack(side="left", fill="both", expand=True, pady=6)
        
        # Game name - prominent
        short = (name[:48]+"…") if len(name)>48 else name
        self._name_lbl = tk.Label(info_frame, text=short, font=(FN,11,"bold"),
                                  bg="#1a1a26", fg="#ffffff", anchor="w")
        self._name_lbl.pack(side="top", fill="x")
        
        # Sub-info: AppID + tags
        self._sub_lbl = tk.Label(info_frame, text=f"AppID: {appid}", font=(FN,8),
                                bg="#1a1a26", fg="#6b7280", anchor="w")
        self._sub_lbl.pack(side="top", fill="x", pady=(2,0))
        
        # Right side: Actions
        action_frame = tk.Frame(self._outer, bg="#1a1a26")
        action_frame.pack(side="right", padx=10, fill="y")
        
        # Favorite star
        self._star = tk.Label(action_frame, text="☆", font=(FN,12),
                              bg="#1a1a26", fg="#6b7280", cursor="hand2")
        self._star.pack(side="right", padx=8)
        self._update_star()
        self._star.bind("<Button-1>", lambda e: self._toggle_fav())
        
        # Bind events to all widgets
        for w in [self, self._outer, self._img_frame, self._img_lbl, self._name_lbl, self._sub_lbl, info_frame, action_frame]:
            w.bind("<Button-1>", self._on_click_handler)
            w.bind("<Enter>", self._on_enter)
            w.bind("<Leave>", self._on_leave)
        
        self._star.bind("<Enter>", self._on_enter_star)
        self._star.bind("<Leave>", self._on_leave_star)
    
    def _load_image(self):
        """Load Steam header image for this game"""
        game_data = _ALL_GAMES_DATA.get(self._appid, {})
        header_url = game_data.get("header_image", "")
        if header_url:
            try:
                from urllib.request import urlopen
                from PIL import Image
                import io
                img_data = urlopen(header_url, timeout=3).read()
                img = Image.open(io.BytesIO(img_data)).resize((92, 35), Image.LANCZOS)
                self._photo = ImageTk.PhotoImage(img)
                self._img_lbl.configure(image=self._photo)
            except Exception:
                logging.debug("Failed to load header image for recently played")
                self._img_lbl.configure(text="🎮", font=("Segoe UI", 14), fg="#4b5563")
        else:
            self._img_lbl.configure(text="🎮", font=("Segoe UI", 14), fg="#4b5563")
    
    def _on_click_handler(self, e):
        self._on_click(self._appid, self._name)
    
    def _on_enter(self, e):
        if not self._selected:
            self._outer.configure(bg="#252533")
            self._name_lbl.configure(bg="#252533", fg="#f9fafb")
            self._sub_lbl.configure(bg="#252533")
            self._img_frame.configure(bg="#252533")
            self._img_lbl.configure(bg="#252533")
            info_frame = self._name_lbl.master
            info_frame.configure(bg="#252533")
            action_frame = self._star.master
            action_frame.configure(bg="#252533")
            self._star.configure(bg="#252533")
    
    def _on_leave(self, e):
        if not self._selected:
            self._outer.configure(bg="#1a1a26")
            self._name_lbl.configure(bg="#1a1a26", fg="#ffffff")
            self._sub_lbl.configure(bg="#1a1a26")
            self._img_frame.configure(bg="#0d0d14")
            self._img_lbl.configure(bg="#0d0d14")
            info_frame = self._name_lbl.master
            info_frame.configure(bg="#1a1a26")
            action_frame = self._star.master
            action_frame.configure(bg="#1a1a26")
            self._star.configure(bg="#1a1a26")
    
    def _on_enter_star(self, e):
        if self._appid in _FAVORITES:
            self._star.configure(fg="#fbbf24")
        else:
            self._star.configure(fg="#9ca3af")
    
    def _on_leave_star(self, e):
        self._update_star()
    
    def set_selected(self, selected):
        self._selected = selected
        if selected:
            self._outer.configure(bg="#2a2a3a", bd=2, highlightcolor=ACCENT, highlightbackground=ACCENT)
            self._name_lbl.configure(bg="#2a2a3a", fg=ACCENT)
            self._sub_lbl.configure(bg="#2a2a3a")
            self._img_frame.configure(bg="#0d0d14")
            self._img_lbl.configure(bg="#0d0d14")
            info_frame = self._name_lbl.master
            info_frame.configure(bg="#2a2a3a")
            action_frame = self._star.master
            action_frame.configure(bg="#2a2a3a")
            self._star.configure(bg="#2a2a3a")
        else:
            self._outer.configure(bg="#1a1a26", bd=1, highlightbackground=BORDER)
            self._name_lbl.configure(bg="#1a1a26", fg="#ffffff")
            self._sub_lbl.configure(bg="#1a1a26")
            self._img_frame.configure(bg="#0d0d14")
            self._img_lbl.configure(bg="#0d0d14")
            info_frame = self._name_lbl.master
            info_frame.configure(bg="#1a1a26")
            action_frame = self._star.master
            action_frame.configure(bg="#1a1a26")
            self._star.configure(bg="#1a1a26")
    
    def _toggle_fav(self):
        if self._appid in _FAVORITES:
            _FAVORITES.discard(self._appid)
        else:
            _FAVORITES.add(self._appid)
        self._update_star()
    
    def _update_star(self):
        if self._appid in _FAVORITES:
            self._star.configure(text="★", fg="#fbbf24")
        else:
            self._star.configure(text="☆", fg="#6b7280")

# ─────────────────────────────────────────────────────────────────────────────
#  RESPONSIVE GRID
# ─────────────────────────────────────────────────────────────────────────────

class ResponsiveGrid(tk.Frame):
    GAP = 10
    MIN_WIDTH = 960

    def __init__(self, parent, on_select, **kw):
        super().__init__(parent, bg=BG, **kw)
        self._on_select = on_select
        self._all_items = []
        self._page_items = []
        self._cards = []
        self._list_rows = []
        self._sel_card = None
        self._sel_row = None
        self._cols = 0
        self._page = 1
        self._view_mode = "grid"
        self.bind("<Configure>", self._on_resize)

    def set_view_mode(self, mode):
        """Set view mode: 'grid' or 'list'"""
        self._view_mode = mode
        self._render()

    def set_items(self, items, page=1):
        if items == self._all_items and page == self._page:
            return
        self._all_items = items
        self._page = page
        self._render()

    def get_page_count(self):
        if not self._all_items: return 1
        return max(1, (len(self._all_items) + CARDS_PER_PAGE - 1) // CARDS_PER_PAGE)

    def go_page(self, page):
        self._page = max(1, min(page, self.get_page_count()))
        self._render()

    def _render(self):
        if not self.winfo_exists():
            return
        start = (self._page - 1) * CARDS_PER_PAGE
        self._page_items = self._all_items[start:start+CARDS_PER_PAGE]
        
        # Clear existing cards and rows
        for c in self._cards:
            try: c.destroy()
            except Exception:
                logging.debug("Failed to destroy card", exc_info=True)
        for r in self._list_rows:
            try: r.destroy()
            except Exception:
                logging.debug("Failed to destroy list row", exc_info=True)
        self._cards = []
        self._list_rows = []
        self._sel_card = None
        self._sel_row = None

        if self._view_mode == "list":
            # List view - show as rows (inside this grid which is in scrollframe)
            for appid, name in self._page_items:
                row = ListRow(self, appid, name, self._on_list_select)
                self._list_rows.append(row)
            self._do_list_layout()
        else:
            # Grid view - show as cards
            for appid, name in self._page_items:
                card = GameCard(self, appid, name, self._click)
                self._cards.append(card)
            self._do_layout()

    def _do_list_layout(self):
        """Layout for list view - single column rows"""
        for i, row in enumerate(self._list_rows):
            row.place(x=10, y=i * 68 + 10, relwidth=0.98, height=64)
        
        total_h = len(self._list_rows) * 68 + 20
        if total_h != self.winfo_height():
            self.configure(height=max(total_h, 400))

    def _on_list_select(self, appid, name):
        """Handle list row selection"""
        if self._sel_row:
            try: self._sel_row.set_selected(False)
            except Exception:
                logging.debug("Failed to deselect row", exc_info=True)
        for r in self._list_rows:
            if r._appid == appid:
                r.set_selected(True)
                self._sel_row = r
                break
        self._on_select(appid, name)

    def _do_layout(self):
        width = self.winfo_width()
        if width < 100:
            width = self.MIN_WIDTH
        cols = max(COLS_MIN, (width + self.GAP) // (CW + self.GAP))
        
        needs_full_relayout = cols != self._cols
        
        for i, card in enumerate(self._cards):
            row, col = divmod(i, cols)
            x = col * (CW + self.GAP) + self.GAP
            y = row * (CH + self.GAP) + self.GAP
            card.place(x=x, y=y, width=CW, height=CH)
        
        total_rows = (len(self._cards) + cols - 1) // cols if self._cards else 0
        total_h = total_rows * (CH + self.GAP) + self.GAP
        if total_h != self.winfo_height():
            self.configure(height=max(total_h, 400))
        self._cols = cols

    def _on_resize(self, e):
        if e.width > 100:
            new_cols = max(COLS_MIN, (e.width + self.GAP) // (CW + self.GAP))
            if new_cols != self._cols:
                self._cols = new_cols
                if self._view_mode == "list":
                    self._do_list_layout()
                else:
                    self._do_layout()

    def _click(self, appid, name):
        if self._sel_card:
            try: self._sel_card.set_selected(False)
            except Exception:
                logging.debug("Failed to deselect card", exc_info=True)
        for c in self._cards:
            if c._appid == appid:
                c.set_selected(True)
                self._sel_card = c
                break
        self._on_select(appid, name)

    def deselect_all(self):
        if self._sel_card:
            try: self._sel_card.set_selected(False)
            except Exception:
                logging.debug("Failed to deselect all cards", exc_info=True)
        self._sel_card = None

# ─────────────────────────────────────────────────────────────────────────────
#  TOAST NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────────────────

class ToastNotification:
    def __init__(self, parent, message, duration=3000, color=SUCCESS):
        self._win = tk.Toplevel(parent)
        self._win.overrideredirect(True)
        self._win.attributes("-topmost", True)
        
        screen_w = parent.winfo_screenwidth()
        x = screen_w - 340
        y = 60
        
        self._win.geometry(f"320x70+{x}+{y}")
        
        bg_color = "#1a1a26"
        fg_color = "#f8fafc"
        
        # Main container with border
        f = tk.Frame(self._win, bg=color, padx=2, pady=2)
        f.pack(fill="both", expand=True)
        
        inner = tk.Frame(f, bg=bg_color, cursor="hand2")
        inner.pack(fill="both", expand=True)
        inner.bind("<Button-1>", lambda _: self._win.destroy())
        
        # Icon based on color
        icon_map = {SUCCESS: "✅", ERROR: "❌", WARNING: "⚠️", INFO: "ℹ️"}
        icon = icon_map.get(color, "ℹ️")
        
        indicator = tk.Frame(inner, bg=color, width=3)
        indicator.pack(side="left", fill="y")
        
        icon_lbl = tk.Label(inner, text=icon, font=(FN, 16), bg=bg_color)
        icon_lbl.pack(side="left", padx=(12, 8), pady=15)
        
        lbl = tk.Label(inner, text=message, font=(FN, 9), bg=bg_color, fg=fg_color,
                      wraplength=250, justify="left", anchor="w")
        lbl.pack(side="left", fill="both", expand=True, pady=10)
        
        self._win.after(duration, self._win.destroy)

def show_toast(parent, message, duration=3000, color=SUCCESS):
    try:
        ToastNotification(parent, message, duration, color)
    except Exception:
        pass

# ─────────────────────────────────────────────────────────────────────────────
#  GITHUB AUTO-UPDATE SYSTEM
# ─────────────────────────────────────────────────────────────────────────────

def _compare_versions(v1, v2):
    """Compare two version strings numerically. Returns True if v1 > v2"""
    try:
        def parse_version(v):
            # Split by "." and handle cases like "0.4" -> [0, 4], "0.40" -> [0, 40], "0.31" -> [0, 31]
            v = v.lstrip("v").replace(",", ".")
            parts = v.split(".")
            result = []
            for p in parts:
                # Handle versions like "0.40" (should be 40, not 4 then 0)
                if p.isdigit():
                    result.append(int(p))
                elif p:
                    # Try to extract numeric part
                    nums = ''.join(c for c in p if c.isdigit())
                    if nums:
                        result.append(int(nums))
            return result if result else [0]
        
        v1_parts = parse_version(v1)
        v2_parts = parse_version(v2)
        
        # Pad with zeros to compare equal length
        max_len = max(len(v1_parts), len(v2_parts))
        v1_parts.extend([0] * (max_len - len(v1_parts)))
        v2_parts.extend([0] * (max_len - len(v2_parts)))
        
        # Compare numerically
        for i in range(max_len):
            if v1_parts[i] > v2_parts[i]:
                return True
            elif v1_parts[i] < v2_parts[i]:
                return False
        return False  # Equal versions
    except Exception:
        logging.warning("Failed to compare versions, falling back to string comparison", exc_info=True)
        return v1 > v2  # Fallback to string comparison

def check_for_updates():
    try:
        import urllib.request
        import json
        
        req = urllib.request.Request(
            GITHUB_API_URL,
            headers={"User-Agent": "AHGSteamUnlocker/9.2"}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
        
        latest_version = data.get("tag_name", "v0.0").lstrip("v")
        current_version = APP_VER.lstrip("v")
        
        # Extract download URL from assets
        download_url = None
        for asset in data.get("assets", []):
            if asset.get("name", "").endswith(".exe"):
                download_url = asset.get("browser_download_url")
                break
        
        return {
            "has_update": _compare_versions(latest_version, current_version),
            "latest_version": latest_version,
            "current_version": current_version,
            "download_url": download_url,
            "release_notes": data.get("body", ""),
            "html_url": data.get("html_url", "")
        }
    except Exception as e:
        return {
            "has_update": False,
            "latest_version": "Unknown",
            "current_version": APP_VER,
            "download_url": None,
            "release_notes": "",
            "html_url": "",
            "error": str(e)
        }

def download_update(download_url, callback=None):
    try:
        import urllib.request
        import tempfile
        import shutil
        import hashlib
        
        # Get the filename from download URL
        filename = download_url.split("/")[-1]
        if not filename.endswith(".exe"):
            filename = "AHG_Steam_Unlocker_update.exe"
        
        # Download to temp folder
        temp_path = os.path.join(tempfile.gettempdir(), filename)
        
        def progress_callback(block_num, block_size, total_size):
            if callback:
                downloaded = block_num * block_size
                progress = min(100, int((downloaded / total_size) * 100)) if total_size > 0 else 0
                callback(progress)
        
        urllib.request.urlretrieve(download_url, temp_path, reporthook=progress_callback)
        
        # SHA256 verification
        sha256 = hashlib.sha256()
        with open(temp_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        actual_hash = sha256.hexdigest()
        
        # Try to fetch expected hash from parallel .sha256 file
        expected_hash = None
        hash_url = download_url + ".sha256"
        try:
            with urllib.request.urlopen(hash_url, timeout=5) as hr:
                content = hr.read().decode("utf-8").strip()
                # Accept "hash  filename" or just "hash"
                expected_hash = content.split()[0] if content else None
        except Exception:
            logging.warning("No SHA256 hash file available at %s, skipping verification", hash_url)
        
        if expected_hash:
            if actual_hash.lower() != expected_hash.lower():
                os.remove(temp_path)
                logging.error("SHA256 mismatch for downloaded update: got %s, expected %s", actual_hash, expected_hash)
                return None
            logging.info("SHA256 verification passed for update")
        
        return temp_path
    except Exception as e:
        return None

def install_update(update_path):
    try:
        import sys
        import subprocess
        import tempfile
        
        # Get current EXE path
        if getattr(sys, 'frozen', False):
            current_exe = sys.executable
        else:
            current_exe = sys.argv[0]
        
        # Create a batch script to replace the EXE and restart
        batch_script = tempfile.NamedTemporaryFile(mode='w', suffix='.bat', delete=False, encoding='utf-8')
        batch_script.write(f'''@echo off
timeout /t 2 /nobreak >nul
copy /Y "{update_path}" "{current_exe}"
del "{update_path}"
start "" "{current_exe}"
''')
        batch_script.close()
        
        # Run the batch script and exit
        subprocess.Popen(
            ['cmd', '/c', 'start', '', batch_script.name],
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
        )
        
        return True
    except Exception as e:
        return False

# ─────────────────────────────────────────────────────────────────────────────
#  PROFESSIONAL SPLASH SCREEN WITH ANIMATIONS
# ─────────────────────────────────────────────────────────────────────────────

class SplashScreen:
    def __init__(self, parent):
        self.parent = parent
        self._closed = False
        self._frame = 0
        self._target_progress = 0
        self._current_progress = 0
        self._status_text = "Loading"
        self._anim_id = None
        self._logo_image = None
        
        # Dynamic colorful particles - flowing nebula effect
        self._particles = []
        colors = [
            (255, 100, 150),   # Pink
            (100, 150, 255),  # Blue
            (255, 200, 100),  # Gold
            (150, 255, 150),  # Green
            (200, 100, 255),  # Purple
            (255, 150, 50),   # Orange
            (100, 255, 255),  # Cyan
            (255, 100, 200),  # Magenta
        ]
        for i in range(40):
            self._particles.append({
                'x': random.uniform(0, 400),
                'y': random.uniform(0, 320),
                'size': random.uniform(2, 6),
                'speed_y': random.uniform(0.2, 1.0),
                'speed_x': random.uniform(-0.3, 0.3),
                'color': random.choice(colors),
                'pulse': random.uniform(0.02, 0.06),
                'alpha': random.uniform(0.3, 0.9),
                'direction': 1,
            })
        
        parent.withdraw()
        
        sw = parent.winfo_screenwidth()
        sh = parent.winfo_screenheight()
        
        self._width = 420
        self._height = 300
        x = (sw - self._width) // 2
        y = (sh - self._height) // 2
        
        self.win = tk.Toplevel(parent)
        self.win.geometry(f"{self._width}x{self._height}+{x}+{y}")
        self.win.configure(bg="#080810")
        self.win.overrideredirect(True)
        self.win.attributes("-topmost", True)
        self.win.deiconify()
        
        self.canvas = tk.Canvas(self.win, width=self._width, height=self._height, 
                               bg="#080810", highlightthickness=0)
        self.canvas.pack(fill="both", expand=True)
        
        # Load logo from dist folder
        try:
            # Try different possible paths
            for logo_file in ["dist/AHG_logo.png", "dist/AHG Logo.png", "AHG_logo.png"]:
                if os.path.exists(logo_file):
                    img = Image.open(logo_file).resize((100, 100), Image.LANCZOS)
                    self._logo_image = ImageTk.PhotoImage(img)
                    break
            else:
                # Fallback to embedded
                logo_path = _find_file("AHG_logo.png")
                if isinstance(logo_path, tuple):
                    img_data = _read_embedded_file(logo_path[1])
                    if img_data:
                        img = Image.open(BytesIO(img_data)).resize((100, 100), Image.LANCZOS)
                        self._logo_image = ImageTk.PhotoImage(img)
                elif logo_path:
                    img = Image.open(logo_path).resize((100, 100), Image.LANCZOS)
                    self._logo_image = ImageTk.PhotoImage(img)
        except Exception as e:
            print(f"[Splash] Logo: {e}")
        
        self._target_progress = 1
        self._animate()
    
    def _draw(self):
        self.canvas.delete("all")
        
        # Dark background
        self.canvas.create_rectangle(0, 0, self._width, self._height, fill="#080810", outline="")
        
        # Draw colorful particles (nebula effect)
        self._draw_particles()
        
        cx, cy = self._width // 2, 95
        
        # Logo with animated rainbow glow
        if self._logo_image:
            # Multi-color glow rings
            colors = ["#ff6b9d", "#9d6bff", "#6b9dff", "#6bff9d", "#ff9d6b"]
            for i, c in enumerate(colors):
                offset = math.sin(self._frame * 0.05 + i) * 5
                self.canvas.create_oval(
                    cx - 50 - i*4 + offset, cy - 50 - i*4 + offset,
                    cx + 50 + i*4 + offset, cy + 50 + i*4 + offset,
                    fill="", outline=c, width=2
                )
            self.canvas.create_image(cx, cy, image=self._logo_image)
        else:
            # Colorful placeholder
            for i in range(6, 0, -1):
                c = f'#{100+i*20:02x}{80+i*15:02x}{180+i*10:02x}'
                self.canvas.create_oval(cx-40-i*7, cy-40-i*7, cx+40+i*7, cy+40+i*7, fill=c, outline="")
            self.canvas.create_text(cx, cy, text="AHG", font=("Segoe UI", 20, "bold"), fill="white")
        
        # Title with glow - larger and more visible
        title_y = 175
        # Glow/shadow
        self.canvas.create_text(self._width // 2, title_y,
                               text="STEAM UNLOCKER",
                               font=("Segoe UI", 22, "bold"),
                               fill="#1a1a2e")
        # Main text
        self.canvas.create_text(self._width // 2, title_y - 1,
                               text="STEAM UNLOCKER",
                               font=("Segoe UI", 22, "bold"),
                               fill="#ffffff")
        
        # Version - bigger and more visible
        self.canvas.create_text(self._width // 2, 198,
                               text=f"Version {APP_VER}",
                               font=("Segoe UI", 12, "bold"),
                               fill="#22c55e")
        
        # Progress bar - larger and more prominent
        bar_x, bar_y, bar_w, bar_h = 60, 230, 300, 8
        
        # Track
        self.canvas.create_rounded_rect(bar_x, bar_y, bar_x + bar_w, bar_y + bar_h, 3,
                                       fill="#151520", outline="#2a2a3a", width=1)
        
        # Smooth progress
        diff = self._target_progress - self._current_progress
        self._current_progress += diff * 0.12
        
        if self._frame % 2 == 0 and self._target_progress < 100:
            self._target_progress = min(100, self._target_progress + 0.5)
        
        progress = self._current_progress / 100.0
        fill_w = int(bar_w * progress)
        
        if fill_w > 4:
            # Green gradient fill
            self.canvas.create_rounded_rect(bar_x, bar_y, bar_x + fill_w, bar_y + bar_h, 3,
                                           fill="#22c55e", outline="")
            
            # Shine
            if fill_w > 20:
                shine = self.canvas.create_rounded_rect(
                    bar_x + fill_w - 25, bar_y, bar_x + fill_w, bar_y + bar_h, 2,
                    fill="#4ade80", outline=""
                )
        
        # Percentage - larger
        self.canvas.create_text(self._width // 2, bar_y + 20,
                               text=f"{int(self._current_progress)}%",
                               font=("Segoe UI", 10, "bold"),
                               fill="#64748b")
        
        # Animated status - larger
        dots = "." * ((self._frame // 12) % 4)
        self.canvas.create_text(self._width // 2, 270,
                               text=self._status_text + dots,
                               font=("Segoe UI", 10),
                               fill="#64748b")
    
    def _draw_particles(self):
        w, h = self._width, self._height
        
        for p in self._particles:
            # Move particle
            p['y'] += p['speed_y']
            p['x'] += p['speed_x']
            
            # Pulse alpha
            p['alpha'] += p['pulse'] * p['direction']
            if p['alpha'] >= 1.0:
                p['alpha'] = 1.0
                p['direction'] = -1
            elif p['alpha'] <= 0.2:
                p['alpha'] = 0.2
                p['direction'] = 1
            
            # Wrap around
            if p['y'] > h + 10:
                p['y'] = -10
                p['x'] = random.uniform(0, w)
            if p['x'] < -10: p['x'] = w + 10
            if p['x'] > w + 10: p['x'] = -10
            
            # Draw with color
            cr, cg, cb = p['color']
            alpha = p['alpha']
            r = int(cr * alpha)
            g = int(cg * alpha)
            b = int(cb * alpha)
            color = f'#{r:02x}{g:02x}{b:02x}'
            
            # Glow layer
            for gi in range(3, 0, -1):
                galpha = alpha * (4 - gi) * 0.15
                gr = int(cr * galpha)
                gg = int(cg * galpha)
                gb = int(cb * galpha)
                gcolor = f'#{gr:02x}{gg:02x}{gb:02x}'
                self.canvas.create_oval(
                    p['x'] - p['size']*gi, p['y'] - p['size']*gi,
                    p['x'] + p['size']*gi, p['y'] + p['size']*gi,
                    fill=gcolor, outline=""
                )
            
            # Core
            self.canvas.create_oval(
                p['x'] - p['size'], p['y'] - p['size'],
                p['x'] + p['size'], p['y'] + p['size'],
                fill=color, outline=""
            )
    
    def _draw(self):
        self.canvas.delete("all")
        
        # Dark background
        self.canvas.create_rectangle(0, 0, self._width, self._height, fill="#0a0a14", outline="")
        
        # Animated particles (stars)
        self._draw_particles()
        
        cx, cy = self._width // 2, 95
        
        # Logo with glow
        if self._logo_image:
            # Glow effect behind logo
            for i in range(3, 0, -1):
                glow_color = f'#{int(80+i*30):02x}{int(50+i*30):02x}{int(180+i*25):02x}'
                self.canvas.create_oval(cx-40-i*5, cy-40-i*5, cx+40+i*5, cy+40+i*5,
                                      fill=glow_color, outline="")
            self.canvas.create_image(cx, cy, image=self._logo_image)
        else:
            # Placeholder
            for i in range(4, 0, -1):
                c = f'#{int(100-i*15):02x}{int(80-i*15):02x}{int(200-i*20):02x}'
                self.canvas.create_oval(cx-35-i*8, cy-35-i*8, cx+35+i*8, cy+35+i*8, fill=c, outline="")
            self.canvas.create_text(cx, cy, text="AHG", font=("Segoe UI", 16, "bold"), fill="white")
        
        # Title
        self.canvas.create_text(self._width // 2, 175,
                               text="STEAM UNLOCKER",
                               font=("Segoe UI", 16, "bold"),
                               fill="white")
        
        # Version with accent
        self.canvas.create_text(self._width // 2, 192,
                               text=f"Version {APP_VER}",
                               font=("Segoe UI", 9),
                               fill="#22c55e")
        
        # Modern progress bar
        bar_x, bar_y, bar_w, bar_h = 50, 218, 280, 6
        
        # Background track with subtle border
        self.canvas.create_rounded_rect(bar_x, bar_y, bar_x + bar_w, bar_y + bar_h, 3,
                                       fill="#15151f", outline="#2a2a3a", width=1)
        
        # Smooth progress
        diff = self._target_progress - self._current_progress
        self._current_progress += diff * 0.1
        
        if self._frame % 2 == 0 and self._target_progress < 100:
            self._target_progress = min(100, self._target_progress + 0.6)
        
        progress = self._current_progress / 100.0
        fill_w = int(bar_w * progress)
        
        if fill_w > 4:
            # Green fill with glow
            for i in range(2, 0, -1):
                glow = f'#{max(0,34-i*10):02x}{max(0,197-i*30):02x}{max(0,87-i*20):02x}'
                self.canvas.create_rounded_rect(bar_x, bar_y-i, bar_x + fill_w + i*2, bar_y + bar_h + i, 3,
                                               fill=glow, outline="")
            self.canvas.create_rounded_rect(bar_x, bar_y, bar_x + fill_w, bar_y + bar_h, 3,
                                           fill="#22c55e", outline="")
            
            # Shine effect on leading edge
            shine_x = bar_x + fill_w - 20
            if shine_x > bar_x:
                self.canvas.create_rounded_rect(shine_x, bar_y, shine_x + 15, bar_y + bar_h, 2,
                                               fill="#4ade80", outline="")
        
        # Percentage
        self.canvas.create_text(self._width // 2, bar_y + 18,
                               text=f"{int(self._current_progress)}%",
                               font=("Segoe UI", 8),
                               fill="#64748b")
        
        # Animated dots
        dots = "." * ((self._frame // 15) % 4)
        self.canvas.create_text(self._width // 2, 255,
                               text=self._status_text + dots,
                               font=("Segoe UI", 8),
                               fill="#475569")
    
    def _animate(self):
        if self._closed:
            return
        
        self._frame += 1
        self._draw()
        self._anim_id = self.win.after(33, self._animate)
    
    def set_progress(self, value, text=""):
        if self._closed:
            return
        self._target_progress = max(0, min(100, value * 100))
        if text:
            self._status_text = text
    
    def close(self):
        if self._closed:
            return
        self._closed = True
        
        if self._anim_id:
            self.win.after_cancel(self._anim_id)
        
        self.parent.deiconify()
        self.parent.lift()
        self.parent.focus_force()
        try:
            self.win.destroy()
        except Exception:
            logging.debug("Failed to destroy splash window", exc_info=True)


# ─────────────────────────────────────────────────────────────────────────────
#  CANVAS ROUNDED RECTANGLE HELPER
# ─────────────────────────────────────────────────────────────────────────────

def _create_rounded_rect(canvas, x1, y1, x2, y2, radius, **kwargs):
    """Draw a rounded rectangle on canvas"""
    fill = kwargs.get('fill', '')
    outline = kwargs.get('outline', '')
    
    # Draw four corners
    canvas.create_arc(x1, y1, x1 + radius*2, y1 + radius*2, start=90, extent=90, fill=fill, outline="")
    canvas.create_arc(x2 - radius*2, y1, x2, y1 + radius*2, start=0, extent=90, fill=fill, outline="")
    canvas.create_arc(x1, y2 - radius*2, x1 + radius*2, y2, start=180, extent=90, fill=fill, outline="")
    canvas.create_arc(x2 - radius*2, y2 - radius*2, x2, y2, start=270, extent=90, fill=fill, outline="")
    
    # Draw four sides
    canvas.create_rectangle(x1 + radius, y1, x2 - radius, y2, fill=fill, outline="")
    canvas.create_rectangle(x1, y1 + radius, x2, y2 - radius, fill=fill, outline="")

# Monkey-patch Canvas to add rounded rect method
tk.Canvas.create_rounded_rect = _create_rounded_rect


# ─────────────────────────────────────────────────────────────────────────────
#  MAIN APPLICATION
# ─────────────────────────────────────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        
        # CRITICAL: Show splash IMMEDIATELY before ANY other operations
        # This prevents any default window from appearing
        self._splash = SplashScreen(self)
        
        # NOW do other initialization
        self.withdraw()
        
        global FN
        FN = _pick_font()

        self.title(APP_NAME)
        self.configure(bg=BG_MAIN)
        self.resizable(True, True)
        
        # Continue with splash progress
        self._splash.set_progress(0, "Initializing")
        
        # Load config
        self._cfg = load_cfg()
        
        # Restore saved window geometry
        saved_geo = self._cfg.get("window_geometry", "1400x840")
        self.geometry(saved_geo)
        self.minsize(960, 660)
        set_window_icon(self)
        
        # Save window geometry on close
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self._sel_appid = ""
        self._sel_name = ""
        self._fixes_raw = []
        self._fixes_ok = False
        self._page = "home"
        self._search_timer = None
        self._is_searching = False
        self._search_focused = False
        self._batch_mode = False
        self._selected_batch = set()
        
        # Active scroll frame for global wheel handling
        self._active_scroll = None
        self.bind("<MouseWheel>", self._on_mousewheel)
        self.bind("<Button-4>", self._on_mousewheel)
        self.bind("<Button-5>", self._on_mousewheel)
        
        # Keyboard shortcuts
        self.bind("<Control-f>", lambda e: self._focus_search())
        self.bind("<Control-d>", lambda e: self._quick_favorite())
        self.bind("<Control-g>", lambda e: self._toggle_view_mode())
        self.bind("<Control-t>", lambda e: self._toggle_theme())
        self.bind("<Control-1>", lambda e: self._show("home"))
        self.bind("<Control-2>", lambda e: self._show("favourites"))
        self.bind("<Control-3>", lambda e: self._show("recent"))
        self.bind("<Control-4>", lambda e: self._show("collections"))
        self.bind("<Control-5>", lambda e: self._show("library"))
        self.bind("<question>", lambda e: self._show_shortcuts())
        
        # Keyboard navigation
        self.bind("<Up>", lambda e: self._navigate_cards(-1, 0))
        self.bind("<Down>", lambda e: self._navigate_cards(1, 0))
        self.bind("<Left>", lambda e: self._navigate_cards(0, -1))
        self.bind("<Right>", lambda e: self._navigate_cards(0, 1))
        self.bind("<Return>", self._select_card)
        self.bind("<Delete>", self._batch_remove)
        self.bind("?", self._show_shortcuts)
        self.bind("<Escape>", self._hide_shortcuts)
        self.bind("/", lambda e: self._focus_search())
        
        # View shortcuts (1-5)
        self.bind("1", lambda e: self._show("home"))
        self.bind("2", lambda e: self._show("favourites"))
        self.bind("3", lambda e: self._show("library"))
        self.bind("4", lambda e: self._show("fixes"))
        self.bind("5", lambda e: self._show("settings"))

        self._sv = {k:tk.StringVar(value=str(v))
                     for k,v in self._cfg.items() if isinstance(v,str)}
        self._dlc = tk.BooleanVar(value=self._cfg.get("include_dlc",True))

        # Start splash at 0% - it will auto-animate to 100%
        self._splash.set_progress(0, "Initializing")
        self._build_ui()
        self._splash.set_progress(0.1, "Loading UI")
        self._show("home")
        
        # Let splash continue animating while we load features
        self.after(100, self._load_featured)
        
        # Wait for progress to naturally reach 100%, then close splash
        self.after(10000, self._close_splash)
    
    def _close_splash(self):
        """Close splash screen only when app is truly ready"""
        self._splash.set_progress(1.0, "Ready!")
        self.after(500, lambda: self._splash.close() if hasattr(self, '_splash') and self._splash else None)
    
    def _on_mousewheel(self, event):
        """Handle mousewheel for smooth scrolling in all sections"""
        if self._active_scroll and hasattr(self._active_scroll, '_cv'):
            delta = 0
            if hasattr(event, 'delta') and event.delta:
                delta = -1 if event.delta > 0 else 1
            elif hasattr(event, 'num'):
                delta = -1 if event.num == 4 else 1 if event.num == 5 else 0
            if delta:
                self._active_scroll._cv.yview_scroll(delta, "units")
    
    def set_active_scroll(self, scroll_frame):
        """Set the active scroll frame for wheel events"""
        self._active_scroll = scroll_frame
        if not getattr(self, '_is_searching', False):
            self.after(200, self._load_featured)

    def _navigate_cards(self, dy, dx):
        if self._page != "home" or not hasattr(self, '_rgrid'):
            return
        cols = self._rgrid._cols
        self._rgrid._focused = getattr(self._rgrid, '_focused', 0)
        new_focus = self._rgrid._focused + dy * cols + dx
        new_focus = max(0, min(new_focus, len(self._rgrid._items) - 1))
        self._rgrid._focused = new_focus

    def _select_card(self, _=None):
        if self._page != "home" or not hasattr(self, '_rgrid'):
            return
        focus = getattr(self._rgrid, '_focused', None)
        if focus is not None and focus < len(self._rgrid._items):
            appid, name = self._rgrid._items[focus]
            self._card_click(appid, name)

    def _batch_remove(self, _=None):
        if not self._batch_mode or not hasattr(self, '_rgrid'):
            return
        focus = getattr(self._rgrid, '_focused', None)
        if focus is not None and focus < len(self._rgrid._items):
            appid, name = self._rgrid._items[focus]
            if appid in self._selected_batch:
                self._selected_batch.discard(appid)
                self._hlog.log(f"Removed {name} from batch", "info")

    def _show_shortcuts(self, _=None):
        if hasattr(self, '_shortcuts_win') and self._shortcuts_win.winfo_exists():
            self._shortcuts_win.lift()
            return
        
        self._shortcuts_win = tk.Toplevel(self)
        self._shortcuts_win.title("Keyboard Shortcuts")
        self._shortcuts_win.configure(bg="#1a1a26")
        self._shortcuts_win.transient(self)
        self._shortcuts_win.grab_set()
        
        screen_w = self.winfo_screenwidth()
        screen_h = self.winfo_screenheight()
        win_w, win_h = 420, 500
        x = (screen_w - win_w) // 2
        y = (screen_h - win_h) // 2
        self._shortcuts_win.geometry(f"{win_w}x{win_h}+{x}+{y}")
        
        # Main container
        container = tk.Frame(self._shortcuts_win, bg="#1a1a26")
        container.pack(fill="both", expand=True)
        
        header = tk.Frame(container, bg="#1a1a26")
        header.pack(fill="x", padx=20, pady=(15,10))
        
        tk.Label(header, text="Keyboard Shortcuts", font=(FN, 16, "bold"),
                bg="#1a1a26", fg=TEXT_PRIMARY).pack(anchor="w")
        
        # Canvas with scrollbar for scrolling
        self._shortcuts_canvas = tk.Canvas(container, bg="#1a1a26", highlightthickness=0)
        scrollbar = tk.Scrollbar(container, command=self._shortcuts_canvas.yview)
        self._shortcuts_canvas.configure(yscrollcommand=scrollbar.set)
        
        scrollable_frame = tk.Frame(self._shortcuts_canvas, bg="#1a1a26")
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: self._shortcuts_canvas.configure(scrollregion=self._shortcuts_canvas.bbox("all"))
        )
        
        self._shortcuts_canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        
        self._shortcuts_canvas.pack(side="left", fill="both", expand=True, padx=(20,0), pady=(0,40))
        scrollbar.pack(side="right", fill="y", padx=(5,10), pady=(0,40))
        
        shortcuts = [
            ("Navigation", [
                ("↑ ↓ ← →", "Navigate cards"),
                ("Enter", "Select focused game"),
                ("Delete", "Remove from batch"),
                ("Tab", "Next game"),
            ]),
            ("Search", [
                ("/", "Focus search bar"),
                ("Ctrl+F", "Focus search bar"),
                ("Esc", "Clear search / Close this"),
            ]),
            ("Favorites", [
                ("Ctrl+D", "Add to favorites"),
                ("Ctrl+Shift+D", "Remove from favorites"),
            ]),
            ("View", [
                ("Ctrl+1", "Go to Home"),
                ("Ctrl+2", "Go to Favourites"),
                ("Ctrl+3", "Go to Recent"),
                ("Ctrl+4", "Go to Collections"),
                ("Ctrl+5", "Go to Library"),
            ]),
            ("General", [
                ("?", "Show shortcuts"),
                ("Ctrl+S", "Save to favorites"),
                ("Ctrl+I", "Install selected"),
                ("Ctrl+G", "Toggle grid/list view"),
                ("Ctrl+T", "Toggle theme"),
            ]),
            ("Game Actions", [
                ("Enter", "Install selected game"),
                ("Space", "Toggle favorite"),
                ("I", "View game details"),
            ]),
        ]
        
        for section, items in shortcuts:
            tk.Label(scrollable_frame, text=section, font=(FN, 11, "bold"),
                    bg="#1a1a26", fg=PRIMARY_PURPLE, anchor="w").pack(anchor="w", pady=(12,4))
            
            for key, desc in items:
                row = tk.Frame(scrollable_frame, bg="#1a1a26")
                row.pack(fill="x", pady=2)
                
                key_lbl = tk.Label(row, text=key, font=(FN, 10, "bold"),
                                 bg="#2a2a3a", fg=ACCENT, width=12, padx=8, pady=4)
                key_lbl.pack(side="left")
                
                desc_lbl = tk.Label(row, text=desc, font=(FN, 10),
                                   bg="#1a1a26", fg=TEXT_SECONDARY, anchor="w")
                desc_lbl.pack(side="left", padx=(10,0))
        
        footer = tk.Frame(container, bg="#1a1a26")
        footer.pack(fill="x", side="bottom", padx=20, pady=(10,15))
        tk.Label(footer, text="Press Esc or click outside to close",
                font=(FN, 9), bg="#1a1a26", fg=TEXT_MUTED).pack()
        
        self._shortcuts_win.bind("<Escape>", self._hide_shortcuts)
        self._shortcuts_win.bind("<Button-1>", lambda e: self._hide_shortcuts() if e.widget == self._shortcuts_win else None)
        
        # Bind mousewheel for scrolling
        def _on_mousewheel(event):
            self._shortcuts_canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        self._shortcuts_canvas.bind("<MouseWheel>", _on_mousewheel)
        container.bind("<MouseWheel>", _on_mousewheel)

    def _hide_shortcuts(self, _=None):
        if hasattr(self, '_shortcuts_win') and self._shortcuts_win.winfo_exists():
            self._shortcuts_win.destroy()
            self._shortcuts_win = None
            self._shortcuts_canvas = None

    def _on_close(self):
        # Save window geometry
        geometry = self.geometry()
        self._cfg["window_geometry"] = geometry
        # Save favorites
        try:
            fav_path = os.path.join(os.path.expanduser("~"), ".ahg_favorites")
            with open(fav_path, "w") as f:
                json.dump(list(_FAVORITES), f)
        except Exception:
            pass
        save_cfg(self._cfg)
        self.destroy()

    def _check_for_updates(self):
        self._update_btn.configure(text="Checking...", fg=TEXT_MUTED)
        self.update()
        
        def _do_check():
            result = check_for_updates()
            self.after(0, lambda: self._update_result(result))
        
        threading.Thread(target=_do_check, daemon=True).start()

    def _update_result(self, result):
        if result.get("error"):
            self._update_btn.configure(text="🔄  Check for Updates", fg=TEXT_MUTED)
            show_toast(self, "Could not check for updates", 3000, WARNING)
            return
        
        if result["has_update"]:
            self._show_update_dialog(result)
        else:
            self._update_btn.configure(text=f"✓  v{APP_VER} (Up to date)", fg=SUCCESS)
            show_toast(self, f"You're on the latest version (v{APP_VER})", 3000, SUCCESS)
            self.after(3000, lambda: self._update_btn.configure(text="🔄  Check for Updates", fg=TEXT_MUTED))

    def _show_update_dialog(self, result):
        dialog = tk.Toplevel(self)
        dialog.title("Update Available")
        dialog.geometry("450x300")
        dialog.configure(bg="#1a1a26")
        dialog.transient(self)
        dialog.grab_set()
        
        screen_w = self.winfo_screenwidth()
        screen_h = self.winfo_screenheight()
        win_w, win_h = 450, 300
        x = (screen_w - win_w) // 2
        y = (screen_h - win_h) // 2
        dialog.geometry(f"{win_w}x{win_h}+{x}+{y}")
        
        # Header
        header = tk.Frame(dialog, bg="#1a1a26")
        header.pack(fill="x", padx=20, pady=(20,10))
        
        tk.Label(header, text="Update Available!", font=(FN, 16, "bold"),
                bg="#1a1a26", fg=SUCCESS).pack(anchor="w")
        
        # Content
        content = tk.Frame(dialog, bg="#1a1a26")
        content.pack(fill="both", expand=True, padx=20, pady=10)
        
        tk.Label(content, text=f"Current version: v{APP_VER}",
                font=(FN, 11), bg="#1a1a26", fg=TEXT_SECONDARY, anchor="w").pack(anchor="w")
        tk.Label(content, text=f"New version: v{result['latest_version']}",
                font=(FN, 12, "bold"), bg="#1a1a26", fg=ACCENT, anchor="w").pack(anchor="w", pady=(5,10))
        
        has_download = bool(result.get("download_url"))
        
        # Buttons
        buttons = tk.Frame(dialog, bg="#1a1a26")
        buttons.pack(fill="x", padx=20, pady=(10,20))
        
        if has_download:
            download_btn = tk.Label(buttons, text="Download & Install",
                                  font=(FN, 11, "bold"), bg=SUCCESS, fg=WHITE,
                                  cursor="hand2", padx=20, pady=10)
            download_btn.pack(side="left")
            
            def on_download():
                dialog.destroy()
                self._download_and_install(result["download_url"])
            download_btn.bind("<Button-1>", lambda _: on_download())
            download_btn.bind("<Enter>", lambda _: download_btn.configure(bg="#2a8a4a"))
            download_btn.bind("<Leave>", lambda _: download_btn.configure(bg=SUCCESS))
        else:
            tk.Label(buttons, text="Download from GitHub",
                    font=(FN, 10), bg="#2a2a3a", fg=TEXT_SECONDARY,
                    cursor="hand2", padx=20, pady=8).pack(side="left")
        
        later_btn = tk.Label(buttons, text="Later",
                            font=(FN, 10), bg="#2a2a3a", fg=TEXT_SECONDARY,
                            cursor="hand2", padx=20, pady=8)
        later_btn.pack(side="right", padx=(10,0))
        
        def on_later():
            dialog.destroy()
        
        download_btn.bind("<Button-1>", lambda _: on_download())
        later_btn.bind("<Button-1>", lambda _: on_later())
        
        # Hover effects
        download_btn.bind("<Enter>", lambda _: download_btn.configure(bg="#4a9a5a"))
        download_btn.bind("<Leave>", lambda _: download_btn.configure(bg=SUCCESS))
        later_btn.bind("<Enter>", lambda _: later_btn.configure(bg="#3a3a4a"))
        later_btn.bind("<Leave>", lambda _: later_btn.configure(bg="#2a2a3a"))

    def _download_and_install(self, download_url):
        if not download_url:
            show_toast(self, "No download URL available", 3000, WARNING)
            return
        
        # Progress dialog
        progress_win = tk.Toplevel(self)
        progress_win.title("Downloading Update")
        progress_win.geometry("350x150")
        progress_win.configure(bg="#1a1a26")
        progress_win.transient(self)
        progress_win.grab_set()
        
        screen_w = self.winfo_screenwidth()
        screen_h = self.winfo_screenheight()
        win_w, win_h = 350, 150
        x = (screen_w - win_w) // 2
        y = (screen_h - win_h) // 2
        progress_win.geometry(f"{win_w}x{win_h}+{x}+{y}")
        
        header = tk.Frame(progress_win, bg="#1a1a26")
        header.pack(fill="x", padx=20, pady=(15,10))
        tk.Label(header, text="Downloading Update...", font=(FN, 12, "bold"),
                bg="#1a1a26", fg=TEXT_PRIMARY).pack(anchor="w")
        
        self._download_progress = tk.Label(progress_win, text="0%",
                font=(FN, 10), bg="#1a1a26", fg=TEXT_SECONDARY)
        self._download_progress.pack(anchor="w", padx=20, pady=5)
        
        prog_bar = tk.Frame(progress_win, bg="#2a2a3a", height=20)
        prog_bar.pack(fill="x", padx=20, pady=10)
        prog_bar.pack_propagate(False)
        
        self._download_bar = tk.Frame(prog_bar, bg=SUCCESS, height=20, width=0)
        self._download_bar.pack(side="left", fill="both")
        
        self._download_label = tk.Label(progress_win, text="Please wait...",
                font=(FN, 9), bg="#1a1a26", fg=TEXT_MUTED)
        self._download_label.pack(anchor="w", padx=20)
        
        def update_progress(progress):
            self._download_progress.configure(text=f"{progress}%")
            self._download_bar.configure(width=int(3.1 * progress))
        
        def download_complete(path):
            if path:
                self.after(0, lambda: progress_win.destroy())
                self.after(100, lambda: self._install_update(path))
            else:
                self.after(0, lambda: [
                    progress_win.destroy(),
                    show_toast(self, "Download failed", 3000, ERROR)
                ])
        
        def _do_download():
            path = download_update(download_url, callback=update_progress)
            download_complete(path)
        
        threading.Thread(target=_do_download, daemon=True).start()

    def _install_update(self, update_path):
        show_toast(self, "Installing update...", 2000, ACCENT)
        self.update()
        if install_update(update_path):
            self.after(500, self.destroy)
        else:
            show_toast(self, "Update installation failed", 3000, ERROR)

    def _focus_search(self, _=None):
        if hasattr(self, '_se'):
            self._se.focus_set()
            if self._ph:
                self._se.delete(0, "end")
                self._se.configure(fg="#e2e8f0")
                self._ph = False
            self._se.icursor("end")

    def _build_ui(self):
        # Modern Sidebar with gradient accent
        sb = tk.Frame(self, bg="#0a0a10", width=230)
        sb.pack(side="left", fill="y")
        sb.pack_propagate(False)
        self._sb = sb
        
        # Sidebar top accent line
        accent_line = tk.Frame(sb, bg=PRIMARY_PURPLE, height=2)
        accent_line.pack(fill="x")
        
        # Logo section with glow effect
        logo_f = tk.Frame(sb, bg="#0a0a10")
        logo_f.pack(fill="x", padx=16, pady=(20,16))
        
        # Load logo with error handling
        self._logo_img = None
        logo_path = _find_file("AHG_logo.png")
        try:
            if isinstance(logo_path, tuple) and logo_path[0] == "__embedded__":
                img_data = _read_embedded_file(logo_path[1])
                if img_data:
                    import io
                    img = Image.open(io.BytesIO(img_data)).convert("RGBA").resize((42,42), Image.LANCZOS)
                    self._logo_img = ImageTk.PhotoImage(img)
                    logo_lbl = tk.Label(logo_f, image=self._logo_img, bg="#0a0a10")
                    logo_lbl.pack(side="left")
            elif os.path.exists(logo_path) and PIL_OK:
                img = Image.open(logo_path).convert("RGBA").resize((42,42), Image.LANCZOS)
                self._logo_img = ImageTk.PhotoImage(img)
                logo_lbl = tk.Label(logo_f, image=self._logo_img, bg="#0a0a10")
                logo_lbl.pack(side="left")
        except Exception:
            self._logo_img = None
        
        if not self._logo_img:
            logo_lbl = tk.Label(logo_f, text="◈", font=(FN,28,"bold"), 
                                bg="#0a0a10", fg=PRIMARY_PURPLE)
            logo_lbl.pack(side="left")
        
        # App name with gradient-like effect
        name_f = tk.Frame(logo_f, bg="#0a0a10")
        name_f.pack(side="left", padx=(12,0))
        
        # Title with accent color
        title_lbl = tk.Label(name_f, text="AHG Unlocker", 
                           font=(FN,13,"bold"),
                           bg="#0a0a10", fg=TEXT_PRIMARY, anchor="w")
        title_lbl.pack(anchor="w")
        
        # Version with muted color
        tk.Label(name_f, text=f"v{APP_VER}", font=(FN,9),
                bg="#0a0a10", fg=TEXT_MUTED, anchor="w").pack(anchor="w")
        
        # Separator
        sep = tk.Frame(sb, bg="#1a1a25", height=1)
        sep.pack(fill="x", padx=16, pady=(8,16))

        # Navigation with colorized modern styling
        self._nav = {}
        # Each button has its own color: (id, label, icon, color)
        nav_items = [
            ("home", "Home", "🏠", "#6366f1"),        # Indigo
            ("favourites", "Favourites", "⭐", "#fbbf24"), # Gold
            ("recent", "Recent", "🕐", "#ec4899"),     # Pink
            ("collections", "Collections", "📁", "#14b8a6"), # Teal
            ("library", "Library", "📚", "#22c55e"),   # Green
            ("fixes", "Online Fixes", "⚡", "#f59e0b"),  # Amber
            ("settings", "Settings", "⚙", "#3b82f6"), # Blue
        ]
        
        for pid, label, icon, color in nav_items:
            # Nav item container - premium modern styling
            f = tk.Frame(sb, bg="#0d0d18", cursor="hand2", height=46)
            f.pack(fill="x", padx=6, pady=2)
            f.pack_propagate(False)
            
            # Active indicator bar (accent color when active)
            bar = tk.Frame(f, bg="#0d0d18", width=4)
            bar.pack(side="left", fill="y")
            bar.pack_propagate(False)
            
            # Icon with premium styling - larger, cleaner
            icon_l = tk.Label(f, text=icon, font=(FN,16), 
                            bg="#0d0d18", fg="#5a5a70", width=3, pady=12)
            icon_l.pack(side="left", padx=(12,10))
            
            # Label with premium styling
            lbl = tk.Label(f, text=label, font=(FN,11,"bold"),
                         bg="#0d0d18", fg="#707080", anchor="w")
            lbl.pack(side="left", fill="x", expand=True, padx=(4,12))
            
            self._nav[pid] = (f, bar, icon_l, lbl, color)  # Store color too
            
            # Bind events with enhanced hover - more visible feedback
            for w in (f, icon_l, lbl):
                w.bind("<Button-1>", lambda e, p=pid: self._show(p))
                w.bind("<Enter>", lambda e, p=pid: self._nav_hover(p, True))
                w.bind("<Leave>", lambda e, p=pid: self._nav_hover(p, False))
        
        # Recently Viewed Section
        self._recent_section = tk.Frame(sb, bg="#0a0a10")
        self._recent_section.pack(fill="x", padx=8, pady=(10,5))
        
        self._recent_lbl = tk.Label(self._recent_section, text="Recently Viewed", 
                                    font=(FN,8,"bold"), bg="#0a0a10", fg=TEXT_MUTED)
        self._recent_lbl.pack(anchor="w", padx=8, pady=(5,3))
        
        self._recent_list = tk.Frame(sb, bg="#0a0a10")
        self._recent_list.pack(fill="x", padx=8)
        
        self._recent_items = []
        for i in range(3):
            item = tk.Frame(self._recent_list, bg="#0a0a10", height=22)
            item.pack(fill="x", pady=1)
            item.pack_propagate(False)
            
            name_lbl = tk.Label(item, text="", font=(FN,8), 
                           bg="#0a0a10", fg=TEXT_SECONDARY, anchor="w",
                           cursor="hand2")
            name_lbl.pack(side="left", fill="both", expand=True)
            
            install_btn = tk.Frame(item, bg="#1a1a28", cursor="hand2", width=22, height=20)
            install_btn.pack(side="right", padx=(2,0), pady=1)
            install_btn.pack_propagate(False)
            
            install_lbl = tk.Label(install_btn, text="+", font=(FN,11,"bold"),
                                 bg="#1a1a28", fg=ACCENT)
            install_lbl.pack(fill="both", expand=True)
            
            self._recent_items.append((name_lbl, install_btn, install_lbl, item))
        
        # Spacer
        tk.Frame(sb, bg="#0a0a10").pack(fill="both", expand=True)
        
        # Bottom area - status, info and update button
        status_f = tk.Frame(sb, bg="#0d0d14", padx=16, pady=10)
        status_f.pack(fill="x", side="bottom")
        
        # Check for Updates button - enhanced look
        update_frame = tk.Frame(status_f, bg="#1a1a26", padx=12, pady=6)
        update_frame.pack(fill="x", pady=(0,8))
        
        self._update_btn = tk.Label(update_frame, text="🔄  Check for Updates", font=(FN, 9, "bold"),
                                   bg="#1a1a26", fg=TEXT_SECONDARY, cursor="hand2")
        self._update_btn.pack(fill="x", anchor="center")
        self._update_btn.bind("<Button-1>", lambda _: self._check_for_updates())
        self._update_btn.bind("<Enter>", lambda _: self._update_btn.configure(fg=ACCENT, bg="#252533"))
        self._update_btn.bind("<Leave>", lambda _: self._update_btn.configure(fg=TEXT_SECONDARY, bg="#1a1a26"))
        
        # Main content area
        main = tk.Frame(self, bg=BG_MAIN)
        main.pack(side="left", fill="both", expand=True)
        self._main = main
        
        # Top bar with search
        top = tk.Frame(main, bg="#0d0d14", height=64)
        top.pack(fill="x")
        top.pack_propagate(False)
        
        tin = tk.Frame(top, bg="#0d0d14")
        tin.pack(fill="both", expand=True, padx=20, pady=12)
        
        # Modern search bar with autocomplete
        search_container = tk.Frame(tin, bg="#0d0d14")
        search_container.pack(side="left", fill="both", expand=True, padx=(0,16))
        
        search_wrap = tk.Frame(search_container, bg=SURFACE,
                             highlightthickness=1, highlightcolor=PRIMARY_PURPLE)
        search_wrap.pack(fill="x")
        
        # Search icon
        tk.Label(search_wrap, text="🔍", font=(FN,11), bg=SURFACE, 
                fg=TEXT_MUTED).pack(side="left", padx=(14,6))
        
        self._qvar = tk.StringVar()
        self._se = tk.Entry(search_wrap, textvariable=self._qvar,
                           font=(FN,11), bg=SURFACE, fg=TEXT_PRIMARY,
                           insertbackground=TEXT_PRIMARY,
                           relief="flat", bd=0, highlightthickness=0)
        self._se.pack(side="left", fill="both", expand=True, pady=10, padx=(0,6))
        
        self._ph = True
        self._se.insert(0, "Search games or type App ID...")
        self._se.configure(fg=TEXT_MUTED)
        self._se.bind("<FocusIn>", self._sf_in)
        self._se.bind("<FocusOut>", self._sf_out)
        self._se.bind("<Return>", lambda _: self._do_instant_search())
        self._se.bind("<Down>", self._autocomplete_down)
        self._se.bind("<Up>", self._autocomplete_up)
        self._qvar.trace_add("write", self._on_query_change)
        
        self._clear_btn = tk.Label(search_wrap, text="✕", font=(FN,10), bg="#1a1a2e", fg="#64748b", cursor="hand2")
        self._clear_btn.pack(side="left", padx=(0,8))
        self._clear_btn.bind("<Button-1>", lambda _: self._clear_search())
        self._clear_btn.bind("<Enter>", lambda _: self._clear_btn.configure(fg=OFFWHITE))
        self._clear_btn.bind("<Leave>", lambda _: self._clear_btn.configure(fg="#64748b" if self._ph else OFFWHITE))
        self._clear_btn.lower()
        
        # Autocomplete dropdown
        self._autocomplete_win = None
        self._autocomplete_items = []
        self._autocomplete_selected = -1
        
        RoundedBtn(tin, "Search", self._trigger_search,
                bg=ACCENT, fg=WHITE, fs=9, pady=6, padx=16).pack(side="left")
        
        # View mode toggle (list/grid) - improved design
        self._view_mode = tk.StringVar(value=load_cfg().get("view_mode", "grid"))
        view_btn = tk.Frame(tin, bg="#2a2a3a", cursor="hand2", width=40, height=28, takefocus=True)
        view_btn.pack(side="left", padx=6, pady=6)
        view_btn.pack_propagate(False)
        
        view_icon = tk.Label(view_btn, text="☰" if self._view_mode.get() == "grid" else "▦", 
                           font=("Segoe UI", 14), bg="#2a2a3a", fg=ACCENT, cursor="hand2")
        view_icon.pack(expand=True)
        
        def toggle_view(e=None):
            self._toggle_view_mode()
        
        view_btn.bind("<Button-1>", toggle_view)
        view_icon.bind("<Button-1>", toggle_view)
        view_btn.bind("<Enter>", lambda _: (view_btn.configure(bg=ACCENT), view_icon.configure(fg=WHITE)))
        view_btn.bind("<Leave>", lambda _: (view_btn.configure(bg="#2a2a3a"), view_icon.configure(fg=ACCENT)))
        view_icon.bind("<Enter>", lambda _: (view_btn.configure(bg=ACCENT), view_icon.configure(fg=WHITE)))
        view_icon.bind("<Leave>", lambda _: (view_btn.configure(bg="#2a2a3a"), view_icon.configure(fg=ACCENT)))
        self._view_btn = view_btn
        
        # Theme toggle (dark/light) - improved design
        theme_btn = tk.Frame(tin, bg="#2a2a3a", cursor="hand2", width=40, height=28, takefocus=True)
        theme_btn.pack(side="left", padx=6, pady=6)
        theme_btn.pack_propagate(False)
        
        theme_icon = tk.Label(theme_btn, text="☀️" if self._cfg.get("theme", "dark") == "light" else "🌙", 
                            font=("Segoe UI", 12), bg="#2a2a3a", fg="#fbbf24", cursor="hand2")
        theme_icon.pack(expand=True)
        
        def toggle_theme(e=None):
            self._toggle_theme()
        
        theme_btn.bind("<Button-1>", toggle_theme)
        theme_icon.bind("<Button-1>", toggle_theme)
        theme_btn.bind("<Enter>", lambda _: (theme_btn.configure(bg=ACCENT), theme_icon.configure(fg=WHITE)))
        theme_btn.bind("<Leave>", lambda _: (theme_btn.configure(bg="#2a2a3a"), theme_icon.configure(fg="#fbbf24")))
        theme_icon.bind("<Enter>", lambda _: (theme_btn.configure(bg=ACCENT), theme_icon.configure(fg=WHITE)))
        theme_icon.bind("<Leave>", lambda _: (theme_btn.configure(bg="#2a2a3a"), theme_icon.configure(fg="#fbbf24")))
        self._theme_btn = theme_btn
        
        # Tooltip labels
        tk.Label(tin, text="View", font=(FN,8), fg=TEXT_MUTED, bg="#1a1a2e").place(in_=view_btn, x=0, rely=1.15, anchor="nw")
        tk.Label(tin, text="Theme", font=(FN,8), fg=TEXT_MUTED, bg="#1a1a2e").place(in_=theme_btn, x=0, rely=1.15, anchor="nw")
        
        tk.Frame(tin, bg=SIDEBAR, width=15).pack(side="left")
        RoundedBtn(tin, "↺  Restart Steam",
                lambda: threading.Thread(target=restart_steam,
                    args=(self._cfg, lambda m,t="info":
                          self.after(0,lambda:self._cur_log(m,t))),
                    daemon=True).start(),
                bg=MUTED, fg=OFFWHITE, fs=9, pady=6, padx=12).pack(side="right")

        self._parea = tk.Frame(main, bg=BG)
        self._parea.pack(fill="both", expand=True)
        self._pages = {}
        self._build_home()
        self._build_favourites()
        self._build_recent()
        self._build_collections()
        self._build_library()
        self._build_fixes()
        self._build_settings()

    def _show(self, pid):
        # Smooth transition between pages
        if hasattr(self, '_page') and self._page != pid:
            self._fade_transition(pid)
        else:
            self._show_page(pid)
    
    def _fade_transition(self, target_pid):
        """Animate transition between pages"""
        current_page = self._pages.get(self._page)
        target_page = self._pages.get(target_pid)
        
        if not current_page or not target_page:
            self._show_page(target_pid)
            return
        
        # Quick fade using canvas overlay (works with Frames)
        canvas = tk.Canvas(self._parea, bg=BG_MAIN, highlightthickness=0)
        canvas.pack(fill="both", expand=True)
        
        # Fade to overlay color
        steps = 5
        for i in range(steps + 1):
            alpha = i / steps
            color = f"#{int(26 * alpha):02x}{int(26 * alpha):02x}{int(38 * alpha):02x}"
            canvas.configure(bg=color)
            self.update()
            self.after(15)
        
        # Switch pages
        current_page.pack_forget()
        target_page.pack(fill="both", expand=True)
        self._update_nav(target_pid)
        self.set_active_scroll(self._get_scroll_for_page(target_pid))
        
        # Fade back to normal
        for i in range(steps, -1, -1):
            alpha = i / steps
            color = f"#{int(26 * alpha):02x}{int(26 * alpha):02x}{int(38 * alpha):02x}"
            canvas.configure(bg=color)
            self.update()
            self.after(15)
        
        canvas.destroy()
        
        # Update state and load data
        self._page = target_pid
        if target_pid == "fixes" and not self._fixes_ok:
            self._load_fixes()
        if target_pid == "favourites":
            self._load_favourites()
    
    def _show_page(self, pid):
        """Show page without animation"""
        for p in self._pages.values(): 
            if p.winfo_manager(): p.pack_forget()
        self._pages[pid].pack(fill="both", expand=True)
        self._page = pid
        self._update_nav(pid)
        scroll_map = {"home": getattr(self, '_hsf', None), "favourites": getattr(self, '_fvsf', None),
                      "library": getattr(self, '_lsf', None), 
                      "fixes": getattr(self, '_fsf', None), "settings": getattr(self, '_ssf', None),
                      "recent": getattr(self, '_recent_sf', None), 
                      "collections": getattr(self, '_collections_sf', None)}
        self.set_active_scroll(scroll_map.get(pid))
        
        # Load data for each page
        if pid == "fixes" and not self._fixes_ok:
            self._load_fixes()
        if pid == "favourites":
            self._load_favourites()
        if pid == "recent":
            self._load_recent()
        if pid == "collections":
            self._load_collections()
    
    def _update_nav(self, pid):
        """Update navigation bar highlight"""
        for k, (f, bar, icon, lbl) in self._nav.items():
            active = k == pid
            if active:
                f.configure(bg="#0a0a10")
                bar.configure(bg=ACCENT)  # Purple accent for active
                icon.configure(fg=ACCENT)
                lbl.configure(fg=WHITE)
            else:
                f.configure(bg="#0a0a10")
                bar.configure(bg="#0a0a10")
                icon.configure(fg=TEXT_MUTED)
                lbl.configure(fg=TEXT_MUTED)
    
    def _get_scroll_for_page(self, pid):
        """Get scroll frame for a page"""
        scroll_map = {"home": self._hsf, "favourites": self._fvsf,
                      "library": self._lsf, "fixes": self._fsf, "settings": self._ssf}
        return scroll_map.get(pid)

    def _nav_hover(self, pid, enter):
        f, bar, icon, lbl, color = self._nav[pid]
        if enter:
            f.configure(bg="#1a1a2a")
            bar.configure(bg=color)
            icon.configure(fg=color)
            lbl.configure(fg="#ffffff")
        else:
            f.configure(bg="#0d0d18")
            bar.configure(bg="#0d0d18")
            icon.configure(fg="#5a5a70")
            lbl.configure(fg="#707080")

    def _update_nav(self, pid):
        for k, (f, bar, icon, lbl, color) in self._nav.items():
            active = k == pid
            if active:
                f.configure(bg="#0d0d18")
                bar.configure(bg=color)
                icon.configure(fg=color)
                lbl.configure(fg="#ffffff")
            else:
                f.configure(bg="#0d0d18")
                bar.configure(bg="#0d0d18")
                icon.configure(fg="#5a5a70")
                lbl.configure(fg="#707080")
    
    def _cur_log(self, msg, tag="info"):
        m={"home":"_hlog","library":"_llog","fixes":"_flog","settings":"_slog"}
        attr=m.get(self._page)
        if attr and hasattr(self,attr): getattr(self,attr).log(msg,tag)

    def _build_home(self):
        f = tk.Frame(self._parea, bg=BG)
        self._pages["home"] = f

        hdr = tk.Frame(f, bg=BG)
        hdr.pack(fill="x", padx=22, pady=(16,5))
        self._htitle = tk.Label(hdr, text="Featured Games",
                                font=(FN,20,"bold"), fg=WHITE, bg=BG)
        self._htitle.pack(side="left")
        self._hsub = tk.Label(hdr, text="", font=(FN,10), fg=SUB, bg=BG)
        self._hsub.pack(side="left", padx=10)

        ctrl = tk.Frame(hdr, bg=BG)
        ctrl.pack(side="right")

        # Filter bar with genre tabs and sort
        filter_bar = tk.Frame(f, bg="#12121f", height=40)
        filter_bar.pack(fill="x", padx=14, pady=(0,8))
        filter_bar.pack_propagate(False)
        
        filter_inner = tk.Frame(filter_bar, bg="#12121f")
        filter_inner.pack(side="left", fill="both", expand=True, padx=10, pady=4)
        
        # Sort dropdown - simple working buttons
        sort_frame = tk.Frame(filter_bar, bg="#12121f")
        sort_frame.pack(side="right", padx=(10,0), pady=4)
        
        self._sort_var = tk.StringVar(value="popularity")
        
# Sort dropdown - single expandable button
        sort_btn = tk.Frame(sort_frame, bg="#1e1e2e", cursor="hand2", padx=10, pady=4)
        sort_btn.pack(side="left")
        
        self._sort_lbl = tk.Label(sort_btn, text="★ Popularity ▾", font=(FN, 9, "bold"), 
                           bg="#1e1e2e", fg=ACCENT, cursor="hand2")
        self._sort_lbl.pack(side="left")
        
        def toggle_sort_menu(event=None):
            menu = tk.Menu(sort_btn, tearoff=0, bg="#1a1a28", fg="white", bd=1, relief="raised")
            for opt, label in [("popularity", "★ Popularity"), ("A-Z", "A to Z"), ("Z-A", "Z to A")]:
                menu.add_command(label=label, command=lambda o=opt, l=label: do_sort(o, l))
            
            # Position menu below button
            x = sort_btn.winfo_rootx()
            y = sort_btn.winfo_rooty() + sort_btn.winfo_height()
            menu.post(x, y)
        
        def do_sort(opt, label):
            self._sort_var.set(opt)
            self._sort_lbl.configure(text=label.replace(" to ", "-") + " ▾")
            self._on_sort_change(opt)
        
        sort_btn.bind("<Button-1>", toggle_sort_menu)
        self._sort_lbl.bind("<Button-1>", toggle_sort_menu)
        
        tk.Label(sort_frame, text="Sort:", font=(FN,9), bg="#12121f", fg="#6b6b80").pack(side="right", padx=(0,8))
        
        genres = ["All", "Action", "Adventure", "RPG", "Strategy", "Simulation", 
                  "Sports", "Racing", "Puzzle", "Horror", "Casual", "Indie", "Multiplayer", "DRM", "No DRM"]
        
        self._genre_filters = {}
        self._current_genre = tk.StringVar(value="All")
        
        def make_genre_btn(genre):
            def select():
                self._current_genre.set(genre)
                for g, btn in self._genre_filters.items():
                    if g == genre:
                        btn.configure(bg=ACCENT, fg=WHITE)
                    else:
                        btn.configure(bg="#2a2a3a", fg="#a0a0b0")
                self._filter_by_genre(genre)
            return select
        
        for genre in genres:
            btn = tk.Label(filter_inner, text=genre, font=(FN,9), 
                          bg="#2a2a3a", fg="#a0a0b0", cursor="hand2", padx=12, pady=4)
            btn.pack(side="left", padx=3)
            btn.bind("<Button-1>", lambda e, g=genre: make_genre_btn(g)())
            btn.bind("<Enter>", lambda e, b=btn: b.configure(bg="#3a3a4a", fg="white"))
            btn.bind("<Leave>", lambda e, g=genre, b=btn: b.configure(bg="#2a2a3a", fg="#a0a0b0"))
            self._genre_filters[genre] = btn
        
        self._genre_filters["All"].configure(bg=ACCENT, fg=WHITE)

        self._ibtn = RoundedBtn(ctrl, "⬇  Add to Steam", self._do_install,
                              bg=ACCENT, fg=WHITE, fs=10, pady=6, padx=18)
        self._ibtn.pack(side="left")

        tk.Frame(ctrl, bg=BG, width=20).pack(side="left")

        self._dlc_toggle = ToggleSwitch(ctrl, self._dlc, label="Include DLCs", bg=BG)
        self._dlc_toggle.pack(side="left")

        tk.Frame(ctrl, bg=BG, width=15).pack(side="left")

        self._random_btn = RoundedBtn(ctrl, "🎲  Random", self._random_game,
                                      bg="#6366f1", fg=WHITE, fs=9, pady=5, padx=12)
        self._random_btn.pack(side="left")

        tk.Frame(ctrl, bg=BG, width=15).pack(side="left")

        self._batch_count_lbl = tk.Label(ctrl, text="", font=(FN,9), bg=BG, fg=ACCENT)
        self._batch_count_lbl.pack(side="left", padx=(5,0))

        tk.Frame(ctrl, bg=BG, width=15).pack(side="left")

        self._back_btn = RoundedBtn(hdr, "← Featured", self._show_featured,
                                  bg=MUTED, fg=ACCENT, fs=9, pady=5, padx=12)

        self._strip = tk.Frame(f, bg=PANEL2)
        self._strip.pack(fill="x", padx=22, pady=(0,8))
        self._strip_lbl = tk.Label(
            self._strip,
            text="  No game selected — search above or click a card",
            font=(FN,9), fg=SUB, bg=PANEL2, pady=7, anchor="w")
        self._strip_lbl.pack(side="left")

        self._hsf = ScrollFrame(f)
        self._hsf.pack(fill="both", expand=True, padx=14)
        self._rgrid = ResponsiveGrid(self._hsf.inner, self._card_click)
        self._rgrid.pack(fill="both", expand=True)
        self._hsf.add_wheel(self._rgrid)

        self._hpager = PaginationBar(f, self._home_go_page)
        self._hpager.pack(fill="x", padx=14, pady=6)

        self._hlog = LogBox(f, height=6)
        self._hlog.pack(fill="x")

    def _home_go_page(self, page):
        self._rgrid.go_page(page)
        self._hsf.scroll_top()
        self._hpager.set_total(self._rgrid.get_page_count(), page)

    def _build_favourites(self):
        f = tk.Frame(self._parea, bg=BG)
        self._pages["favourites"] = f

        hdr = tk.Frame(f, bg=BG)
        hdr.pack(fill="x", padx=22, pady=(16,5))
        self._fvtitle = tk.Label(hdr, text="Favourites",
                                font=(FN,20,"bold"), fg=WHITE, bg=BG)
        self._fvtitle.pack(side="left")
        self._fvsub = tk.Label(hdr, text="", font=(FN,10), fg=SUB, bg=BG)
        self._fvsub.pack(side="left", padx=10)

        self._fvsf = ScrollFrame(f)
        self._fvsf.pack(fill="both", expand=True, padx=14)
        self._fgrid = ResponsiveGrid(self._fvsf.inner, self._card_click)
        self._fgrid.pack(fill="both", expand=True)
        self._fvsf.add_wheel(self._fgrid)

        self._fvpager = PaginationBar(f, self._favs_go_page)
        self._fvpager.pack(fill="x", padx=14, pady=6)

    def _favs_go_page(self, page):
        self._fgrid.go_page(page)
        self._fvsf.scroll_top()
        self._fvpager.set_total(self._fgrid.get_page_count(), page)

    def _load_favourites(self):
        global _FAVORITES
        items = []
        for aid, name in FEATURED:
            if aid in _FAVORITES:
                items.append((aid, name))
        count = len(items)
        self._fvsub.configure(text=f"{count} saved games")
        self._fgrid.set_items(items, page=1)
        self._fvpager.set_total(max(1, (count + 49) // 50), 1)
        self._fvsf.scroll_top()

    def _build_recent(self):
        """Build recently played games page"""
        f = tk.Frame(self._parea, bg=BG)
        self._pages["recent"] = f
        
        hdr = tk.Frame(f, bg=BG)
        hdr.pack(fill="x", padx=22, pady=(16,5))
        tk.Label(hdr, text="Recently Played", font=(FN,20,"bold"), fg=WHITE, bg=BG).pack(side="left")
        
        self._recent_sub = tk.Label(hdr, text="", font=(FN,10), fg=SUB, bg=BG)
        self._recent_sub.pack(side="left", padx=10)
        
        self._recent_sf = ScrollFrame(f)
        self._recent_sf.pack(fill="both", expand=True, padx=14)
        self._recent_grid = ResponsiveGrid(self._recent_sf.inner, self._card_click)
        self._recent_grid.pack(fill="both", expand=True)
        self._recent_sf.add_wheel(self._recent_grid)
    
    def _load_recent(self):
        """Load recently played games"""
        recent_ids = get_recently_played()
        items = []
        for aid in recent_ids:
            name = _ALL_GAMES_DATA.get(aid, {}).get("name", "")
            if name:
                items.append((aid, name))
        
        count = len(items)
        self._recent_sub.configure(text=f"{count} recent games")
        self._recent_grid.set_items(items, page=1)
        self._recent_sf.scroll_top()
    
    def _build_collections(self):
        """Build collections page"""
        f = tk.Frame(self._parea, bg=BG)
        self._pages["collections"] = f
        
        hdr = tk.Frame(f, bg=BG)
        hdr.pack(fill="x", padx=22, pady=(16,5))
        tk.Label(hdr, text="Collections", font=(FN,20,"bold"), fg=WHITE, bg=BG).pack(side="left")
        
        # Add new collection button
        RoundedBtn(hdr, "+ New Collection", self._create_collection,
                  bg=ACCENT, fg=WHITE, fs=9, pady=5, padx=12).pack(side="right")
        
        self._collections_sf = ScrollFrame(f)
        self._collections_sf.pack(fill="both", expand=True, padx=14)
        
        # Container for collection cards
        self._collections_container = tk.Frame(self._collections_sf.inner, bg=BG)
        self._collections_container.pack(fill="both", expand=True)
    
    def _load_collections(self):
        """Load and display collections"""
        for widget in self._collections_container.winfo_children():
            widget.destroy()
        
        collections = get_collections()
        
        if not collections:
            tk.Label(self._collections_container, text="No collections yet. Create one!",
                    font=(FN,12), fg=SUB, bg=BG).pack(pady=50)
            return
        
        for name, games in collections.items():
            self._add_collection_card(name, games)
    
    def _add_collection_card(self, name, games):
        """Add a collection card"""
        card = tk.Frame(self._collections_container, bg=BG_CARD, cursor="hand2")
        card.pack(fill="x", pady=5, padx=5)
        
        # Collection info
        info = tk.Frame(card, bg=BG_CARD)
        info.pack(fill="x", padx=15, pady=12)
        
        tk.Label(info, text="📁", font=(FN,20), bg=BG_CARD).pack(side="left")
        
        text_frame = tk.Frame(card, bg=BG_CARD)
        text_frame.pack(side="left", fill="x", expand=True, padx=10)
        
        tk.Label(text_frame, text=name, font=(FN,12,"bold"), 
                fg=WHITE, bg=BG_CARD).pack(anchor="w")
        tk.Label(text_frame, text=f"{len(games)} games", font=(FN,10), 
                fg=SUB, bg=BG_CARD).pack(anchor="w")
        
        # Delete button
        del_btn = tk.Label(info, text="🗑️", font=(FN,12), bg=BG_CARD, cursor="hand2")
        del_btn.pack(side="right")
        del_btn.bind("<Button-1>", lambda e, n=name: self._delete_collection(n))
        
        # Click to view
        for w in [card, info, text_frame]:
            w.bind("<Button-1>", lambda e, n=name, g=games: self._view_collection(n, g))
            w.bind("<Enter>", lambda e, c=card: c.configure(bg=BG_HOVER))
            w.bind("<Leave>", lambda e, c=card: c.configure(bg=BG_CARD))
    
    def _create_collection(self):
        """Create a new collection"""
        # Simple dialog to get collection name
        top = tk.Toplevel(self._root)
        top.title("New Collection")
        top.geometry("300x120")
        top.configure(bg=BG_MAIN)
        
        tk.Label(top, text="Collection Name:", font=(FN,11), 
                fg=WHITE, bg=BG_MAIN).pack(pady=10)
        
        name_var = tk.StringVar()
        entry = tk.Entry(top, textvariable=name_var, font=(FN,11), 
                       bg=BG_CARD, fg=WHITE)
        entry.pack(pady=5, padx=20, fill="x")
        
        def save():
            name = name_var.get().strip()
            if name:
                save_collection(name, [])
                top.destroy()
                self._load_collections()
                self._slog.log(f"Created collection: {name}", "ok")
        
        tk.Button(top, text="Create", command=save, bg=ACCENT, fg=WHITE).pack(pady=10)
    
    def _delete_collection(self, name):
        """Delete a collection"""
        delete_collection(name)
        self._load_collections()
        self._slog.log(f"Deleted collection: {name}", "info")
    
    def _view_collection(self, name, games):
        """View games in a collection"""
        # Could implement a detail view
        self._slog.log(f"Viewing collection: {name} ({len(games)} games)", "info")

    def _load_featured(self):
        sort_by = self._sort_var.get()
        items = [(a,n) for a,n in FEATURED]
        
        if sort_by == "A-Z":
            items = sorted(items, key=lambda x: x[1].lower())
        elif sort_by == "Z-A":
            items = sorted(items, key=lambda x: x[1].lower(), reverse=True)
        # "popularity" keeps original order
        
        total = len(items)
        self._htitle.configure(text="All Games")
        self._hsub.configure(text=f"{total:,} titles · {self._rgrid.get_page_count()} pages")
        self._rgrid.set_items(items, page=1)
        self._hpager.set_total(self._rgrid.get_page_count(), 1)
        self._hsf.scroll_top()

    def _on_sort_change(self, value):
        if hasattr(self, '_rgrid') and hasattr(self, '_sort_var'):
            # Re-apply the current genre filter with new sort order
            current_genre = self._current_genre.get() if hasattr(self, '_current_genre') else "All"
            self._filter_by_genre(current_genre)

    def _show_featured(self):
        self._ph = True
        self._is_searching = False
        try: self._back_btn.pack_forget()
        except Exception:
            logging.debug("Failed to hide back button in show_featured", exc_info=True)
        self._se.configure(state="normal")
        self._se.delete(0,"end")
        self._se.insert(0,"Search games or type App ID...")
        self._se.configure(fg="#64748b")
        self._se.configure(state="normal")
        self._qvar.set("")
        self._clear_btn.configure(fg="#64748b")
        self._load_featured()

    def _card_click(self, appid, name):
        # Check if in batch mode
        if self._batch_mode:
            self._add_to_batch(appid, name)
            return
        
        self._sel_appid = appid
        self._sel_name  = name
        short = (name[:44]+"…") if len(name)>46 else name
        self._strip_lbl.configure(
            text=f"  ✓  {short}  ·  App ID {appid}  ·  Click Install",
            fg=GREEN)
        
        # Track recently viewed
        global _RECENTLY_VIEWED
        for existing in _RECENTLY_VIEWED:
            if existing[0] == appid:
                _RECENTLY_VIEWED.remove(existing)
                break
        _RECENTLY_VIEWED.insert(0, (appid, name))
        if len(_RECENTLY_VIEWED) > 5:
            _RECENTLY_VIEWED = _RECENTLY_VIEWED[:5]
        self._update_recently_viewed()

    def _random_game(self):
        import random
        if FEATURED:
            appid, name = random.choice(FEATURED)
            self._card_click(appid, name)

    def _filter_by_genre(self, genre):
        # Get sort preference
        sort_by = self._sort_var.get() if hasattr(self, '_sort_var') and self._sort_var.get() else "popularity"
        
        # Create popularity map from POPULAR_GAMES (not FEATURED!)
        pop_order = {aid: idx for idx, aid in enumerate(POPULAR_GAMES)}
        
        if genre == "All":
            self._htitle.configure(text="All Games")
            self._hsub.configure(text=f"{len(FEATURED):,} titles · {self._rgrid.get_page_count()} pages")
            items = [(a,n) for a,n in FEATURED]
            
            # Apply sorting
            if sort_by == "A-Z":
                items = sorted(items, key=lambda x: x[1].lower())
            elif sort_by == "Z-A":
                items = sorted(items, key=lambda x: x[1].lower(), reverse=True)
            elif sort_by == "popularity":
                pass  # Already in FEATURED order (popularity)
            
            self._rgrid.set_items(items, page=1)
            self._hpager.set_total(self._rgrid.get_page_count(), 1)
        elif genre in ["DRM", "No DRM"]:
            # Special filter for DRM status
            show_drm = (genre == "DRM")
            self._htitle.configure(text=f"{genre} Games")
            
            # Filter by DRM status using _ALL_GAMES_DATA
            genre_items = []
            for aid, name in FEATURED:
                game_data = _ALL_GAMES_DATA.get(aid, {})
                has_drm = game_data.get("drm", False)
                if show_drm and has_drm:
                    genre_items.append((aid, name))
                elif not show_drm and not has_drm:
                    genre_items.append((aid, name))
            
            # Apply sorting
            if sort_by == "A-Z":
                genre_items = sorted(genre_items, key=lambda x: x[1].lower())
            elif sort_by == "Z-A":
                genre_items = sorted(genre_items, key=lambda x: x[1].lower(), reverse=True)
            elif sort_by == "popularity":
                genre_items = sorted(genre_items, key=lambda x: pop_order.get(x[0], 999999))
            
            self._hsub.configure(text=f"{len(genre_items):,} titles")
            self._rgrid.set_items(genre_items, page=1)
            self._hpager.set_total(max(1, (len(genre_items) + 49) // 50), 1)
        else:
            self._htitle.configure(text=f"{genre} Games")
            
            keywords = GENRE_KEYWORDS.get(genre, [])
            pop_set = set(POPULAR_GAMES)
            pop_order_map = {aid: idx for idx, aid in enumerate(POPULAR_GAMES)}
            
            genre_items = []
            for aid, data in _ALL_GAMES_DATA.items():
                name = data.get("name", "")
                if any(kw in name.lower() for kw in keywords):
                    if aid in pop_order_map:
                        pop_idx = pop_order_map[aid]
                    else:
                        pop_idx = 100000 + int(aid)
                    genre_items.append((aid, name, pop_idx))
            
            genre_items.sort(key=lambda x: x[2])
            genre_items = [(x[0], x[1]) for x in genre_items]
            
            self._hsub.configure(text=f"{len(genre_items):,} titles")
            self._rgrid.set_items(genre_items, page=1)
            self._hpager.set_total(max(1, (len(genre_items) + 49) // 50), 1)
        self._hsf.scroll_top()

    def _clear_image_cache(self):
        global _img_cache
        with _img_lock:
            count = len(_img_cache)
            _img_cache.clear()
        if hasattr(self, '_slog'):
            self._slog.log(f"Cleared {count} cached images", "info")
        else:
            self._hlog.log(f"Cleared {count} cached images", "info")

    def _toggle_batch_mode(self):
        self._batch_mode = not self._batch_mode
        if self._batch_mode:
            self._batch_btn.configure(bg=ACCENT, fg=WHITE)
            self._selected_batch.clear()
            self._strip_lbl.configure(text="  📦 BATCH MODE - Click cards to select. Press Install when done.", fg="#fbbf24")
            self._hlog.log("Batch mode enabled. Click cards to add to batch.", "info")
            # Update all cards to show batch mode is active with darker background
            for c in self._rgrid._cards:
                c._inner.configure(bg="#151510")
        else:
            self._batch_btn.configure(bg=MUTED, fg=WHITE)
            self._strip_lbl.configure(text="  No game selected — search above or click a card", fg=SUB)
            self._hlog.log(f"Batch mode disabled. {len(self._selected_batch)} games removed.", "info")
            # Reset card backgrounds
            for c in self._rgrid._cards:
                c._selected = False
                c._inner.configure(bg=CARD_BG)
                c.configure(bg="#0a0a12")
        self._update_batch_count()

    def _update_batch_count(self):
        count = len(self._selected_batch)
        if count > 0:
            self._batch_count_lbl.configure(text=f"({count})")
        else:
            self._batch_count_lbl.configure(text="")

    def _add_to_batch(self, appid, name):
        if not self._batch_mode:
            return
        # Toggle: if already selected, remove; otherwise add
        if appid in self._selected_batch:
            self._selected_batch.discard(appid)
            self._hlog.log(f"Removed {name} from batch ({len(self._selected_batch)} left)", "info")
            # Update card visual to show deselected
            for c in self._rgrid._cards:
                if c._appid == appid:
                    c.set_selected(False)
                    break
        else:
            self._selected_batch.add(appid)
            self._hlog.log(f"Added {name} to batch ({len(self._selected_batch)} total)", "info")
            # Update card visual to show selected with green
            for c in self._rgrid._cards:
                if c._appid == appid:
                    c.set_selected(True)
                    break
        self._update_batch_count()

    def _update_recently_viewed(self):
        global _RECENTLY_VIEWED
        for i, item_data in enumerate(self._recent_items):
            name_lbl, install_btn_frame, install_lbl, frame = item_data
            
            # Unbind any existing bindings
            try:
                name_lbl.unbind("<Button-1>")
                install_lbl.unbind("<Button-1>")
                install_btn_frame.unbind("<Enter>")
                install_btn_frame.unbind("<Leave>")
                install_lbl.unbind("<Enter>")
                install_lbl.unbind("<Leave>")
            except Exception:
                logging.debug("Failed to unbind recently viewed items", exc_info=True)
            
            if i < len(_RECENTLY_VIEWED):
                appid, name = _RECENTLY_VIEWED[i]
                short = name[:16] + "..." if len(name) > 16 else name
                name_lbl.configure(text=f"  {short}")
                install_btn_frame.pack(side="right", padx=(2,0), pady=1)
                
                # Use default args to capture current values (closure fix)
                def make_select(a=appid, n=name):
                    return lambda _: self._quick_select(a, n)
                name_lbl.bind("<Button-1>", make_select())
                
                def make_install(a=appid, n=name):
                    return lambda _: self._quick_install(a, n)
                install_lbl.bind("<Button-1>", make_install())
                
                # Hover effects with captured widget refs
                def on_enter_install(e, btn_frame=install_btn_frame, btn_lbl=install_lbl):
                    btn_frame.configure(bg=ACCENT)
                    btn_lbl.configure(bg=ACCENT, fg=WHITE)
                def on_leave_install(e, btn_frame=install_btn_frame, btn_lbl=install_lbl):
                    btn_frame.configure(bg="#1a1a28")
                    btn_lbl.configure(bg="#1a1a28", fg=ACCENT)
                install_btn_frame.bind("<Enter>", on_enter_install)
                install_btn_frame.bind("<Leave>", on_leave_install)
                install_lbl.bind("<Enter>", on_enter_install)
                install_lbl.bind("<Leave>", on_leave_install)
            else:
                name_lbl.configure(text="")
                install_btn_frame.pack_forget()

    def _quick_select(self, appid, name):
        self._sel_appid = appid
        self._sel_name = name
        short = (name[:44]+"...") if len(name)>46 else name
        self._strip_lbl.configure(
            text=f"  Selected: {short}  ·  App ID {appid}",
            fg=GREEN)
        self._hlog.log(f"Selected: {name}", "info")
        show_toast(self, f"Selected: {name}", 2000, ACCENT)

    def _quick_install(self, appid, name):
        self._sel_appid = appid
        self._sel_name = name
        self._hlog.clear()
        self._hlog.log(f"Installing {name}...", "info")
        inc = self._dlc.get()
        def _run():
            install_game(
                appid, self._get_cfg(),
                lambda m,t="info":self.after(0,lambda:self._hlog.log(m,t)),
                lambda ok:self.after(0,lambda:self._on_install_done(ok, name)),
                include_dlc=inc)
        threading.Thread(target=_run, daemon=True).start()

    def _on_query_change(self, *_):
        if self._search_timer:
            try: self.after_cancel(self._search_timer)
            except Exception:
                logging.debug("Failed to cancel search timer", exc_info=True)
        q = self._qvar.get()
        if q == "Search games or type App ID...":
            self._hide_autocomplete()
            return
        q = q.strip()
        if q:
            self._ph = False
            self._is_searching = True
            self._clear_btn.configure(fg=OFFWHITE)
            self._clear_btn.lift()
            try: self._back_btn.pack(side="left", padx=(10,0))
            except Exception:
                logging.debug("Failed to show back button on query change")
            self._update_autocomplete()
            self._search_timer = self.after(200, self._do_instant_search)
        else:
            self._clear_btn.configure(fg="#64748b")
            try: self._back_btn.pack_forget()
            except Exception:
                logging.debug("Failed to hide back button on empty query")
            self._ph = True
            self._is_searching = False
            self._hide_autocomplete()
            self._load_featured()

    def _do_instant_search(self):
        if self._ph: return
        q = self._qvar.get().strip()
        if not q:
            self._show_featured()
            return
        self._show("home")
        
        # Reset genre filter visual when searching
        if hasattr(self, '_genre_filters') and hasattr(self, '_current_genre'):
            self._current_genre.set("All")
            for g, btn in self._genre_filters.items():
                if g == "All":
                    btn.configure(bg=ACCENT, fg=WHITE)
                else:
                    btn.configure(bg="#2a2a3a", fg="#a0a0b0")
        
        try: self._back_btn.pack(side="left", padx=(10,0))
        except Exception:
            logging.debug("Failed to show back button in instant search")
        if q.isdigit():
            self._sel_appid = q
            self._htitle.configure(text=f"App ID {q}")
            self._hsub.configure(text="Manual entry")
            self._strip_lbl.configure(
                text=f"  ✓  App ID {q}  ·  Ready to install", fg=GREEN)
            return
        
        # Search
        results = []
        q_lower = q.lower().strip()
        for aid, name in FEATURED:
            if q_lower in name.lower():
                results.append((aid, name))
                if len(results) >= 100:
                    break
        
        self._hlog.clear()
        if not results:
            self._htitle.configure(text=f'No results for "{q}"')
            self._hsub.configure(text="Try a different search term")
            self._rgrid.set_items([], page=1)
            self._hlog.log(f"Search '{q}': 0 results", "info")
        else:
            self._htitle.configure(text=f'Results for "{q}"')
            self._hsub.configure(text=f"{len(results)} game(s) · {max(1, (len(results) + 49) // 50)} pages")
            self._rgrid.set_items(results, page=1)
            self._hlog.log(f"Search '{q}': {len(results)} results found", "success")
        self._hpager.set_total(self._rgrid.get_page_count(), 1)
        self._strip_lbl.configure(text="  Click a card to select", fg=SUB)
        self._hsf.scroll_top()

    def _trigger_search(self):
        pass

    def _do_install(self):
        # Check for batch mode
        if self._batch_mode and self._selected_batch:
            self._do_batch_install()
            return
        
        if not self._sel_appid:
            messagebox.showwarning("No game selected",
                                   "Click a game card to select it first.")
            return
        self._hlog.clear()
        game_name = self._sel_name
        inc = self._dlc.get()
        def _run():
            install_game(
                self._sel_appid, self._get_cfg(),
                lambda m,t="info":self.after(0,lambda:self._hlog.log(m,t)),
                lambda ok:self.after(0,lambda:self._on_install_done(ok, game_name)),
                include_dlc=inc)
        threading.Thread(target=_run, daemon=True).start()

    def _do_batch_install(self):
        if not self._selected_batch:
            messagebox.showwarning("No games selected",
                                   "Enable batch mode and select games first.")
            return
        
        batch_list = list(self._selected_batch)
        total = len(batch_list)
        
        # Create progress window
        self._batch_progress_win = tk.Toplevel(self)
        self._batch_progress_win.title("Installing Games")
        self._batch_progress_win.geometry("400x150")
        self._batch_progress_win.configure(bg="#1a1a26")
        self._batch_progress_win.resizable(False, False)
        self._batch_progress_win.transient(self)
        self._batch_progress_win.grab_set()
        
        screen_w = self.winfo_screenwidth()
        screen_h = self.winfo_screenheight()
        win_w, win_h = 400, 150
        x = (screen_w - win_w) // 2
        y = (screen_h - win_h) // 2
        self._batch_progress_win.geometry(f"{win_w}x{win_h}+{x}+{y}")
        
        # Header
        header = tk.Frame(self._batch_progress_win, bg="#1a1a26")
        header.pack(fill="x", padx=20, pady=(15,10))
        tk.Label(header, text="Batch Install Progress", font=(FN, 12, "bold"),
                bg="#1a1a26", fg=TEXT_PRIMARY).pack(anchor="w")
        
        # Status label
        self._batch_status_lbl = tk.Label(self._batch_progress_win, text="Preparing...",
                font=(FN, 9), bg="#1a1a26", fg=TEXT_SECONDARY)
        self._batch_status_lbl.pack(anchor="w", padx=20, pady=(5,5))
        
        # Progress bar
        prog_frame = tk.Frame(self._batch_progress_win, bg="#1a1a26")
        prog_frame.pack(fill="x", padx=20, pady=5)
        
        self._batch_progress = ttk.Progressbar(prog_frame, length=360, mode='determinate',
                                             maximum=total, value=0)
        self._batch_progress.pack(fill="x")
        
        # Count label
        self._batch_count_lbl = tk.Label(self._batch_progress_win, text=f"0 / {total}",
                font=(FN, 9), bg="#1a1a26", fg=TEXT_MUTED)
        self._batch_count_lbl.pack(anchor="e", padx=20, pady=(5,15))
        
        self._batch_install_count = 0
        self._batch_install_total = total
        self._batch_install_success = 0
        self._batch_install_failed = 0
        
        # Start batch install in thread
        def _run_batch():
            for i, appid in enumerate(batch_list):
                name = self._get_game_name(appid)
                self.after(0, lambda n=i+1, g=appid, gn=name: self._update_batch_progress(n, g, gn))
                
                result = [False]
                def make_callback(r):
                    def cb(ok):
                        r[0] = ok
                    return cb
                
                inc = self._dlc.get()
                install_game(g, self._get_cfg(),
                    lambda m,t="info": None,
                    make_callback(result),
                    include_dlc=inc)
                
                # Wait for completion (simple polling)
                import time
                for _ in range(100):
                    time.sleep(0.1)
                    if result[0] != False:
                        break
                
                if result[0]:
                    self._batch_install_success += 1
                else:
                    self._batch_install_failed += 1
            
            self.after(0, self._on_batch_install_done)
        
        threading.Thread(target=_run_batch, daemon=True).start()

    def _get_game_name(self, appid):
        for aid, name in FEATURED:
            if aid == appid:
                return name
        return f"Game {appid}"

    def _update_batch_progress(self, current, appid, name):
        self._batch_install_count = current
        self._batch_progress["value"] = current
        self._batch_count_lbl.configure(text=f"{current} / {self._batch_install_total}")
        short_name = name[:30] + "..." if len(name) > 30 else name
        self._batch_status_lbl.configure(text=f"Installing: {short_name}")

    def _on_batch_install_done(self):
        if hasattr(self, '_batch_progress_win') and self._batch_progress_win.winfo_exists():
            self._batch_progress_win.destroy()
        
        # Show result
        total = self._batch_install_total
        success = self._batch_install_success
        failed = self._batch_install_failed
        
        if failed == 0:
            show_toast(self, f"Batch install complete! {success} games installed.", 5000, SUCCESS)
            self._hlog.log(f"Batch install complete: {success}/{total} games installed.", "success")
        else:
            show_toast(self, f"Batch install done: {success} ok, {failed} failed.", 5000, WARNING)
            self._hlog.log(f"Batch install done: {success}/{total} ok, {failed} failed.", "warning")
        
        # Clear batch selection
        self._selected_batch.clear()
        self._update_batch_count()
        self._batch_mode = False
        self._batch_btn.configure(bg=MUTED)

    def _on_install_done(self, ok, game_name):
        if ok:
            show_toast(self, f"✓ {game_name} installed successfully!", 4000, SUCCESS)
        else:
            show_toast(self, f"✗ Failed to install {game_name}", 4000, ERROR)

    def _sf_in(self, _):
        if self._ph:
            self._se.delete(0,"end")
            self._se.configure(fg="#e2e8f0")
            self._ph = False
        else:
            self._se.configure(fg="#e2e8f0")
        self._clear_btn.configure(fg=OFFWHITE)
        self._search_focused = True

    def _update_autocomplete(self):
        q = self._qvar.get().strip().lower()
        if self._ph or not q or len(q) < 2:
            self._hide_autocomplete()
            return
        
        # Find matches
        results = []
        for aid, name in FEATURED[:500]:  # Limit search for performance
            if q in name.lower():
                results.append((aid, name))
                if len(results) >= 5:
                    break
        
        if results:
            self._show_autocomplete(results)
        else:
            self._hide_autocomplete()

    def _show_autocomplete(self, results):
        self._hide_autocomplete()
        
        self._autocomplete_items = results
        self._autocomplete_selected = -1
        
        # Create dropdown
        self._autocomplete_win = tk.Toplevel(self._se.winfo_toplevel())
        self._autocomplete_win.wm_overrideredirect(True)
        
        x = self._se.winfo_rootx()
        y = self._se.winfo_rooty() + self._se.winfo_height() + 2
        
        # Calculate width
        width = self._se.winfo_width()
        self._autocomplete_win.wm_geometry(f"{width}x{len(results)*28}+{x}+{y}")
        
        self._autocomplete_win.configure(bg="#1a1a26")
        
        # Add border frame
        border = tk.Frame(self._autocomplete_win, bg=PRIMARY_PURPLE, bd=1)
        border.pack(fill="both", expand=True)
        
        inner = tk.Frame(border, bg="#1a1a26")
        inner.pack(fill="both", expand=True)
        
        self._autocomplete_labels = []
        for i, (aid, name) in enumerate(results):
            item_frame = tk.Frame(inner, bg="#1a1a26", cursor="hand2")
            item_frame.pack(fill="x", padx=2, pady=1)
            
            short = name[:45] + "..." if len(name) > 45 else name
            lbl = tk.Label(item_frame, text=short, font=(FN, 9),
                          bg="#1a1a26", fg=TEXT_SECONDARY, anchor="w",
                          padx=10, pady=4)
            lbl.pack(fill="x")
            
            def make_select(a=aid, n=name, idx=i):
                return lambda _: self._select_autocomplete(a, n, idx)
            
            lbl.bind("<Button-1>", make_select())
            item_frame.bind("<Button-1>", make_select())
            lbl.bind("<Enter>", lambda _, w=item_frame: w.configure(bg="#2a2a3a"))
            lbl.bind("<Leave>", lambda _, w=item_frame: w.configure(bg="#1a1a26"))
            item_frame.bind("<Enter>", lambda _, w=item_frame: w.configure(bg="#2a2a3a"))
            item_frame.bind("<Leave>", lambda _, w=item_frame: w.configure(bg="#1a1a26"))
            
            self._autocomplete_labels.append((item_frame, lbl))

    def _hide_autocomplete(self):
        if self._autocomplete_win:
            try:
                self._autocomplete_win.destroy()
            except Exception:
                logging.debug("Failed to destroy autocomplete window", exc_info=True)
            self._autocomplete_win = None
            self._autocomplete_items = []
            self._autocomplete_selected = -1

    def _select_autocomplete(self, aid, name, idx):
        self._qvar.set(name)
        self._ph = False
        self._hide_autocomplete()
        self._se.icursor("end")
        self._do_instant_search()

    def _autocomplete_down(self, _):
        if not self._autocomplete_items:
            return "break"
        if self._autocomplete_selected < len(self._autocomplete_items) - 1:
            self._autocomplete_selected += 1
            self._highlight_autocomplete()
        return "break"

    def _autocomplete_up(self, _):
        if not self._autocomplete_items:
            return "break"
        if self._autocomplete_selected > 0:
            self._autocomplete_selected -= 1
            self._highlight_autocomplete()
        return "break"

    def _highlight_autocomplete(self):
        for i, (frame, lbl) in enumerate(self._autocomplete_labels):
            if i == self._autocomplete_selected:
                frame.configure(bg=ACCENT)
                lbl.configure(bg=ACCENT, fg=WHITE)
            else:
                frame.configure(bg="#1a1a26")
                lbl.configure(bg="#1a1a26", fg=TEXT_SECONDARY)

    def _sf_out(self, _):
        self._clear_btn.configure(fg="#64748b")
        self._search_focused = False
        self._hide_autocomplete()

    def _clear_search(self):
        self._ph = True
        self._is_searching = False
        self._se.delete(0,"end")
        self._se.insert(0,"Search games or type App ID...")
        self._se.configure(fg="#64748b")
        self._qvar.set("")
        self._clear_btn.configure(fg="#64748b")
        try: self._back_btn.pack_forget()
        except Exception:
            logging.debug("Failed to hide back button in clear_search")
        self._load_featured()

    def _build_library(self):
        f = tk.Frame(self._parea, bg=BG)
        self._pages["library"] = f

        hdr = tk.Frame(f, bg=BG)
        hdr.pack(fill="x", padx=22, pady=(18,8))
        tk.Label(hdr, text="Library", font=(FN,20,"bold"),
                 fg=WHITE, bg=BG).pack(side="left")
        RoundedBtn(hdr,"Refresh",self._lib_refresh,
                bg=MUTED,fg=WHITE,fs=9,pady=5,padx=12).pack(side="right")

        sq = tk.Frame(f, bg=BG)
        sq.pack(fill="x", padx=22, pady=(0,8))
        self._lqv = tk.StringVar()
        le = tk.Entry(sq, textvariable=self._lqv, font=(FN,10),
                      bg=ENTRY, fg=WHITE, insertbackground=WHITE,
                      relief="flat", highlightthickness=1,
                      highlightcolor=ACCENT, highlightbackground=BORDER)
        le.insert(0,"Search library..."); le.configure(fg=SUB)
        le.bind("<FocusIn>",  lambda _:(le.delete(0,"end"),le.configure(fg=WHITE))
                if le.get()=="Search library..." else None)
        le.bind("<FocusOut>", lambda _:(le.delete(0,"end"),le.insert(0,"Search library..."),
                le.configure(fg=SUB)) if not self._lqv.get() else None)
        le.pack(fill="x", ipady=8)
        self._lqv.trace_add("write", lambda *_:self._lib_render())

        HSep(f)
        self._lsf = ScrollFrame(f)
        self._lsf.pack(fill="both", expand=True)
        self._llog = LogBox(f, height=6)
        self._llog.pack(fill="x")
        self._lib_ids=[]
        self.after(600, self._lib_refresh)

    def _lib_refresh(self):
        self._lib_ids=[]
        pd=self._cfg.get("lua_path","")
        if os.path.isdir(pd):
            for fn in sorted(os.listdir(pd)):
                if fn.endswith(".lua") and fn[:-4].isdigit():
                    self._lib_ids.append(fn[:-4])
        self._lib_render()

    def _lib_render(self):
        q=self._lqv.get().lower().strip()
        if q=="search library...": q=""
        shown=[a for a in self._lib_ids if not q or q in a]
        for w in self._lsf.inner.winfo_children(): w.destroy()
        if not shown:
            tk.Label(self._lsf.inner,
                     text="Library is empty.\nInstall a game first.",
                     font=(FN,12),fg=SUB,bg=BG,pady=60,justify="center").pack()
            return
        for appid in shown:
            row=GameRow(self._lsf.inner, appid, f"App #{appid}",
                        on_click=lambda a,n:None,
                        action_text="Remove",
                        action_cmd=lambda a=appid:self._lib_remove(a),
                        action_bg="#3a1010")
            row.pack(fill="x", pady=1)
            HSep(self._lsf.inner)
            self._lsf.add_wheel(row)
            threading.Thread(target=self._resolve,args=(appid,row),daemon=True).start()

    def _resolve(self, appid, row):
        try:
            r=requests.get(
                f"https://store.steampowered.com/api/appdetails?appids={appid}&filters=basic",
                timeout=8)
            d=r.json().get(str(appid),{})
            if d.get("success"):
                nm=d["data"].get("name",f"App {appid}")
                self.after(0,lambda:row._name_lbl.configure(text=nm))
        except Exception:
            logging.debug("Failed to resolve app name for %s", appid, exc_info=True)

    def _lib_remove(self, appid):
        p=os.path.join(self._cfg.get("lua_path",""),f"{appid}.lua")
        if os.path.exists(p): os.remove(p)
        self._lib_refresh()

    def _build_fixes(self):
        f = tk.Frame(self._parea, bg=BG)
        self._pages["fixes"] = f

        hdr = tk.Frame(f, bg=BG)
        hdr.pack(fill="x", padx=22, pady=(18,8))
        self._ftitle = tk.Label(hdr, text="Online Fixes",
                                font=(FN,20,"bold"), fg=WHITE, bg=BG)
        self._ftitle.pack(side="left")
        self._fcount = tk.Label(hdr, text="", font=(FN,10), fg=SUB, bg=BG)
        self._fcount.pack(side="left", padx=10)
        RoundedBtn(hdr,"↺ Refresh",lambda:self._load_fixes(force=True),
                bg=MUTED,fg=WHITE,fs=9,pady=5,padx=12).pack(side="right")

        pill_row = tk.Frame(f, bg=BG)
        pill_row.pack(fill="x", padx=22, pady=(0,8))
        self._ffilter="ALL"; self._fpills={}
        for opt in ["ALL","Online","Tested","Bypass"]:
            pb = tk.Button(pill_row, text=opt,
                           font=(FN,9,"bold"),
                           bg=ACCENT if opt=="ALL" else MUTED, fg=WHITE,
                           activebackground=_lighten(ACCENT if opt=="ALL" else MUTED),
                           activeforeground=WHITE,
                           relief="flat", cursor="hand2",
                           padx=16, pady=6, bd=0,
                           command=lambda o=opt:self._fix_filter(o))
            pb.pack(side="left", padx=(0,6))
            self._fpills[opt]=pb

        fsq=tk.Frame(f,bg=BG)
        fsq.pack(fill="x",padx=22,pady=(0,8))
        self._fqv=tk.StringVar()
        fe=tk.Entry(fsq,textvariable=self._fqv,font=(FN,10),
                    bg=ENTRY,fg=WHITE,insertbackground=WHITE,
                    relief="flat",highlightthickness=1,
                    highlightcolor=ACCENT,highlightbackground=BORDER)
        fe.insert(0,"Search online fixes..."); fe.configure(fg=SUB)
        fe.bind("<FocusIn>",  lambda _:(fe.delete(0,"end"),fe.configure(fg=WHITE))
                if fe.get()=="Search online fixes..." else None)
        fe.bind("<FocusOut>", lambda _:(fe.delete(0,"end"),fe.insert(0,"Search online fixes..."),
                fe.configure(fg=SUB)) if not self._fqv.get() else None)
        fe.pack(fill="x",ipady=8)
        self._fix_search_timer = None
        self._fqv.trace_add("write", lambda *_:self._fix_search())

        HSep(f)

        self._fixes_pager = PaginationBar(f, self._fix_go_page)
        self._fixes_pager.pack(fill="x", padx=14, pady=6)
        
        self._fsf=ScrollFrame(f)
        self._fsf.pack(fill="both",expand=True)
        self._flog=LogBox(f,height=6)
        self._flog.pack(fill="x")

    def _load_fixes(self, force=False):
        if self._fixes_ok and not force: return
        self._fixes_ok = False
        self._ftitle.configure(text="Online Fixes")
        self._fcount.configure(text="Loading...")
        self._flog.log("Loading fixes database...","info")

        def _run():
            games = []
            
            json_data = _load_json_file(FIXES_JSON)
            if json_data:
                try:
                    data = json_data
                    for item in data:
                        if isinstance(item, dict):
                            appid = str(item.get("appid", ""))
                            name  = str(item.get("name", f"App {appid}"))
                            badges = item.get("badges", []) or []
                            urls = item.get("download_urls", []) or [item.get("download_url", "")]
                            fix_count = item.get("fix_count", len(urls))
                            if appid and name:
                                games.append((appid, name, badges, urls, fix_count))
                    self.after(0, lambda: self._flog.log(f"Loaded {len(games)} fixes from database.","ok"))
                    self.after(0, lambda g=games: self._fixes_loaded(g))
                    return
                except Exception as e:
                    self.after(0, lambda: self._flog.log(f"Error loading fixes.json: {e}","warn"))

            self.after(0, lambda: self._flog.log("Using offline database...","warn"))
            SEED_FIXES = [
                ("1245620","ELDEN RING",["Online","Tested"],["https://generator.ryuu.lol/fixes/1245620.zip"],1),
                ("1091500","Cyberpunk 2077",["Online","Tested"],["https://generator.ryuu.lol/fixes/1091500.zip"],1),
                ("1086940","Baldur's Gate 3",["Online"],["https://generator.ryuu.lol/fixes/1086940.zip"],1),
                ("271590","Grand Theft Auto V",["Online","Bypass"],["https://generator.ryuu.lol/fixes/271590.zip"],1),
                ("553850","HELLDIVERS 2",["Online"],["https://generator.ryuu.lol/fixes/553850.zip"],1),
                ("2322010","God of War Ragnarok",["Online","Tested"],["https://generator.ryuu.lol/fixes/2322010.zip"],1),
                ("582010","Monster Hunter: World",["Online","Tested"],["https://generator.ryuu.lol/fixes/582010.zip"],1),
                ("1174180","Red Dead Redemption 2",["Online"],["https://generator.ryuu.lol/fixes/1174180.zip"],1),
                ("1623730","Palworld",["Online","Bypass"],["https://generator.ryuu.lol/fixes/1623730.zip"],1),
                ("292030","The Witcher 3: Wild Hunt",["Online","Tested"],["https://generator.ryuu.lol/fixes/292030.zip"],1),
                ("374320","DARK SOULS III",["Online","Bypass"],["https://generator.ryuu.lol/fixes/374320.zip"],1),
                ("2531310","Warhammer 40K: Space Marine II",["Online"],["https://generator.ryuu.lol/fixes/2531310.zip"],1),
                ("1888160","ARMORED CORE VI",["Online","Tested"],["https://generator.ryuu.lol/fixes/1888160.zip"],1),
                ("990080","Hogwarts Legacy",["Online"],["https://generator.ryuu.lol/fixes/990080.zip"],1),
                ("1150690","TEKKEN 8",["Online","Tested"],["https://generator.ryuu.lol/fixes/1150690.zip"],1),
                ("2767090","Dragon's Dogma 2",["Online"],["https://generator.ryuu.lol/fixes/2767090.zip"],1),
                ("1446780","Monster Hunter Rise",["Online","Tested"],["https://generator.ryuu.lol/fixes/1446780.zip"],1),
                ("892970","Valheim",["Online"],["https://generator.ryuu.lol/fixes/892970.zip"],1),
                ("730","Counter-Strike 2",["Online"],["https://generator.ryuu.lol/fixes/730.zip"],1),
                ("2358720","Black Myth: Wukong",["Online","Tested"],["https://generator.ryuu.lol/fixes/2358720.zip"],1),
                ("252490","Rust",["Online"],["https://generator.ryuu.lol/fixes/252490.zip"],1),
                ("105600","Terraria",["Online","Tested"],["https://generator.ryuu.lol/fixes/105600.zip"],1),
                ("72850","The Elder Scrolls V: Skyrim",["Online","Tested"],["https://generator.ryuu.lol/fixes/72850.zip"],1),
                ("255710","Cities: Skylines",["Online"],["https://generator.ryuu.lol/fixes/255710.zip"],1),
                ("350570","Civilization VI",["Online","Tested"],["https://generator.ryuu.lol/fixes/350570.zip"],1),
                ("814380","Sekiro: Shadows Die Twice",["Online","Tested"],["https://generator.ryuu.lol/fixes/814380.zip"],1),
                ("1593500","God of War",["Online","Tested"],["https://generator.ryuu.lol/fixes/1593500.zip"],1),
                ("1551360","Forza Horizon 5",["Online"],["https://generator.ryuu.lol/fixes/1551360.zip"],1),
                ("2050650","Resident Evil 4 Remake",["Online","Tested"],["https://generator.ryuu.lol/fixes/2050650.zip"],1),
                ("1449560","Resident Evil Village",["Online","Tested"],["https://generator.ryuu.lol/fixes/1449560.zip"],1),
                ("534380","Dying Light 2 Stay Human",["Online"],["https://generator.ryuu.lol/fixes/534380.zip"],1),
                ("394360","Hearts of Iron IV",["Online"],["https://generator.ryuu.lol/fixes/394360.zip"],1),
                ("281990","Stellaris",["Online"],["https://generator.ryuu.lol/fixes/281990.zip"],1),
                ("2246340","Monster Hunter Wilds",["Online"],["https://generator.ryuu.lol/fixes/2246340.zip"],1),
                ("2108330","Lies of P",["Online","Tested"],["https://generator.ryuu.lol/fixes/2108330.zip"],1),
                ("601150","Devil May Cry 5",["Online","Tested"],["https://generator.ryuu.lol/fixes/601150.zip"],1),
                ("413150","Stardew Valley",["Online"],["https://generator.ryuu.lol/fixes/413150.zip"],1),
                ("367520","Hollow Knight",["Online"],["https://generator.ryuu.lol/fixes/367520.zip"],1),
                ("594650","Hades",["Online","Tested"],["https://generator.ryuu.lol/fixes/594650.zip"],1),
                ("632360","Apex Legends",["Online"],["https://generator.ryuu.lol/fixes/632360.zip"],1),
                ("548430","Deep Rock Galactic",["Online"],["https://generator.ryuu.lol/fixes/548430.zip"],1),
                ("1313140","Dying Light",["Online","Tested"],["https://generator.ryuu.lol/fixes/1313140.zip"],1),
            ]
            self.after(0, lambda g=SEED_FIXES: self._fixes_loaded(g))

        threading.Thread(target=_run, daemon=True).start()

    def _fixes_loaded(self, games):
        self._fixes_raw = games
        self._fixes_ok  = True
        self._fcount.configure(text=f"{len(games)} available fixes")
        self._flog.log(f"Loaded {len(games)} online fixes.","ok")
        self._fix_page = 1
        self._fix_total = max(1, (len(games) + 49) // 50)
        self._fix_render()

    def _fix_filter(self, opt):
        self._ffilter = opt
        for k,b in self._fpills.items():
            b.configure(bg=ACCENT if k==opt else MUTED)
        self._fix_page = 1
        self._fix_render()

    def _fix_search(self):
        if self._fix_search_timer:
            try: self.after_cancel(self._fix_search_timer)
            except Exception:
                logging.debug("Failed to cancel fix search timer", exc_info=True)
        self._fix_search_timer = self.after(250, lambda: self._fix_render(1))

    def _fix_render(self, page=1):
        filt = self._ffilter
        q    = self._fqv.get().lower().strip()
        if q == "search online fixes...": q = ""
        filtered = []
        for entry in self._fixes_raw:
            appid, name, badges, links = entry[0], entry[1], entry[2], entry[3]
            fix_count = entry[4] if len(entry) > 4 else len(links)
            if q and q not in name.lower() and q not in appid: continue
            if filt != "ALL":
                bl = [b.lower() for b in badges]
                if filt.lower() not in bl: continue
            filtered.append((appid, name, badges, links, fix_count))

        total_pages = max(1, (len(filtered) + 49) // 50)
        page = max(1, min(page, total_pages))
        self._fix_page = page
        
        self._fcount.configure(
            text=f"{len(filtered)} of {len(self._fixes_raw)} games | Page {page}/{total_pages}")

        for w in self._fsf.inner.winfo_children():
            w.destroy()

        if not filtered:
            tk.Label(self._fsf.inner,
                     text="No games match your search/filter.",
                     font=(FN,12),fg=SUB,bg=BG,pady=60).pack()
            self._fsf.inner.update_idletasks()
            return

        start = (page - 1) * 50
        page_items = filtered[start:start+50]

        for appid, name, badges, links, fix_count in page_items:
            dl = links[0] if links else None
            row = self._make_fix_row(self._fsf.inner, appid, name, badges, fix_count, dl)
            row.pack(fill="x", pady=1)
            HSep(self._fsf.inner)
            self._fsf.add_wheel(row)

        self._fsf.inner.update_idletasks()
        self._fsf._reconf(None)
        self._fsf.scroll_top()
        
        self._fixes_pager.set_total(total_pages, page)

    def _fix_go_page(self, page):
        self._fix_render(page)

    def _make_fix_row(self, parent, appid, name, badges, fix_count, dl_url):
        row = tk.Frame(parent, bg=PANEL2, cursor="hand2")
        row._bg  = PANEL2
        row._hbg = HOV

        cv = tk.Canvas(row, width=120, height=60, bg="#0d0d18",
                       highlightthickness=0, bd=0)
        cv.pack(side="left", padx=12, pady=8)
        ph = get_ph(120, 60)
        if ph:
            ph_id = cv.create_image(0,0,anchor="nw",image=ph)
            cv._ph = ph
        fetch_cover(appid, 120, 60,
                    lambda aid,photo,c=cv: self._set_fix_cover(c,photo))

        mid = tk.Frame(row, bg=PANEL2)
        mid.pack(side="left", fill="both", expand=True, pady=8)

        name_lbl = tk.Label(mid, text=name, font=(FN,10,"bold"),
                             fg=WHITE, bg=PANEL2, anchor="w")
        name_lbl.pack(anchor="w")

        meta = tk.Frame(mid, bg=PANEL2)
        meta.pack(anchor="w", pady=(3,0))
        tk.Label(meta, text=f"AppID  {appid}", font=(FN,8),
                 fg=SUB, bg=PANEL2).pack(side="left")
        tk.Label(meta, text=f"  |  {fix_count} fix{'es' if fix_count!=1 else ''}",
                 font=(FN,8), fg=SUB, bg=PANEL2).pack(side="left")

        if badges:
            for b in badges:
                c = {"online":GREEN,"tested":BLUE,"bypass":AMBER}.get(b.lower(), SUB)
                tk.Label(meta, text=f" {b.upper()} ", font=(FN,7,"bold"),
                         bg=BG, fg=c).pack(side="left", padx=(5,0))

        if dl_url:
            btn = tk.Button(row, text="Download Fix",
                            font=(FN,9,"bold"), bg="#0e2a18", fg=WHITE,
                            activebackground=_lighten("#0e2a18",15),
                            activeforeground=WHITE,
                            relief="flat", cursor="hand2",
                            padx=12, pady=5, bd=0,
                            command=lambda u=dl_url,n=name: self._dl_fix(u,n))
            btn.pack(side="right", padx=12)
            btn.bind("<Enter>", lambda _: btn.configure(bg=_lighten("#0e2a18",15)))
            btn.bind("<Leave>", lambda _: btn.configure(bg="#0e2a18"))

        tk.Frame(row, bg=BORDER, width=1).pack(side="right", fill="y", pady=6)

        def _hin(_=None):
            for w in [row,mid,name_lbl,meta]+list(meta.winfo_children()):
                try: w.configure(bg=HOV)
                except Exception:
                    logging.debug("Failed to set hover background", exc_info=True)
        def _hout(_=None):
            for w in [row,mid,name_lbl,meta]+list(meta.winfo_children()):
                try: w.configure(bg=PANEL2)
                except Exception:
                    logging.debug("Failed to set unhover background", exc_info=True)
        for w in (row, cv, mid, name_lbl, meta):
            w.bind("<Enter>", _hin, add="+")
            w.bind("<Leave>", _hout, add="+")

        return row

    def _set_fix_cover(self, canvas, photo):
        try:
            canvas._photo = photo
            items = canvas.find_all()
            if items: canvas.itemconfig(items[0], image=photo)
        except Exception:
            logging.debug("Failed to set fix cover image", exc_info=True)

    def _dl_fix(self, url, name):
        dest_dir = filedialog.askdirectory(title=f"Save fix for {name}...")
        if not dest_dir: return
        self._flog.log(f"Downloading fix for {name}...","info")
        def _run():
            try:
                r=requests.get(url,headers=DL_HDR,timeout=120,stream=True)
                r.raise_for_status()
                fname=urllib.parse.unquote(url.split("/")[-1])
                dest=os.path.join(dest_dir,fname)
                total=int(r.headers.get("content-length",0)); recv=0
                with open(dest,"wb") as fh:
                    for chunk in r.iter_content(65536):
                        if chunk:
                            fh.write(chunk); recv+=len(chunk)
                            if total:
                                p=int(recv*100/total)
                                self.after(0,lambda p=p,rb=recv,t=total:
                                    self._flog.log(f"  {p}%  {rb//1024}KB/{t//1024}KB","sub"))
                self.after(0,lambda:self._flog.log(f"✓  Saved: {dest}","ok"))
                self.after(0,lambda:self._flog.log("Extract ZIP, follow README.","sub"))
            except Exception as e:
                self.after(0,lambda:self._flog.log(f"Error: {e}","error"))
        threading.Thread(target=_run,daemon=True).start()

    def _build_settings(self):
        f=tk.Frame(self._parea,bg=BG_MAIN)
        self._pages["settings"]=f
        self._ssf=ScrollFrame(f)
        self._ssf.pack(fill="both",expand=True)
        inner=self._ssf.inner
        
        self._ssf.add_wheel(inner)

        tk.Label(inner,text="Settings",font=(FN,20,"bold"),
                 fg=TEXT_PRIMARY,bg=BG_MAIN).pack(anchor="w",padx=22,pady=(18,4))

        def section(title,sub=""):
            HSep(inner,padx=22,pady=(14,0))
            sh=tk.Frame(inner,bg=BG)
            sh.pack(fill="x",padx=22,pady=(8,2))
            tk.Label(sh,text=title.upper(),font=(FN,8,"bold"),
                     fg=SUB,bg=BG).pack(anchor="w")
            if sub:
                tk.Label(sh,text=sub,font=(FN,9),fg=SUB,bg=BG).pack(anchor="w")

        def path_row(parent,label,var,is_file=False):
            wrap=tk.Frame(parent,bg=BG)
            wrap.pack(fill="x",padx=22,pady=5)
            tk.Label(wrap,text=label,font=(FN,9,"bold"),fg=OFFWHITE,bg=BG).pack(anchor="w")
            row=tk.Frame(wrap,bg=BG)
            row.pack(fill="x",pady=(3,0))
            e=tk.Entry(row,textvariable=var,font=(FN,10),
                       bg=ENTRY,fg=WHITE,insertbackground=WHITE,
                       relief="flat",highlightthickness=1,
                       highlightcolor=ACCENT,highlightbackground=BORDER)
            e.pack(side="left",fill="x",expand=True,ipady=8)
            def browse():
                p=(filedialog.askopenfilename() if is_file
                   else filedialog.askdirectory(initialdir=var.get() or "/"))
                if p: var.set(p)
            RoundedBtn(row,"Browse",browse,bg=MUTED,fg=WHITE,fs=8,
                    pady=4,padx=8).pack(side="left",padx=(4,0))

        section("Paths","Where Steam files are located.")
        path_row(inner,"Steam Executable",  self._sv["steam_exe"],  is_file=True)
        path_row(inner,"Lua Scripts (stplug-in)",self._sv["lua_path"])
        path_row(inner,"Manifests (depotcache)",self._sv["manifest_path"])

        section("Preferences")
        pf=tk.Frame(inner,bg=BG)
        pf.pack(fill="x",padx=22,pady=8)
        self._dlc_sv=tk.BooleanVar(value=self._cfg.get("include_dlc",True))
        ToggleSwitch(pf,self._dlc_sv,"Include DLCs when installing",bg=BG).pack(anchor="w")
        
        self._skip_music_sv=tk.BooleanVar(value=self._cfg.get("skip_music",False))
        ToggleSwitch(pf,self._skip_music_sv,"Skip Steam music files",bg=BG).pack(anchor="w", pady=(6,0))
        
        self._auto_start_sv=tk.BooleanVar(value=self._cfg.get("auto_start",False))
        ToggleSwitch(pf,self._auto_start_sv,"Auto-start with Windows",bg=BG).pack(anchor="w", pady=(6,0))
        
        self._backup_lua_sv=tk.BooleanVar(value=self._cfg.get("backup_lua",True))
        ToggleSwitch(pf,self._backup_lua_sv,"Backup existing Lua files before replacing",bg=BG).pack(anchor="w", pady=(6,0))

        section("Tools")
        tf=tk.Frame(inner,bg=BG)
        tf.pack(fill="x",padx=22,pady=8)
        tools=[
            ("Fix games not showing", self._install_steamtools, ACCENT_DARK),
            ("Open depotcache",       self._open_depot, "#1a3a4a"),
            ("Open stplug-in",        self._open_plugin, "#2a1a4a"),
            ("Clear Image Cache",     self._clear_image_cache, "#3a2a1a"),
            ("Run Diagnostics",       self._run_diagnostics, "#4a1a3a"),
            ("Scan New Games",        self._scan_new_games, "#1a3a2a"),
            ("Fix No Internet",
             lambda: threading.Thread(
                 target=fix_no_internet,
                 args=(lambda m,t="info":self.after(0,lambda:self._slog.log(m,t)),),
                 daemon=True).start(),
             "#3a1a2a"),
        ]
        for txt,cmd,bg in tools:
            RoundedBtn(tf,txt,cmd,bg=bg,fg=WHITE,fs=9,
                    pady=6,padx=12).pack(side="left",padx=(0,8),pady=(0,4))

        section("Favourites")
        fav_frame=tk.Frame(inner,bg=BG)
        fav_frame.pack(fill="x",padx=22,pady=8)
        fav_info=tk.Label(fav_frame,text=f"Currently have {len(_FAVORITES)} saved favourites",
                        font=(FN,9),fg=TEXT_SECONDARY,bg=BG)
        fav_info.pack(anchor="w",pady=(0,8))
        fav_btns=tk.Frame(fav_frame,bg=BG)
        fav_btns.pack(fill="x")
        RoundedBtn(fav_btns,"Export Favourites",self._export_favourites,
                  bg="#1a4a2a",fg=WHITE,fs=9,pady=5,padx=12).pack(side="left",padx=(0,8))
        RoundedBtn(fav_btns,"Import Favourites",self._import_favourites,
                  bg="#2a2a4a",fg=WHITE,fs=9,pady=5,padx=12).pack(side="left")

        HSep(inner,padx=22,pady=(14,0))
        RoundedBtn(inner,"Save Settings",self._save_cfg,
                bg=ACCENT,fg=WHITE,fs=10,pady=8,
                padx=20).pack(anchor="w",padx=22,pady=10)

        self._slog=LogBox(inner,height=5)
        self._slog.pack(fill="x",padx=22,pady=(0,16))

    def _run_diagnostics(self):
        self._slog.clear()
        self._slog.log("=== DIAGNOSTICS ===", "info")
        
        # Check Steam path
        steam_path = self._sv["steam_exe"].get()
        manifest_path = self._sv["manifest_path"].get()
        lua_path = self._sv["lua_path"].get()
        
        self._slog.log(f"Steam EXE: {steam_path}", "info")
        if os.path.exists(steam_path):
            self._slog.log("✓  Steam EXE found", "ok")
        else:
            self._slog.log("✗  Steam EXE NOT found!", "error")
        
        # Check manifest folder
        self._slog.log(f"Manifest folder: {manifest_path}", "info")
        if os.path.isdir(manifest_path):
            self._slog.log("✓  Manifest folder exists", "ok")
            # Test write
            test_file = os.path.join(manifest_path, "_test_write.txt")
            try:
                with open(test_file, "w") as f:
                    f.write("test")
                os.remove(test_file)
                self._slog.log("✓  Write permission OK", "ok")
            except Exception as e:
                self._slog.log(f"✗  Write permission FAILED: {e}", "error")
                self._slog.log("   Try running as ADMINISTRATOR", "error")
        else:
            self._slog.log("✗  Manifest folder NOT found!", "error")
            try:
                os.makedirs(manifest_path, exist_ok=True)
                self._slog.log("   Created folder successfully", "ok")
            except Exception as e:
                self._slog.log(f"   Cannot create folder: {e}", "error")
        
        # Check Lua folder
        self._slog.log(f"Lua folder: {lua_path}", "info")
        if os.path.isdir(lua_path):
            self._slog.log("✓  Lua folder exists", "ok")
        else:
            self._slog.log("✗  Lua folder NOT found!", "error")
            try:
                os.makedirs(lua_path, exist_ok=True)
                self._slog.log("   Created folder successfully", "ok")
            except Exception as e:
                self._slog.log(f"   Cannot create folder: {e}", "error")
        
        # Check for SteamTools plugin
        steamtools_paths = [
            os.path.join(steam_path, "..", "..", "SteamTools"),
            os.path.join(steam_path, "..", "..", "steamui", "plugins"),
            os.path.join(os.path.dirname(steam_path), "SteamTools"),
        ]
        steamtools_found = False
        for st_path in steamtools_paths:
            st_path = os.path.abspath(st_path)
            if os.path.isdir(st_path):
                self._slog.log(f"SteamTools found: {st_path}", "info")
                steamtools_found = True
                try:
                    files = os.listdir(st_path)
                    if files:
                        self._slog.log(f"  SteamTools files: {len(files)}", "ok")
                    else:
                        self._slog.log("  SteamTools folder is EMPTY", "warn")
                except Exception:
                    logging.debug("Failed to list SteamTools directory", exc_info=True)
        if not steamtools_found:
            self._slog.log("SteamTools: NOT found (this is OK)", "sub")
        
        # Test GitHub connectivity
        self._slog.log("Testing GitHub connectivity...", "info")
        try:
            import requests
            r = requests.get("https://api.github.com", timeout=10)
            if r.status_code == 200:
                self._slog.log("✓  GitHub accessible", "ok")
            else:
                self._slog.log(f"✗  GitHub returned: {r.status_code}", "error")
        except Exception as e:
            self._slog.log(f"✗  GitHub FAILED: {e}", "error")
            self._slog.log("   Check your internet/firewall", "error")
        
        # Count existing manifests
        if os.path.isdir(manifest_path):
            try:
                files = [f for f in os.listdir(manifest_path) if f.endswith(".manifest")]
                self._slog.log(f"Existing manifests in depotcache: {len(files)}", "info")
                if files:
                    for f in files[:5]:
                        self._slog.log(f"  - {f}", "sub")
                    if len(files) > 5:
                        self._slog.log(f"  ... and {len(files)-5} more", "sub")
            except Exception as e:
                self._slog.log(f"Error reading depotcache: {e}", "error")
        
        # Check Lua files
        if os.path.isdir(lua_path):
            try:
                lua_files = [f for f in os.listdir(lua_path) if f.endswith(".lua")]
                self._slog.log(f"Existing Lua files: {len(lua_files)}", "info")
            except Exception as e:
                self._slog.log(f"Error reading lua folder: {e}", "error")
        
        self._slog.log("=== DIAGNOSTICS COMPLETE ===", "info")
    
    def _scan_new_games(self):
        """Scan Steam for newly released games"""
        self._slog.clear()
        self._slog.log("=== SCANNING FOR NEW GAMES ===", "info")
        self._slog.log("Fetching new releases from Steam...", "info")
        
        def _scan_thread():
            try:
                import requests
                from bs4 import BeautifulSoup
                
                # Use Steam's new releases search
                url = "https://store.steampowered.com/search/results/?sort_by=Release DESC&force=1&count=100"
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                
                response = requests.get(url, headers=headers, timeout=30)
                if response.status_code != 200:
                    self.after(0, lambda: self._slog.log(f"Failed to fetch: {response.status_code}", "error"))
                    return
                
                soup = BeautifulSoup(response.text, "html.parser")
                
                # Find game links
                new_games = []
                for link in soup.select("a.search_result_row"):
                    appid = link.get("data-ds-appid", "")
                    name = link.select_one(".title")
                    if appid and name:
                        new_games.append((appid, name.text.strip()))
                
                if new_games:
                    # Get current games - handle case where _ALL_GAMES_NAMES may not exist
                    current_apps = set()
                    for aid, _ in FEATURED:
                        current_apps.add(aid)
                    
                    # Safely get _ALL_GAMES_DATA if it exists
                    all_games_data = globals().get('_ALL_GAMES_DATA', {})
                    for aid in all_games_data:
                        current_apps.add(aid)
                    
                    # Find truly new games
                    truly_new = []
                    for appid, name in new_games:
                        if appid not in current_apps:
                            truly_new.append((appid, name))
                            if len(truly_new) >= 20:  # Limit to 20 new games
                                break
                    
                    if truly_new:
                        self.after(0, lambda: self._slog.log(f"Found {len(truly_new)} NEW games!", "ok"))
                        for appid, name in truly_new[:10]:
                            self.after(0, lambda a=appid, n=name: self._slog.log(f"  + {n} ({a})", "ok"))
                        if len(truly_new) > 10:
                            self.after(0, lambda: self._slog.log(f"  ... and {len(truly_new) - 10} more", "ok"))
                    else:
                        self.after(0, lambda: self._slog.log("No new games found (all in database)", "info"))
                else:
                    self.after(0, lambda: self._slog.log("Could not parse game list", "error"))
                    
            except ImportError:
                self.after(0, lambda: self._slog.log("BeautifulSoup not installed", "error"))
                self.after(0, lambda: self._slog.log("Install: pip install beautifulsoup4", "info"))
            except Exception as e:
                self.after(0, lambda: self._slog.log(f"Error: {str(e)}", "error"))
            
            self.after(0, lambda: self._slog.log("=== SCAN COMPLETE ===", "info"))
        
        threading.Thread(target=_scan_thread, daemon=True).start()

    def _install_steamtools(self):
        """Install SteamTools — this feature requires manual download."""
        self._slog.log("SteamTools installation: download from https://steamtools.net/", "warn")
        self._slog.log("Run the installer manually with administrator privileges.", "warn")
        # Removed: irm steam.run | iex — RCE security risk

    def _fix_games(self):
        s=self._get_cfg()
        for p in [s["lua_path"],s["manifest_path"]]:
            try:
                os.makedirs(p,exist_ok=True)
                self._slog.log(f"✓  {p}","ok")
            except Exception as e:
                self._slog.log(f"✗  {p}:{e}","error")
        self._slog.log("Done. Try restarting Steam.","ok")

    def _open_depot(self):
        p=self._sv["manifest_path"].get()
        if os.path.isdir(p): os.startfile(p)

    def _open_plugin(self):
        p=self._sv["lua_path"].get()
        if os.path.isdir(p): os.startfile(p)

    def _export_favourites(self):
        if not _FAVORITES:
            self._slog.log("No favourites to export.","warning")
            return
        path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON Files", "*.json")],
            initialfile="ahg_favourites.json"
        )
        if not path:
            return
        try:
            with open(path, 'w') as f:
                json.dump(list(_FAVORITES), f, indent=2)
            self._slog.log(f"Exported {len(_FAVORITES)} favourites to {path}", "ok")
        except Exception as e:
            self._slog.log(f"Export failed: {e}", "error")

    def _import_favourites(self):
        path = filedialog.askopenfilename(
            filetypes=[("JSON Files", "*.json")]
        )
        if not path:
            return
        try:
            with open(path, 'r') as f:
                data = json.load(f)
            if isinstance(data, list):
                global _FAVORITES
                _FAVORITES = set(str(x) for x in data)
                self._slog.log(f"Imported {len(_FAVORITES)} favourites from {path}", "ok")
                # Refresh any visible favourites
                if hasattr(self, '_fgrid'):
                    self._load_favourites()
            else:
                self._slog.log("Invalid favourites file format.", "error")
        except Exception as e:
            self._slog.log(f"Import failed: {e}", "error")

    def _save_cfg(self):
        for k,v in self._sv.items(): self._cfg[k]=v.get()
        self._cfg["include_dlc"]=self._dlc_sv.get()
        self._cfg["skip_music"]=self._skip_music_sv.get()
        self._cfg["auto_start"]=self._auto_start_sv.get()
        self._cfg["backup_lua"]=self._backup_lua_sv.get()
        
        # Apply auto-start to Windows registry
        try:
            import winreg
            key_path = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE)
            if self._auto_start_sv.get():
                if getattr(sys, 'frozen', False):
                    exe_path = os.path.abspath(sys.executable)
                else:
                    exe_path = os.path.abspath(sys.argv[0])
                winreg.SetValueEx(key, "AHG Steam Unlocker", 0, winreg.REG_SZ, f'"{exe_path}"')
            else:
                try:
                    winreg.DeleteValue(key, "AHG Steam Unlocker")
                except FileNotFoundError:
                    pass
            winreg.CloseKey(key)
        except Exception as e:
            self._slog.log(f"Auto-start setting: {e}", "warn")
        
        save_cfg(self._cfg)
        self._dlc.set(self._cfg["include_dlc"])
        self._slog.log("Settings saved.","ok")

    def _toggle_view_mode(self, _=None):
        """Toggle between list and grid view"""
        current = self._view_mode.get()
        new_mode = "grid" if current == "list" else "list"
        self._view_mode.set(new_mode)
        
        # Update button icon 
        if hasattr(self, '_view_btn'):
            for child in self._view_btn.winfo_children():
                child.configure(text="☰" if new_mode == "grid" else "▦")
        
        # Save to config
        self._cfg["view_mode"] = new_mode
        save_cfg(self._cfg)
        
        # Apply view mode to grid
        if hasattr(self, '_rgrid'):
            self._rgrid.set_view_mode(new_mode)
        
        # Show notification
        self._slog.log(f"View mode: {new_mode}", "ok")
    
    def _toggle_theme(self, _=None):
        """Toggle between dark and light theme"""
        current_theme = self._cfg.get("theme", "dark")
        new_theme = "light" if current_theme == "dark" else "dark"
        
        # Get new colors
        colors = get_theme_colors(new_theme)
        
        # Update global color variables
        global BG_MAIN, BG_CARD, BG_HOVER, BG_ACTIVE, BG_DARK, BG_DEEP
        global TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, BORDER, SURFACE, SIDEBAR, ACCENT
        BG_DEEP = colors["bg_deep"]
        BG_DARK = colors["bg_dark"]
        BG_MAIN = colors["bg_main"]
        BG_CARD = colors["bg_card"]
        BG_HOVER = colors["bg_hover"]
        BG_ACTIVE = colors["bg_active"]
        TEXT_PRIMARY = colors["text_primary"]
        TEXT_SECONDARY = colors["text_secondary"]
        TEXT_MUTED = colors["text_muted"]
        BORDER = colors.get("border", "#2d2d3d")
        SURFACE = colors.get("surface", "#1e1e2d")
        SIDEBAR = colors.get("sidebar", "#12121f")
        ACCENT = colors.get("accent", "#8b5cf6")
        
        # Update theme button icon
        if hasattr(self, '_theme_btn'):
            for child in self._theme_btn.winfo_children():
                child.configure(text="☀️" if new_theme == "light" else "🌙")
        
        # Save to config
        self._cfg["theme"] = new_theme
        save_cfg(self._cfg)
        
        # Show notification
        self._slog.log(f"Theme: {new_theme} applied", "ok")
        
        # Force destroy and rebuild the main window to refresh all colors
        # This is more reliable than trying to update individual widgets
        if hasattr(self, '_root') and self._root.winfo_exists():
            current_page = getattr(self, '_page', 'home')
            # Destroy all pages
            for pid, page in self._pages.items():
                try:
                    page.destroy()
                except Exception:
                    logging.debug("Failed to destroy page during rebuild", exc_info=True)
            self._pages = {}
            # Rebuild all pages
            self._build_home()
            self._build_favourites()
            self._build_recent()
            self._build_collections()
            self._build_library()
            self._build_fixes()
            self._build_settings()
            # Navigate back to the current page
            self._show(current_page)
    
def _show_game_details(self, appid, game_name):
    """Show game details in a popup panel"""
    # Get game data
    game_data = _ALL_GAMES_DATA.get(appid, {})
    
    # Create popup window
    top = tk.Toplevel(self._root)
    top.title(f"{game_name}")
    top.geometry("650x600")
    top.configure(bg=BG_MAIN)
    
    # Header with game name and image
    hdr = tk.Frame(top, bg=ACCENT, height=80)
    hdr.pack(fill="x")
    hdr.pack_propagate(False)
    
    # Try to show header image
    header_url = game_data.get("header_image", "")
    if header_url:
        try:
            from urllib.request import urlopen
            from PIL import Image
            import io
            img_data = urlopen(header_url, timeout=5).read()
            img = Image.open(io.BytesIO(img_data)).resize((200, 80), Image.LANCZOS)
            header_img = ImageTk.PhotoImage(img)
            img_label = tk.Label(hdr, image=header_img, bg=ACCENT)
            img_label.image = header_img
            img_label.pack(side="left", padx=10, pady=5)
        except Exception:
            logging.debug("Failed to load header image for game detail")
    
    # Game title
    title_frame = tk.Frame(hdr, bg=ACCENT)
    title_frame.pack(side="left", fill="both", expand=True)
    
    tk.Label(title_frame, text=game_name, font=(FN,16,"bold"), 
            fg=WHITE, bg=ACCENT, wraplength=350).pack(anchor="w", padx=10, pady=(15,5))
    
    # App ID
    tk.Label(title_frame, text=f"App ID: {appid}", font=(FN,10), 
            fg="#ddd", bg=ACCENT).pack(anchor="w", padx=10)
    
    # Close button
    close_btn = tk.Label(hdr, text="✕", font=(FN,14), bg=ACCENT, fg=WHITE, cursor="hand2")
    close_btn.pack(side="right", padx=10)
    close_btn.bind("<Button-1>", lambda _: top.destroy())
    
    # Content frame
    content = tk.Frame(top, bg=BG_MAIN)
    content.pack(fill="both", expand=True, padx=20, pady=15)
    
    # Info section
    info_frame = tk.Frame(content, bg=BG_CARD, bd=1, relief="solid")
    info_frame.pack(fill="x", pady=(0,15))
    
    # DRM Status
    has_drm = game_data.get('drm', False)
    drm_text = "🔒 DRM Protected" if has_drm else "✅ No DRM"
    drm_color = ERROR if has_drm else SUCCESS
    
    tk.Label(info_frame, text="Security", font=(FN,11,"bold"), 
            fg=TEXT_MUTED, bg=BG_CARD, padx=15, pady=8).pack(anchor="w")
    tk.Label(info_frame, text=drm_text, font=(FN,12), 
            fg=drm_color, bg=BG_CARD, padx=15, pady=(0,10)).pack(anchor="w")
    
    # Tags
    tags = game_data.get('tags', [])
    if tags:
        tk.Label(info_frame, text="Categories", font=(FN,11,"bold"), 
                fg=TEXT_MUTED, bg=BG_CARD, padx=15, pady=(10,5)).pack(anchor="w")
        tags_frame = tk.Frame(info_frame, bg=BG_CARD)
        tags_frame.pack(fill="x", padx=15, pady=(0,10))
        
        for tag in tags[:6]:
            tk.Label(tags_frame, text=tag, font=(FN,9), 
                    fg=ACCENT, bg=BG_ACTIVE, padx=8, pady=3).pack(side="left", padx=2, pady=2)
    
    # Action buttons
    btn_frame = tk.Frame(content, bg=BG_MAIN)
    btn_frame.pack(fill="x", pady=10)
    
    # Favorite button
    is_fav = str(appid) in _FAVORITES
    fav_text = "★ Favorited" if is_fav else "☆ Add to Favorites"
    RoundedBtn(btn_frame, fav_text, lambda: self._toggle_fav_details(appid, top),
              bg=ACCENT if is_fav else MUTED, fg=WHITE, fs=10, pady=8, padx=20).pack(side="left", padx=5)
    
    # Add to Collection button
    RoundedBtn(btn_frame, "📁 Add to Collection", lambda: self._add_to_collection_menu(appid, top),
              bg="#14b8a6", fg=WHITE, fs=10, pady=8, padx=15).pack(side="left", padx=5)
    
    # Install button
    RoundedBtn(btn_frame, "🎮 Install Game", lambda: self._quick_install(appid, game_name),
              bg=SUCCESS, fg=WHITE, fs=10, pady=8, padx=20).pack(side="right", padx=5)
    
    # Mark as recently played
    add_to_recently_played(appid)
    
    # Add to activity log
    add_activity_log("Viewed Game", f"{game_name} (AppID: {appid})")

def _add_to_collection_menu(self, appid, parent_window):
    """Show menu to add game to a collection"""
    collections = get_collections()
    
    if not collections:
        # Create new collection
        self._create_collection()
        return
    
    # Create popup menu
    top = tk.Toplevel(self._root)
    top.title("Add to Collection")
    top.geometry("300x350")
    top.configure(bg=BG_MAIN)
    
    tk.Label(top, text="Select Collection", font=(FN,14,"bold"), 
            fg=WHITE, bg=BG_MAIN, pady=10).pack()
    
    scroll_frame = tk.Frame(top, bg=BG_MAIN)
    scroll_frame.pack(fill="both", expand=True, padx=10)
    
    for name, games in collections.items():
        btn = tk.Button(scroll_frame, text=f"📁 {name} ({len(games)} games)", 
                      font=(FN,11), bg=BG_CARD, fg=WHITE, anchor="w",
                      command=lambda n=name: self._add_game_to_collection(appid, n, top))
        btn.pack(fill="x", pady=3)
    
    # New collection button
    tk.Button(top, text="+ Create New Collection", font=(FN,11), 
             bg=ACCENT, fg=WHITE, command=lambda: (top.destroy(), self._create_collection())).pack(pady=10)

def _add_game_to_collection(self, appid, collection_name, window):
    """Add a game to a collection"""
    collections = get_collections()
    if collection_name in collections:
        if appid not in collections[collection_name]:
            collections[collection_name].append(appid)
            save_collection(collection_name, collections[collection_name])
            self._slog.log(f"Added to {collection_name}", "ok")
    window.destroy()

def _toggle_fav_details(self, appid, window):
    """Toggle favorite from details window"""
    is_fav = toggle_favorite(appid)
    self._slog.log(f"{'Added to' if is_fav else 'Removed from'} favorites", "ok")

def _quick_favorite(self, _=None):
    """Quick toggle favorite for selected game (Ctrl+D)"""
    if hasattr(self, '_sel_appid') and self._sel_appid:
        is_fav = toggle_favorite(self._sel_appid)
        self._slog.log(f"{'Added to' if is_fav else 'Removed from'} favorites", "ok")
    else:
        self._slog.log("No game selected", "warn")

def _quick_install(self, appid):
    """Quick install from details"""
    # Trigger install
    self._hlog.log(f"Installing appid {appid}...", "info")
    # Implementation would call actual install method
    self._slog.log(f"Install queued for {appid}", "info")

def _get_cfg(self):
    s=dict(self._cfg)
    for k,v in self._sv.items(): s[k]=v.get()
    s["include_dlc"]=self._dlc.get()
    s["skip_music"]=self._skip_music_sv.get()
    s["auto_start"]=self._auto_start_sv.get()
    s["backup_lua"]=self._backup_lua_sv.get()
    return s

# ─────────────────────────────────────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def check_license():
    # IMPORTANT: Once activated on this device, NEVER show activation again
    # This permanently locks license to the device
    license_data = _load_local_license()
    
    # If this device was previously activated, always allow - device is locked
    if license_data and license_data.get("activated"):
        stored_machine = license_data.get("machine_id", "")
        current_machine = _get_machine_id()
        
        # Device match - permanently activated on this device
        if stored_machine == current_machine:
            return True  # ALWAYS allow - no re-activation needed
    
    # Not activated or different device - show activation window
    return False

def launch_main_app():
    global PIL_OK
    if not PIL_OK:
        try:
            subprocess.check_call([sys.executable,"-m","pip",
                                   "install","Pillow","--quiet"])
            from PIL import Image,ImageTk,ImageDraw
            PIL_OK = True
        except Exception:
            logging.warning("Failed to auto-install Pillow", exc_info=True)
    
    app = App()
    app.mainloop()

if __name__ == "__main__":
    # Check local license - if activated on this device, never show window again
    if check_license():
        launch_main_app()
    else:
        LicenseWindow()
