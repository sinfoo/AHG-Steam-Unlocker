from _path_utils import get_all_games
data = get_all_games()

GENRE_KEYWORDS = {
    "Action": ["action", "shooter", "combat", "fight", "hack", "slash", "war", "gun", "fps", "shoot", "violent"],
    "Adventure": ["adventure", "quest", "story", "journey", "explore", "survival"],
    "RPG": ["rpg", "role playing", "roleplaying", "dragon", "dungeon", "rogue"],
    "Strategy": ["strategy", "tactic", "tower defense", "turn based", "4x", "rts"],
    "Simulation": ["sim", "simulator", "life", "city", "farm", "management"],
    "Sports": ["sport", "football", "basketball", "soccer", "nba", "fifa", "ea sports"],
    "Racing": ["racing", "race", "car", "drive", "motorsport", "racer"],
    "Puzzle": ["puzzle", "logic", "brain", "match"],
    "Horror": ["horror", "scary", "survival horror", "fear", "zombie", "ghost", "haunt"],
    "Casual": ["casual", "party", "mini", "arcade"],
    "Indie": ["indie"],
    "Multiplayer": ["multiplayer", "co-op", "coop", "online", "mmo"],
}

counts = {}
for g in data:
    name = g.get('name', '').lower()
    genres = set()
    for genre, keywords in GENRE_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            genres.add(genre)
    for genre in genres:
        counts[genre] = counts.get(genre, 0) + 1

print("Genre counts from game NAMES:")
for genre, count in sorted(counts.items(), key=lambda x: -x[1]):
    print(f"  {genre}: {count}")