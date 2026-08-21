import json
from _path_utils import data_path
with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)
total = len(fixes)
online = len([f for f in fixes if f.get('source') == 'online-fix.me'])
ryuu = len([f for f in fixes if f.get('source') == 'ryuu.lol'])
print(f'Total: {total}')
print(f'online-fix.me: {online}')
print(f'ryuu.lol: {ryuu}')