import json

from _path_utils import data_path
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

for g in games:
    name = g['name'].lower()
    if 'gta' in name or 'fc 26' in name or ('fc' in name and 'ea sports' in name) or 'grand theft' in name:
        print(f"{g['appid']}: {g['name']} - drm: {g.get('drm')}")