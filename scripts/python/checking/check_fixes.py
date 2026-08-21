import json
from _path_utils import data_path
f = open(data_path('fixes.json'),'r',encoding='utf-8')
fixes = json.load(f)

print(f'Total: {len(fixes)}')

# Check game_url
missing = [x for x in fixes if not x.get('game_url')]
print(f'Without game_url: {len(missing)}')

# Sample first 3
for fix in fixes[:3]:
    print(f'\n{fix.get("appid")}: {fix.get("name")}')
    print(f'  source: {fix.get("source")}')
    print(f'  game_url: {fix.get("game_url","")}')