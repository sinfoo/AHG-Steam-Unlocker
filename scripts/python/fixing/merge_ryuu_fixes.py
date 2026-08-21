"""
Merge fixes (7).json (ryuu.lol nested format) into fixes.json (flat format).

fixes (7).json format: {appid, name, fixes: [{href, filename, size, badges}]}
fixes.json format:     {appid, name, badges, fix_count, source, download_url}
"""
import json
import re
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _path_utils import data_path, get_all_fixes, upsert_fixes

# Paths
new_file = data_path('fixes (7).json')

# Load new fixes
print(f"Loading {new_file}...")
with open(new_file, 'r', encoding='utf-8') as f:
    new_data = json.load(f)
print(f"New entries: {len(new_data)}")

# Load existing fixes
print("Loading fixes from database...")
existing = get_all_fixes()
existing_appids = {str(f['appid']) for f in existing if f.get('appid')}
print(f"Existing fixes: {len(existing)} ({len(existing_appids)} unique appids)")

# Convert and merge
converted = 0
duplicates = 0
for entry in new_data:
    appid = str(entry['appid'])
    if appid in existing_appids:
        duplicates += 1
        continue
    
    # Take first fix's href as download_url
    fixes = entry.get('fixes', [])
    download_url = fixes[0]['href'] if fixes else ''
    
    new_fix = {
        'appid': appid,
        'name': entry['name'],
        'badges': ['Online'],
        'fix_count': len(fixes),
        'download_url': download_url,
        'source': 'ryuu.lol'
    }
    existing.append(new_fix)
    existing_appids.add(appid)
    converted += 1

print(f"New entries added: {converted}")
print(f"Skipped (already in fixes): {duplicates}")

if converted > 0:
    # Sort by appid (numeric)
    existing.sort(key=lambda x: int(x['appid']) if x['appid'].isdigit() else 99999999)
    
    upsert_fixes(existing)
    
    print("Saved to database.")
    print(f"Total fixes: {len(existing)}")
    
    by_source = {}
    for f in existing:
        src = f.get('source', 'unknown')
        by_source[src] = by_source.get(src, 0) + 1
    print(f"By source: {by_source}")
else:
    print("Nothing to add.")
