#!/usr/bin/env python3
"""Check a few samples to verify badges were appended, not replaced."""
from _path_utils import get_all_fixes

fx = get_all_fixes()

count = 0
for f in fx:
    if 'Sinfo' in f.get('badges', []):
        print(f'  appid={f["appid"]} name={f["name"]} badges={f.get("badges",[])} source={f.get("source","?")}')
        count += 1
        if count >= 5:
            break

# Also check a known previously-Online fix
print('\n--- Top 5 by appid ---')
fx2 = get_all_fixes()
count = 0
for f in fx2:
    if 'Sinfo' in f.get('badges', []) and 'Online' in f.get('badges', []):
        print(f'  appid={f["appid"]} name={f["name"]} badges={f.get("badges",[])} source={f.get("source","?")}')
        count += 1
        if count >= 3:
            break
