from _path_utils import data_path, get_all_games, upsert_games
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import json

# Load current games from DB and new games from a JSON source
current = get_all_games()
with open(data_path('dist-electron/games.json'), 'r', encoding='utf-8') as f:
    new = json.load(f)

current_ids = {g['appid'] for g in current}
new_ids = {g['appid'] for g in new}

# Games only in new
only_new = new_ids - current_ids
print(f"Current games (DB): {len(current)}")
print(f"New games.json: {len(new)}")
print(f"Unique new appids (not in DB): {len(only_new)}")

# Find Resident Evil Requiem
for g in new:
    if 'requiem' in g['name'].lower():
        print(f"Found in new: {g['appid']} - {g['name']}")
        
for g in current:
    if 'requiem' in g['name'].lower():
        print(f"Found in current: {g['appid']} - {g['name']}")

# Show some samples of new games
print("\nSample new games not in current:")
new_games_list = [g for g in new if g['appid'] in only_new]
for g in new_games_list[:30]:
    print(f"  {g['appid']}: {g['name']}")
print(f"  ... and {len(new_games_list) - 30} more")

# Merge: add only_new games to DB
new_map = {g['appid']: g for g in new}
added_games = [new_map[aid] for aid in only_new if aid in new_map]
print(f"\n{len(added_games)} new games to upsert into DB")

if added_games:
    upsert_games(added_games)
    print(f"Upserted {len(added_games)} new games into DB")
