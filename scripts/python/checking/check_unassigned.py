from _path_utils import get_all_games
data = get_all_games()

GENRE_KEYWORDS = {
    "Action": ["action", "shooter", "combat", "fight", "hack", "slash", "war", "gun", "fps", "shoot", "violent"],
    "Adventure": ["adventure", "quest", "story", "journey", "explore", "survival"],
    "RPG": ["rpg", "role playing", "roleplaying", "dragon", "dungeon", "rogue"],
    "Strategy": ["strategy", "tactic", "tower defense", "turn based", "4x", "rts"],
    "Simulation": ["sim", "simulator", "life", "city", "farm", "management"],
    "Sports": ["sport", "football", "basketball", "soccer", "nba", "fifa", "ea sports", "mlb", "nfl"],
    "Racing": ["racing", "race", "car", "drive", "motorsport", "racer", "rally"],
    "Puzzle": ["puzzle", "logic", "brain", "match", "match-3", "trivia"],
    "Horror": ["horror", "scary", "survival horror", "fear", "zombie", "ghost", "haunt", "paranormal", "phasmophobia", "outlast", "dead space", "silent hill", "resident evil"],
    "Casual": ["casual", "party", "mini", "arcade", "puzzle", "board"],
    "Indie": ["indie"],
    "Multiplayer": ["multiplayer", "co-op", "coop", "online", "mmo", "pvp"],
}

assigned = set()
for g in data:
    name = g.get('name', '').lower()
    for genre, keywords in GENRE_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            assigned.add(g.get('appid'))

print("Sample unassigned games:")
count = 0
for g in data:
    if g.get('appid') not in assigned:
        print(f"  {g.get('appid')}: {g.get('name')}")
        count += 1
        if count >= 30:
            break