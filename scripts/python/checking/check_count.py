import json
from _path_utils import data_path
with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)
total = len(fixes)
online = [f for f in fixes if f.get('source') == 'online-fix.me']
ryuu = [f for f in fixes if f.get('source') != 'online-fix.me']
print(f'Total: {total}')
print(f'online-fix.me: {len(online)}')
print(f'ryuu.lol: {len(ryuu)}')

# Check which have badges
with_online_badge = [f for f in online if 'Online' in f.get('badges', [])]
print(f'With Online badge: {len(with_online_badge)}')