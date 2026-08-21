import json

from _path_utils import data_path
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

print(f"Total games: {len(games)}")

drm_games = [g for g in games if g.get('drm')]
print(f"\nGames with drm=True: {len(drm_games)}")
for g in drm_games:
    print(f"  {g['appid']}: {g['name']}")

print("\n--- Sample of other games ---")
for g in games[:10]:
    print(f"  {g['appid']}: {g['name']} - drm: {g.get('drm')}")