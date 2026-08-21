import json

from _path_utils import data_path
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

key_apps = ['1808500', '359550', '2715900', '252490', '2503730', '553850', '2074920']
for g in games:
    if str(g['appid']) in key_apps:
        print(f"{g['appid']}: {g['name']} - drm: {g.get('drm')}")