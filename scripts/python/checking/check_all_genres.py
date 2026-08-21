from _path_utils import get_all_games
data = get_all_games()
print(f"Total games: {len(data)}")

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

counts = {}
for g in data:
    name = g.get('name', '').lower()
    matched = False
    for genre, keywords in GENRE_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            if genre not in counts:
                counts[genre] = 0
            counts[genre] += 1
            matched = True

print("\nGenre counts from game NAMES:")
for genre, count in sorted(counts.items(), key=lambda x: -x[1]):
    print(f"  {genre}: {count}")

print(f"\nTotal assigned: {sum(counts.values())}")
print(f"Unassigned: {len(data) - sum(counts.values())}")