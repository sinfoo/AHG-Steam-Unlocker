#!/usr/bin/env python3
"""Verify merge results."""
import json, sys
sys.path.insert(0, '.')
from _path_utils import data_path

# Verify games
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    g = json.load(f)
print(f'Games: {len(g)} total')
for appid in ['3916260', '4177730', '4333460', '4501860', '4551040']:
    found = [x for x in g if str(x.get('appid','')) == appid]
    print(f'  has appid={appid}: {len(found) > 0}')

# Verify fixes
with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    fx = json.load(f)
sinfo_count = sum(1 for f in fx if 'Sinfo' in f.get('badges', []))
print(f'\nFixes: {len(fx)} total, {sinfo_count} with Sinfo badge')

# Sample
for f in fx:
    if 'Sinfo' in f.get('badges', []):
        print(f'  Sample: appid={f["appid"]} name={f["name"]} badges={f.get("badges",[])} source={f.get("source","?")}')
        break
