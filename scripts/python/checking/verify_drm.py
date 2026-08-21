import json
from _path_utils import data_path
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

# Check key games
keys = ['1808500', '2715900', '252490', '359550', '3405690', '553850', '2074920', '730', '570', '440']
for g in games:
    if str(g['appid']) in keys:
        print(f"{g['appid']}: {g['name'][:40]} - drm: {g.get('drm')}")

# Count total drm=True
drm_true = sum(1 for g in games if g.get('drm') == True)
print(f"\nTotal drm=True: {drm_true}")
print(f"Total games: {len(games)}")