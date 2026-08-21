#!/usr/bin/env python3
"""
Merge new games.json and new fixes (8).json data into the project.

1. Merges new games (5 new appids) into games.db via upsert
2. Adds 'Sinfo' badge to existing fixes whose appid appears in the new fixes file
"""
import json, sys
sys.path.insert(0, '.')
from _path_utils import data_path, get_all_games, upsert_games, get_all_fixes, upsert_fixes

# ============================================================
# PART 1: Merge games
# ============================================================
print("=" * 60)
print("PART 1: Merging new games into DB")
print("=" * 60)

with open(data_path('games/games.json'), 'r', encoding='utf-8') as f:
    new_games = json.load(f)

curr_games = get_all_games()
curr_appids = {str(g['appid']) for g in curr_games if g.get('appid')}

added = []
for g in new_games:
    appid = str(g.get('appid', ''))
    if appid and appid not in curr_appids:
        added.append(g)
        curr_appids.add(appid)

print(f"  New games added: {len(added)}")

if added:
    upsert_games(added)
    print(f"  Upserted {len(added)} new games into DB")

# ============================================================
# PART 2: Add 'Sinfo' badge to existing fixes
# ============================================================
print()
print("=" * 60)
print("PART 2: Adding Sinfo badge to matching fixes")
print("=" * 60)

with open(data_path('games/fixes (8).json'), 'r', encoding='utf-8') as f:
    new_fixes = json.load(f)

new_fix_appids = {str(f['appid']) for f in new_fixes if f.get('appid')}
print(f"  New fixes file has {len(new_fix_appids)} unique appids")

curr_fixes = get_all_fixes()

updated = 0
for fix in curr_fixes:
    appid = str(fix.get('appid', ''))
    if appid in new_fix_appids:
        badges = fix.get('badges', [])
        if 'Sinfo' not in badges:
            badges.append('Sinfo')
            fix['badges'] = badges
            updated += 1

print(f"  Fixes updated with Sinfo badge: {updated}")

if updated > 0:
    upsert_fixes(curr_fixes)
    print(f"  Saved fixes ({len(curr_fixes)} total entries)")

    by_source = {}
    for f in curr_fixes:
        src = f.get('source', 'unknown')
        by_source[src] = by_source.get(src, 0) + 1
    print(f"  By source: {by_source}")

print()
print("Done.")
