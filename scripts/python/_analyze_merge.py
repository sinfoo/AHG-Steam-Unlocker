#!/usr/bin/env python3
"""
Analyze current vs new data to determine merge requirements.
"""
import json, sys
sys.path.insert(0, '.')
from _path_utils import data_path

# --- Current fixes ---
with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    curr_fixes = json.load(f)

source_counts = {}
badge_counts = {}
sinfo_count = 0
for fix in curr_fixes:
    src = fix.get('source', 'unknown')
    source_counts[src] = source_counts.get(src, 0) + 1
    badges = tuple(sorted(fix.get('badges', [])))
    badge_counts[badges] = badge_counts.get(badges, 0) + 1
    if 'Sinfo' in fix.get('badges', []):
        sinfo_count += 1

print('=== Current fixes source distribution ===')
for s, c in sorted(source_counts.items(), key=lambda x: -x[1]):
    print(f'  {s}: {c}')
print(f'\nFixes with Sinfo badge: {sinfo_count}')

print('\n=== Current fixes badge combos (top 10) ===')
for b, c in sorted(badge_counts.items(), key=lambda x: -x[1])[:10]:
    print(f'  {b}: {c}')

# --- Current games ---
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    curr_games = json.load(f)
curr_game_appids = {str(g['appid']) for g in curr_games if g.get('appid')}

# --- New games ---
with open(data_path('games/games.json'), 'r', encoding='utf-8') as f:
    new_games = json.load(f)

new_game_only = [g for g in new_games if str(g.get('appid','')) not in curr_game_appids]
print(f'\n=== New game entries to merge: {len(new_game_only)} ===')
for g in new_game_only:
    appid = str(g.get('appid', '?'))
    has_fix = any(str(f.get('appid','')) == appid for f in curr_fixes)
    print(f'  appid={appid} name={g.get("name","?")} has_fix={has_fix}')

# --- New fixes ---
with open(data_path('games/fixes (8).json'), 'r', encoding='utf-8') as f:
    new_fixes = json.load(f)

curr_fix_appids = {str(f['appid']) for f in curr_fixes if f.get('appid')}

# Check which new fix appids already exist in fixes.json
still_new = [nf for nf in new_fixes if str(nf.get('appid','')) not in curr_fix_appids]
print(f'\n=== New fix entries NOT in current fixes: {len(still_new)} ===')
for nf in still_new[:5]:
    print(f'  appid={nf.get("appid","?")} name={nf.get("name","?")} fixes={len(nf.get("fixes",[]))}')

# Also check which of ALL new fix appids have a different source
print(f'\n=== All 501 new fixes: current source mapping ===')
different_source = []
for nf in new_fixes:
    appid = str(nf.get('appid',''))
    curr = [f for f in curr_fixes if str(f.get('appid','')) == appid]
    if curr:
        curr_src = curr[0].get('source', '?')
        if curr_src != 'sinfo':
            different_source.append((appid, nf.get('name','?'), curr_src))

print(f'  New fixes with source != sinfo: {len(different_source)}')
for ds in different_source[:10]:
    print(f'    appid={ds[0]} name={ds[1]} current_source={ds[2]}')

# Also show new fix appids that DO NOT exist in fixes at all
not_in_fixes = [nf for nf in new_fixes if str(nf.get('appid','')) not in curr_fix_appids]
print(f'\n=== New fix appids NOT in current fixes.json: {len(not_in_fixes)} ===')
