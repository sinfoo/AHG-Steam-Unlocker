from _path_utils import data_path
"""
Comprehensive DRM Detection for 62,000+ Steam Games
This script analyzes all games and marks those that:
1. Require third-party launchers (EA, Ubisoft, Epic, Battle.net, Rockstar, etc.)
2. Are online-only (require internet/servers to play)
3. Won't work with manifest-only installation
"""

import json
import re
from collections import defaultdict

# Third-party launcher detection - by publisher/developer patterns
LAUNCHER_PUBLISHERS = {
    # EA (Electronic Arts) - requires EA App
    "ea", "electronic arts", "electronic arts inc.", "dice", "bioware", 
    "criterion games", "ghost games", "visceral games", "bullfrog",
    "origin", "popcap", "maxis", "road to hell", "clever programming",
    
    # Ubisoft - requires Ubisoft Connect
    "ubisoft", "ubisoft entertainment", "ubisoft montreal", "ubisoft toronto",
    "ubisoft paris", "ubisoft milan", "ubisoft shanghai", "red storm",
    "massive entertainment", "gameloft", "annvil", "sunflowergames",
    
    # Epic Games - requires Epic Games Store
    "epic games", "epic", "unreal engine", "people can fly", "armor studios",
    "rocket league", "fortnite", "twisted metal",
    
    # Battle.net/Blizzard - requires Battle.net
    "blizzard", "blizzard entertainment", "activision", "activision blizzard",
    "treyarch", "infinity ward", "sledgehammer games", "raven software",
    "bungie", "king",
    
    # Rockstar Games - requires Rockstar Games Launcher
    "rockstar", "rockstar games", "rockstar north", "rockstar san diego",
    "rockstar toronto", "rockstar Leeds", "rockstar new england",
    
    # Microsoft/Xbox - requires Xbox app
    "microsoft", "xbox game studios", "mojang", "playground games",
    "turn 10", "rare", "coalition", "obsidian", "inXile", "double fine",
    
    # Other third-party
    "stardock", "gog", "galaxy", "square enix", "sega", "bandai namco",
    "capcom", "koei tecmo", "koch media", "deep silver", "nacon",
    "sherman", "tinybuild", "devolver", "curve digital", "teardown",
}

# Keywords that indicate online-only/multiplayer games
ONLINE_KEYWORDS = [
    "online", "multiplayer", "mmo", "mmorpg", "fps", "battle royale",
    "pvp", "co-op", "coop", "competitive", "esports", "arena",
    "shooter", "moba", "survival", "online only", "live", "xbox live",
    "game pass", "subscription", "crossplay", "server", "dedicated",
]

# Game name patterns that indicate problematic games (won't work with manifest-only)
MANIFEST_ISSUES = [
    "arcade", "arcade", "live", "demo", "trial", "beta", "alpha",
    "test", "demo", "stress test", "technical test", "closed beta",
    "open beta", "early access", "season", "pass", "subscription",
    "game pass", "xbox", "cloud", "streaming", "stadia", "playstation now",
]

# Known problematic game names (manifest issues, online-only that don't work)
KNOWN_ONLINE_ONLY = [
    # These games REQUIRE Steam servers to be online - manifest-only won't work
    "pubg", "battleroyale", "apex legends", "destiny", "destiny 2",
    "call of duty", "warzone", "overwatch", "fortnite", "rocket league",
    "league of legends", "valorant", "csgo", "counter-strike", "dota",
    "rust", "helldivers", "rainbow six", "siege", "gta online",
    "grand theft auto online", "the division", "lost ark",
    "path of exile", "warframe", "world of warships", "world of tanks",
    "blitz", "brawl stars", "clash of clans", "clash royale",
    # Games that need additional downloads/install after Steam install
    "sea of thieves", "forza horizon", "minecraft", "minecraft dunge",
    "game pass", "xbox", "phantasy star online", "pso2",
    # Arcade-style games that need authentication
    "arc raiders", "the first descendant",
]

# Specific games known to not work with manifest-only (researched from Reddit/SteamDB)
# These are games that require online authentication, third-party launchers, or have anti-cheat issues
MANIFEST_FAIL_GAMES = {
    # User-mentioned games (correct appids)
    "1808500": "ARC Raiders",
    "2715900": "Grand Theft Auto V",
    "3240220": "Grand Theft Auto V Enhanced",
    "252490": "Rust",
    "359550": "Tom Clancy's Rainbow Six Siege",
    "3405690": "EA SPORTS FC 26",
    "2669320": "EA SPORTS FC 25",
    "2195250": "EA SPORTS FC 24",
    "553850": "HELLDIVERS 2",
    "2074920": "The First Descendant",
    
    # More popular online games that won't work with manifest-only
    "1174050": "Arc Raiders",  # Different appid
    "1091500": "DOOM Eternal",
    "752590": "Anno 1800",
    "814380": "The Settlers",
    "812780": "Anno 2205",
    "761890": "The Crew 2",
    "990080": "The Crew",
    "1551360": "STALKER 2",
    "1466060": "Hogwarts Legacy",
    "1593500": "Palworld",
    "1671480": "Palworld",
    "1817070": "Undawn",
    "2120300": "Starfield",
    "2221490": "Indiana Jones",
    "2358720": "Avatar: Frontiers of Pandora",
    
    # More EA games
    "1293830": "Mass Effect Legendary Edition",
    "1313140": "Dragon Age: The Veilguard",
    "1943980": "Star Wars Jedi: Survivor",
    "1845810": "Star Wars Battlefront II",
    "1963720": "Star Wars: Squadrons",
    "1875910": "Star Wars Jedi: Fallen Order",
    
    # More Ubisoft games
    "814380": "The Settlers",
    "812780": "Anno 2205",
    "1332010": "Sons of the Forest",
}

def load_games():
    with open(data_path('games.json'), 'r', encoding='utf-8') as f:
        return json.load(f)

def is_third_party_launcher_game(game):
    """Check if game requires third-party launcher"""
    name = game.get('name', '').lower()
    dev = game.get('developer', '').lower() if 'developer' in game else ''
    pub = game.get('publisher', '').lower() if 'publisher' in game else ''
    tags = game.get('tags', [])
    tags_str = ' '.join(tags).lower() if tags else ''
    
    text = f"{name} {dev} {pub} {tags_str}"
    
    for publisher in LAUNCHER_PUBLISHERS:
        if publisher in text:
            return True
    
    return False

def is_online_only(game):
    """Check if game is online-only and won't work without servers"""
    name = game.get('name', '').lower()
    tags = game.get('tags', [])
    tags_str = ' '.join(tags).lower() if tags else ''
    
    text = f"{name} {tags_str}"
    
    # Check known online-only games
    for kw in KNOWN_ONLINE_ONLY:
        if kw in text:
            return True
    
    # Check online keywords
    online_count = 0
    for kw in ONLINE_KEYWORDS:
        if kw in text:
            online_count += 1
    
    # If multiple online keywords, likely online-only
    if online_count >= 2:
        return True
    
    # Check for game pass/xbox cloud - these won't work with manifest
    if "game pass" in text or "xbox cloud" in text or "xbox play" in text:
        return True
    
    return False

def has_manifest_issues(game):
    """Check if game has known manifest installation issues"""
    appid = str(game.get('appid', ''))
    name = game.get('name', '').lower()
    
    # Check known manifest failure games
    if appid in MANIFEST_FAIL_GAMES:
        return True
    
    # Check name patterns
    for pattern in MANIFEST_ISSUES:
        if pattern in name:
            # Exclude some false positives
            if "demo" in name and len(name) < 30:
                return True
            if "beta" in name and len(name) < 40:
                return True
            if "alpha" in name and len(name) < 40:
                return True
    
    return False

def detect_drm(game):
    """Main DRM detection function"""
    # Check if requires third-party launcher
    if is_third_party_launcher_game(game):
        return "launcher"
    
    # Check if online-only (won't work without servers)
    if is_online_only(game):
        return "online"
    
    # Check for manifest issues
    if has_manifest_issues(game):
        return "manifest"
    
    return False

def analyze_games():
    """Analyze all games and collect DRM info"""
    games = load_games()
    
    results = {
        'launcher': [],
        'online': [],
        'manifest': [],
        'none': []
    }
    
    drm_games = set()
    
    for game in games:
        appid = str(game.get('appid', ''))
        name = game.get('name', 'Unknown')
        
        drm_type = detect_drm(game)
        
        if drm_type:
            results[drm_type].append((appid, name))
            drm_games.add(appid)
            # Update the game's drm field
            game['drm'] = True
    
    print(f"Total games analyzed: {len(games)}")
    print(f"Games with DRM detection: {len(drm_games)}")
    print(f"  - Third-party launcher: {len(results['launcher'])}")
    print(f"  - Online-only: {len(results['online'])}")
    print(f"  - Manifest issues: {len(results['manifest'])}")
    
    # Save updated games.json
    with open(data_path('games.json'), 'w', encoding='utf-8') as f:
        json.dump(games, f, ensure_ascii=False, indent=2)
    
    print("\nUpdated games.json with DRM info")
    
    return results, drm_games

if __name__ == "__main__":
    results, drm_games = analyze_games()
    
    # Print sample of each category
    print("\n=== Sample Third-Party Launcher Games ===")
    for appid, name in results['launcher'][:20]:
        print(f"  {appid}: {name}")
    
    print("\n=== Sample Online-Only Games ===")
    for appid, name in results['online'][:20]:
        print(f"  {appid}: {name}")