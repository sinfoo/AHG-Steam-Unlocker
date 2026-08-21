import json
from _path_utils import data_path

with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

drm_count = sum(1 for x in games if x.get("drm") == True)
print(f"Total drm=True: {drm_count}")
print(f"Total games: {len(games)}")

# Show breakdown by drm value
print("\nBreakdown of 'drm' field values:")
for val in [True, False, None]:
    count = sum(1 for x in games if x.get("drm") == val)
    print(f"  drm={val}: {count}")