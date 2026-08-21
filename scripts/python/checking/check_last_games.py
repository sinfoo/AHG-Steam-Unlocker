import json
from _path_utils import data_path
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    d = json.load(f)
print(f"Total: {len(d)}")
print("Last 5 games:")
for g in d[-5:]:
    print(f"  {g.get('appid')}: {g.get('name')[:40]} - drm:{g.get('drm')}, tags:{len(g.get('tags',[]))}")