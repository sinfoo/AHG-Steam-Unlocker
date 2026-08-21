import json

from _path_utils import data_path
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

# Check FC26 and GTA V
check = ['2503730', '2715900']
for g in games:
    if str(g['appid']) in check:
        print(f"{g['appid']}: {g['name']} - drm: {g.get('drm')}")