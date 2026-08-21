import json

from _path_utils import data_path
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

# Check the exact GTA V appid - 271590 is the correct one
target = '271590'
for g in games:
    if str(g['appid']) == target:
        print(f"Found: {g['appid']}: {g['name']} - drm: {g.get('drm')}")

# Also check enhanced edition
target2 = '3240220'
for g in games:
    if str(g['appid']) == target2:
        print(f"Enhanced: {g['appid']}: {g['name']} - drm: {g.get('drm')}")