import json

from _path_utils import data_path
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

# Search for "we gotta go"
we_gotta = [g for g in games if 'we gotta go' in g.get('name', '').lower()]
print("Games with 'we gotta go':")
for g in we_gotta[:5]:
    print(f"  {g['appid']}: {g['name']}")

# Search for partial match
gotta = [g for g in games if 'gotta go' in g.get('name', '').lower()]
print("\nGames with 'gotta go':")
for g in gotta[:5]:
    print(f"  {g['appid']}: {g['name']}")

# Check all games with 491xxx appids
print("\nGames with appid around 491700:")
near = [g for g in games if '491' in g.get('appid', '') and abs(int(g.get('appid', '0')) - 491700) < 100]
for g in near[:10]:
    print(f"  {g['appid']}: {g['name']}")