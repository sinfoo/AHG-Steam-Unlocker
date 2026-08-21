from _path_utils import data_path
"""
Comprehensive DRM Detection - Version 3 (Final)
Enhanced detection based on research:
- Third-party launchers (EA, Ubisoft, Epic, Battle.net, Rockstar, Microsoft)
- Anti-cheat games (EAC, BattlEye, VAC, XIGNCODE3, etc.) won't work with manifest-only
- Online-only games (require constant server connection)
- Games requiring additional online authentication
"""

import json

# Anti-cheat keywords - games with these won't work with manifest-only
ANTICHEAT_KEYWORDS = [
    "easy anti-cheat", "eac", "battleye", "battleeye", "vac", "valve anti-cheat",
    "xigncode3", "denuvo", "securom", "protect", "kernel", "anti-cheat", "anticheat",
    "fairfight", "punkbuster", "ace anti-cheat", "neac", "xigncode", "heroic",
    "gameguard", "nprotect", "hackshield", " warden", "esea", "faceit", "esl",
]

# Third-party launchers
LAUNCHER_PUBLISHERS = {
    # EA
    "ea", "electronic arts", "dice", "bioware", "criterion", "ghost games",
    "visceral", "bullfrog", "popcap", "maxis", "origin", "motive", "ripley",
    # Ubisoft
    "ubisoft", "ubisoft montreal", "toronto", "paris", "milan", "shanghai",
    "red storm", "massive", "annvil", "sunflower", "i用",
    # Epic
    "epic games", "unreal engine", "people can fly", "rocket league",
    # Blizzard
    "blizzard", "activision", "treyarch", "infinity ward", "sledgehammer",
    "raven software", "bungie", "king",
    # Rockstar
    "rockstar games", "rockstar north", "rockstar san diego", "rockstar toronto",
    # Microsoft
    "microsoft", "xbox game studios", "mojang", "playground games", "turn 10",
    "rare", "coalition", "obsidian", "inXile", "double fine",
    # More
    "square enix", "sega", "bandai namco", "capcom", "koei tecmo", "koch media",
    "deep silver", "nacon", "505 games", "thqnordic", "paradox",
}

# Online-only keywords
ONLINE_KEYWORDS = [
    "online", "multiplayer", "mmo", "mmorpg", "fps", "battle royale",
    "pvp", "co-op", "coop", "competitive", "esports", "arena",
    "shooter", "moba", "survival", "live", "xbox live", "crossplay",
    "game pass", "subscription", "server", "dedicated",
]

# Known problematic games (won't work with manifest-only)
# Expanded list with more DLC-heavy games and manifest issues
MANIFEST_FAIL = {
    # User mentioned
    "1808500": "ARC Raiders", "2715900": "GTA V", "3240220": "GTA V Enhanced",
    "252490": "Rust", "359550": "Rainbow Six Siege",
    "3405690": "FC 26", "2669320": "FC 25", "2195250": "FC 24",
    "553850": "HELLDIVERS 2", "2074920": "The First Descendant",
    # More popular games
    "730": "Counter-Strike 2", "570": "Dota 2", "440": "Team Fortress 2",
    "550": "Left 4 Dead 2", "500": "Left 4 Dead",
    "1091500": "DOOM Eternal", "752590": "Anno 1800", "814380": "The Settlers",
    "812780": "Anno 2205", "761890": "The Crew 2", "1551360": "STALKER 2",
    "1466060": "Hogwarts Legacy", "1593500": "Palworld", "2120300": "Starfield",
    "2221490": "Indiana Jones", "2358720": "Avatar", "1293830": "Mass Effect",
    "1313140": "Dragon Age Veilguard", "1943980": "Star Wars Jedi Survivor",
    "1845810": "Star Wars Battlefront II", "1875910": "Star Wars Jedi Fallen Order",
    "1332010": "Sons of the Forest", "548430": "Deep Rock Galactic",
    "219990": "SCUM", "2819750": "Once Human", "2322010": "Mortal Kombat 1",
    "1063730": "Fortnite", "1071210": "Fall Guys", "175400": "The Forest",
    "251570": "Killing Floor 2", "294100": "Raft", "2389610": "Brotato",
    # More online games
    "271590": "GTA IV", "12210": "GTA Episodes", "12120": "GTA San Andreas",
    "12100": "GTA III", "12110": "GTA Vice City",
    "1328670": "Mortal Shell", "1240440": "Wildermyth",
    # Anti-cheat games
    "1091500": "DOOM Eternal", "1174050": "Arcade Paradise",
    "895650": "Mortal Kombat 11", "322170": "Dead by Daylight",
    "1018800": "The Escapists 2", "495420": "沈没之城",
    "1086940": "The Pathless", "1115650": "Control", "1120400": "Quantum Break",
    # DLC-heavy games (often have issues with manifests)
    "374320": "Total War: WARHAMMER III", "376300": "Total War: WARHAMMER II",
    "594570": "Total War: WARHAMMER", "3640": "Total War: Shogun 2",
    "3370": "Total War: Empire", "3700": "Total War: Napoleon",
    "48700": "Total War: Medieval II", "47700": "Total War: Medieval",
    "1210": "Total War: Empire", "4700": "Total War: Shogun",
    # Paradox games (often DLC-dependent)
    "39210": "Crusader Kings II", "203770": "Crusader Kings III",
    "210290": "Hearts of Iron IV", "206350": "Europa Universalis IV",
    "28150": "Stellaris", "108550": "Cities: Skylines",
    "230410": "Surviving Mars", "281940": "Surviving the Aftermath",
    # More EA games
    "12210": "The SIMS 4", "729040": "The SIMS 3", "48700": "Crusader Kings II",
    "1817070": "Undawn", "1693980": "F1 22", "1674920": "F1 23",
    "1938010": "EA SPORTS FC 25", "2503730": "EA SPORTS FC 26",
    # DLCs that need separate manifest
    "303921": "DLC: Far Harbor", "305863": "DLC: Automatron",
    "346110": "DLC: Dragonborn", "325109": "DLC: Dawnguard",
    # More Ubisoft
    "814380": "The Settlers", "812780": "Anno 2205",
    "264143": "DLC: Hard Mode", "264144": "DLC: Permadeath",
    # Rockstar
    "2715900": "GTA V", "3240220": "GTA V Enhanced Edition",
    "3025": "L.A. Noire",
    # Microsoft/Xbox
    "1593500": "Palworld", "1671480": "Palworld", "753420": "Pentiment",
    "2000": "Age of Empires II", "1468810": "Age of Empires III",
    "813780": "Age of Empires IV", "1846440": "Age of Empire Definitive",
    # More online/shooter
    "1174180": "Red Dead Redemption 2", "885810": "RED DEAD ONLINE",
    "1086940": "The Pathless", "1693710": "F1 24",
}
    # EA games
    "1845810": "Star Wars Battlefront II", "1943980": "Jedi Survivor",
    "1952600": "Plants vs Zombies Battle for Neighborville",
    "1313140": "Dragon Age Veilguard", "1293830": "Mass Effect Legendary",
    # Ubisoft
    "814380": "The Settlers", "812780": "Anno 2205", "761890": "The Crew 2",
    "1332010": "Sons of the Forest", "1551360": "STALKER 2",
}

# Specific online-only games
KNOWN_ONLINE_ONLY = [
    "pubg", "battleroyale", "apex legends", "destiny", "destiny 2",
    "call of duty", "warzone", "overwatch", "overwatch 2", "fortnite",
    "rocket league", "league of legends", "valorant", "csgo", "counter-strike",
    "dota", "rust", "helldivers", "rainbow six", "siege", "gta online",
    "grand theft auto online", "the division", "lost ark", "path of exile",
    "warframe", "world of warships", "world of tanks", "blitz", "brawl stars",
    "sea of thieves", "forza horizon", "minecraft", "phantasy star online",
    "pso2", "arc raiders", "the first descendant", "the finals", "marvel rivals",
    "xdefiant", "diablo 4", "diablo 2", "overwatch", "battlefield",
    "halo infinite", "ground branch", "squad", "post scriptum",
    "insurgency sandstorm", "hell let loose", "foxhole", "eve online",
    "albion online", "escape from tarkov", "dayz", "pubg", "hunt showdown",
    "rust", "ark", "conan exiles", "the forest", "7 days to die",
    "unturned", "gta v", "gta online", "roblox", "roblox player",
]

def load_games():
    with open(data_path('games.json'), 'r', encoding='utf-8') as f:
        return json.load(f)

def has_anticheat(game):
    """Check if game has anti-cheat - these won't work with manifest-only"""
    name = game.get('name', '').lower()
    tags = game.get('tags', [])
    tags_str = ' '.join(tags).lower() if tags else ''
    
    text = f"{name} {tags_str}"
    
    for kw in ANTICHEAT_KEYWORDS:
        if kw in text:
            return True
    return False

def has_third_party_launcher(game):
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
    
    # Check known online-only
    for kw in KNOWN_ONLINE_ONLY:
        if kw in text:
            return True
    
    # Check online keywords
    count = sum(1 for kw in ONLINE_KEYWORDS if kw in text)
    if count >= 2:
        return True
    
    if "game pass" in text or "xbox cloud" in text:
        return True
    
    return False

def is_manifest_fail(game):
    """Check known manifest failures"""
    appid = str(game.get('appid', ''))
    return appid in MANIFEST_FAIL

def detect_drm(game):
    """Main DRM detection - returns True if game has DRM issues"""
    if has_anticheat(game):
        return True
    if has_third_party_launcher(game):
        return True
    if is_online_only(game):
        return True
    if is_manifest_fail(game):
        return True
    return False

def analyze_games():
    games = load_games()
    
    stats = {'anticheat': 0, 'launcher': 0, 'online': 0, 'manifest': 0, 'total': 0}
    
    for game in games:
        drm_type = None
        
        if has_anticheat(game):
            drm_type = 'anticheat'
        elif has_third_party_launcher(game):
            drm_type = 'launcher'
        elif is_online_only(game):
            drm_type = 'online'
        elif is_manifest_fail(game):
            drm_type = 'manifest'
        
        if drm_type:
            game['drm'] = True
            stats[drm_type] += 1
            stats['total'] += 1
        else:
            game['drm'] = False
    
    print(f"Total games: {len(games)}")
    print(f"DRM Detection Results:")
    print(f"  - Anti-cheat games: {stats['anticheat']}")
    print(f"  - Third-party launcher: {stats['launcher']}")
    print(f"  - Online-only: {stats['online']}")
    print(f"  - Known manifest failures: {stats['manifest']}")
    print(f"  - TOTAL DRM-protected: {stats['total']}")
    
    with open(data_path('games.json'), 'w', encoding='utf-8') as f:
        json.dump(games, f, ensure_ascii=False, indent=2)
    
    print("\nUpdated games.json")

if __name__ == "__main__":
    analyze_games()