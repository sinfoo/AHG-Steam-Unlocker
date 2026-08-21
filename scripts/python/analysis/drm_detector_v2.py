from _path_utils import data_path
"""
Comprehensive DRM Detection - Version 2
Enhanced detection for all 62,000+ games based on:
- Third-party launchers (EA, Ubisoft, Epic, Battle.net, Rockstar, Microsoft)
- Online-only games (require constant server connection)
- Games with anti-cheat that won't work with manifest-only
- Games that require additional downloads/install beyond manifest
"""

import json

# Publisher patterns for third-party launchers
LAUNCHER_PUBLISHERS = {
    # EA - requires EA App
    "ea", "electronic arts", "dice", "bioware", "criterion games", "ghost games",
    "visceral games", "bullfrog", "popcap", "maxis", "origin", "clever programming",
    "motive", "ripley", "industrial toys",
    
    # Ubisoft - requires Ubisoft Connect
    "ubisoft", "ubisoft montreal", "ubisoft toronto", "ubisoft paris", "ubisoft milan",
    "ubisoft shanghai", "red storm", "massive entertainment", "annvil", "sunflowergames",
    "i用", "ghost replay", "kano", "rodent",
    
    # Epic - requires Epic Games Store
    "epic games", "unreal engine", "people can fly", "armor studios", "rocket league",
    "twisted metal", "armor", "supermassive games",
    
    # Battle.net/Blizzard
    "blizzard", "blizzard entertainment", "activision", "activision blizzard",
    "treyarch", "infinity ward", "sledgehammer games", "raven software",
    "bungie", "king", "metalhead software",
    
    # Rockstar - requires Rockstar Games Launcher
    "rockstar games", "rockstar north", "rockstar san diego", "rockstar toronto",
    "rockstar leeds", "rockstar new england", "rockstar london",
    
    # Microsoft/Xbox
    "microsoft", "xbox game studios", "mojang", "playground games",
    "turn 10", "rare", "coalition", "obsidian", "inXile", "double fine",
    "the coalition", " Ninja Theory", "compulsion games",
    
    # More publishers
    "square enix", "sega", "bandai namco", "capcom", "koei tecmo", "koch media",
    "deep silver", "nacon", "sherman", "tinybuild", "devolver", "curve digital",
    "teardown", "505 games", "thqnordic", "paradox", "nvidia",
    "stardock", "galaxy", "tencent", "nexon", "ncsoft",
}

# Keywords for online-only games
ONLINE_KEYWORDS = [
    "online", "multiplayer", "mmo", "mmorpg", "fps", "battle royale",
    "pvp", "co-op", "coop", "competitive", "esports", "arena",
    "shooter", "moba", "survival", "live", "xbox live",
    "game pass", "subscription", "crossplay", "server", "dedicated",
]

# Known problematic games (won't work with manifest-only)
MANIFEST_FAIL_GAMES = {
    # User mentioned
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
    
    # Popular online games
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
    "1293830": "Mass Effect Legendary Edition",
    "1313140": "Dragon Age: The Veilguard",
    "1943980": "Star Wars Jedi: Survivor",
    "1845810": "Star Wars Battlefront II",
    "1963720": "Star Wars: Squadrons",
    "1875910": "Star Wars Jedi: Fallen Order",
    "1332010": "Sons of the Forest",
    "548430": "Deep Rock Galactic",
    
    # More online/multiplayer
    "1174050": "Arcade Paradise",
    "730": "Counter-Strike 2",
    "570": "Dota 2",
    "440": "Team Fortress 2",
    "550": "Left 4 Dead 2",
    "500": "Left 4 Dead",
    "2389610": "Brotato",
    "990080": "The Crew",
    "175400": "The Forest",
    "251570": "Killing Floor 2",
    "294100": "Raft",
    "548430": "Deep Rock Galactic",
    "1328670": "Mortal Shell",
    "1240440": "Wildermyth",
    "1313140": "Dragon Age: The Veilguard",
    "1328690": "The Last Case of Benedict Fox",
    "219990": "SCUM",
    "2819750": "Once Human",
    "2322010": "Mortal Kombat 1",
    "1063730": "Fortnite",
    "1071210": "Fall Guys",
}

# Keywords that indicate online-only games
KNOWN_ONLINE_ONLY = [
    "pubg", "battleroyale", "apex legends", "destiny", "destiny 2",
    "call of duty", "warzone", "overwatch", "fortnite", "rocket league",
    "league of legends", "valorant", "csgo", "counter-strike", "dota",
    "rust", "helldivers", "rainbow six", "siege", "gta online",
    "grand theft auto online", "the division", "lost ark",
    "path of exile", "warframe", "world of warships", "world of tanks",
    "blitz", "brawl stars", "clash of clans", "clash royale",
    "sea of thieves", "forza horizon", "minecraft", "game pass",
    "phantasy star online", "pso2", "arc raiders", "the first descendant",
    "the finals", "marvel rivals", "xdefiant", "diablo 4", "destiny 2",
    "overwatch 2", "call of duty warzone", "battlefield", "halo infinite",
    "ground branch", "squad", "post scriptum", "insurgency sandstorm",
    "hell let loose", "foxhole", "eve online", "albion online",
]

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
    """Check if game is online-only"""
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
    
    if online_count >= 2:
        return True
    
    if "game pass" in text or "xbox cloud" in text:
        return True
    
    return False

def has_manifest_issues(game):
    """Check if game has manifest installation issues"""
    appid = str(game.get('appid', ''))
    name = game.get('name', '').lower()
    
    if appid in MANIFEST_FAIL_GAMES:
        return True
    
    return False

def detect_drm(game):
    """Main DRM detection"""
    if is_third_party_launcher_game(game):
        return "launcher"
    if is_online_only(game):
        return "online"
    if has_manifest_issues(game):
        return "manifest"
    return False

def analyze_games():
    games = load_games()
    
    results = {'launcher': 0, 'online': 0, 'manifest': 0, 'none': 0}
    
    for game in games:
        drm_type = detect_drm(game)
        if drm_type:
            game['drm'] = True
            results[drm_type] += 1
        else:
            game['drm'] = False
    
    print(f"Total games: {len(games)}")
    print(f"Results: {results}")
    print(f"Total DRM: {sum(results.values())}")
    
    with open(data_path('games.json'), 'w', encoding='utf-8') as f:
        json.dump(games, f, ensure_ascii=False, indent=2)
    
    print("\nUpdated games.json")

if __name__ == "__main__":
    analyze_games()