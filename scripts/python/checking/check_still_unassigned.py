from _path_utils import get_all_games
data = get_all_games()

# What's still unassigned? Show first 50
print("Sample unassigned games:")
count = 0
for g in data:
    name = g.get('name', '').lower()
    if not any(kw in name for kw in ["action", "shooter", "combat", "fight", "war", "gun", "fps", "shoot", "adventure", "quest", "story", "journey", "explore", "rpg", "dragon", "dungeon", "rogue", "strategy", "tactic", "tower defense", "sim", "simulator", "sport", "football", "soccer", "basketball", "racing", "car", "race", "puzzle", "horror", "scary", "zombie", "ghost", "casual", "party", "mini", "indie", "multiplayer", "online", "mmo", "coop", "valve", "portal", "half-life", "counter-strike"]):
        print(f"  {g.get('appid')}: {g.get('name')}")
        count += 1
        if count >= 40:
            break