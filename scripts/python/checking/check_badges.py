import json
from _path_utils import data_path
with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)
online = [f for f in fixes if f.get('source') == 'online-fix.me']
print(f'online-fix.me fixes: {len(online)}')
for f in online[:3]:
    print(f'  badges: {f.get("badges", [])}')