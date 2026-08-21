from _path_utils import get_all_games
data = get_all_games()

GENRE_KEYWORDS = {
    "Action": ["action", "shooter", "combat", "fight", "hack", "slash", "war", "gun", "fps", "shoot", "violent", "valve", "portal", "left 4 dead", "counter-strike", "team fortress", "day of defeat", "half-life", "rigs of rods", "gta", "grand theft", "call of duty", "battlefield", "doom", "halo", "mortal kombat", "street fighter"],
    "Adventure": ["adventure", "quest", "story", "journey", "explore", "survival", "minecraft", "terraria", "stardew", "undertale", "celeste", "god of war", "uncharted", "tomb raider"],
    "RPG": ["rpg", "role playing", "roleplaying", "dragon", "dungeon", "rogue", "final fantasy", "elder scrolls", "skyrim", "witcher", "dark souls", "elden ring", "baldur", "pokemon", "final fantasy", "persona"],
    "Strategy": ["strategy", "tactic", "tower defense", "turn based", "4x", "rts", "civilization", "age of empires", "starcraft", "total war", "xcom", "plague inc", "civilization", "homeworld"],
    "Simulation": ["sim", "simulator", "life", "city", "farm", "management", "flight", "dovetail", "train", "farming", "planet zoo", "planet coaster", "rollercoaster", "usa truck", "euro truck", "the sims", "pearl", "drednot"],
    "Sports": ["sport", "football", "basketball", "soccer", "nba", "fifa", "ea sports", "mlb", "nfl", "madden", "ufc", "wwe", "2k", "pes", "football manager"],
    "Racing": ["racing", "race", "car", "drive", "motorsport", "racer", "rally", "forza", "gran turismo", "need for speed", "dirt", "assetto", "crew", "test drive"],
    "Puzzle": ["puzzle", "logic", "brain", "match", "match-3", "trivia", "tetris", "baba is you", "the witness", "monument valley", "picross", "sudoku"],
    "Horror": ["horror", "scary", "survival horror", "fear", "zombie", "ghost", "haunt", "paranormal", "phasmophobia", "outlast", "dead space", "silent hill", "resident evil", "five nights", "freddy", "jumpscare", "amnesia", "Layers of Fear"],
    "Casual": ["casual", "party", "mini", "arcade", "board", "among us", "fall guys", "overcooked", "jackbox", "uno", "draw", "skribbl", "gartic"],
    "Indie": ["indie", "hollow knight", "shovel knight", "cuphead", "dead cells", "skul", "sable", "octopath", "celeste", " hotline"],
    "Multiplayer": ["multiplayer", "co-op", "coop", "online", "mmo", "pvp", "mmorpg", "fortnite", "apex legends", "valorant", "league of legends", "roblox", "rust", "7 days to die"],
}

counts = {}
assigned = set()
for g in data:
    name = g.get('name', '').lower()
    matched = False
    for genre, keywords in GENRE_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            if genre not in counts:
                counts[genre] = 0
            counts[genre] += 1
            assigned.add(g.get('appid'))
            matched = True

print("Genre counts from updated keywords:")
for genre, count in sorted(counts.items(), key=lambda x: -x[1]):
    print(f"  {genre}: {count}")

print(f"\nTotal assigned: {len(assigned)}")
print(f"Unassigned: {len(data) - len(assigned)}")