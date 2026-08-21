from _path_utils import get_all_games
data = get_all_games()

GENRE_KEYWORDS = {
    "Action": ["action", "shooter", "combat", "fight", "hack", "slash", "war", "gun", "fps", "shoot", "violent", "valve", "portal", "left 4 dead", "counter-strike", "team fortress", "day of defeat", "half-life", "rigs of rods", "gta", "grand theft", "call of duty", "battlefield", "doom", "halo", "mortal kombat", "street fighter"],
    "Adventure": ["adventure", "quest", "story", "journey", "explore", "survival", "minecraft", "terraria", "stardew", "undertale", "celeste", "god of war", "uncharted", "tomb raider"],
    "RPG": ["rpg", "role playing", "roleplaying", "dragon", "dungeon", "rogue", "final fantasy", "elder scrolls", "skyrim", "witcher", "dark souls", "elden ring", "baldur", "pokemon", "final fantasy", "persona"],
    "Strategy": ["strategy", "tactic", "tower defense", "turn based", "4x", "rts", "civilization", "age of empires", "starcraft", "total war", "xcom", "plague inc", "civilization", "homeworld"],
    "Simulation": ["sim", "simulator", "life", "city", "farm", "management", "建造", "模拟", "flight", "dovetail", "train", "farming", "planet zoo", "planet coaster", "rollercoaster", "usa truck", "euro truck", "the sims", "pearl", "drednot"],
    "Sports": ["sport", "football", "basketball", "soccer", "nba", "fifa", "ea sports", "mlb", "nfl", "madden", "ufc", "wwe", "2k", "pes", "football manager"],
    "Racing": ["racing", "race", "car", "drive", "motorsport", "racer", "rally", "forza", "gran turismo", "need for speed", "need for speed", "dirt", "assetto", "crew", "test drive"],
    "Puzzle": ["puzzle", "logic", "brain", "match", "match-3", "trivia", "tetris", "portal", "baba is you", "the witness", "monument valley", "picross", "sudoku", "words", "wordle"],
    "Horror": ["horror", "scary", "survival horror", "fear", "zombie", "ghost", "haunt", "paranormal", "phasmophobia", "outlast", "dead space", "silent hill", "resident evil", "five nights", "freddy", "jumpscare", "amnesia", "Layers of Fear", "visage", "marple", "murder"],
    "Casual": ["casual", "party", "mini", "arcade", "puzzle", "board", "among us", "fall guys", "overcooked", "jackbox", "uno", "cards against humanity", "draw", "skribbl", "gartic"],
    "Indie": ["indie", "among us", "hollow knight", "florida", "terraria", "stardew valley", " hotline", "shovel knight", "cuphead", "dead cells", "skul", "sable", "octopath"],
    "Multiplayer": ["multiplayer", "co-op", "coop", "online", "mmo", "pvp", "mmorpg", "fortnite", "apex legends", "valorant", "league of legends", "minecraft", "roblox", "rust", "7 days to die"],
}

# Show sample from each genre
for genre, keywords in GENRE_KEYWORDS.items():
    print(f"\n{genre}:")
    count = 0
    for g in data:
        name = g.get('name', '').lower()
        if any(kw in name for kw in keywords):
            print(f"  {g.get('appid')}: {g.get('name')}")
            count += 1
            if count >= 5:
                break