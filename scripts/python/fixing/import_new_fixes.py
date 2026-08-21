"""
Import 236 new online-fix.me matched fixes into fixes.json with game_url + download_url

Reads:  data/new_matches_to_import.json (new matches)
        fixes.json (existing fixes)
        games.json (for game names)

Writes: fixes.json (updated)
"""
import json
import sys
import os
import urllib.parse
import re

# Add parent to path for _path_utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _path_utils import data_path, get_all_fixes, upsert_fixes, get_fixes_by_appid, count_fixes, get_all_games


def construct_download_url(game_name: str) -> str:
    """Build online-fix.me download URL from game name."""
    encoded = urllib.parse.quote(game_name)
    no_space = game_name.replace(' ', '_').replace(':', '_').replace('!', '')
    return f'https://uploads.online-fix.me:2053/uploads/{encoded}/Fix%20Repair/{no_space}_Fix_Repair_Steam_Generic.rar'


# Load new matches
print("Loading new matches...")
with open(data_path('data/new_matches_to_import.json'), 'r', encoding='utf-8') as f:
    new_data = json.load(f)

new_entries = new_data.get('new_entries', [])
print(f"New entries to import: {len(new_entries)}")

# Load games database
print("Loading games database...")
games = get_all_games()
games_by_appid = {}
for g in games:
    if g.get('appid'):
        games_by_appid[str(g['appid'])] = g.get('name', '')

# Load existing fixes
print("Loading existing fixes...")
existing = get_all_fixes()

existing_appids = {str(f['appid']) for f in existing if f.get('appid')}
print(f"Existing fixes: {len(existing)} ({len(existing_appids)} unique appids)")

# Build new fix entries with download_url + game_url
new_fixes = []
duplicates = 0
for entry in new_entries:
    appid = str(entry['appid'])
    if appid in existing_appids:
        duplicates += 1
        continue

    game_name = games_by_appid.get(appid, entry.get('name_online', ''))
    dl_url = construct_download_url(game_name)
    game_url = entry.get('url', '')

    # Clean game name (remove 'po seti' suffix if present)
    clean_name = re.sub(r'\s+po\s+seti$', '', game_name).strip()
    if not clean_name:
        clean_name = game_name

    new_fix = {
        'appid': appid,
        'name': clean_name,
        'badges': ['Online'],
        'fix_count': 1,
        'download_url': dl_url,
        'download_urls': [dl_url],
        'game_url': game_url,
        'source': 'online-fix.me'
    }
    new_fixes.append(new_fix)
    existing_appids.add(appid)

print(f"New fixes to add: {len(new_fixes)}")
print(f"Skipped (already in fixes): {duplicates}")

if new_fixes:
    all_fixes = existing + new_fixes
    print(f"Total fixes after merge: {len(all_fixes)}")

    # Sort by appid (numeric)
    all_fixes.sort(key=lambda x: int(x['appid']) if x['appid'].isdigit() else 99999999)

    upsert_fixes(all_fixes)

    print(f"Saved {len(all_fixes)} fixes to database (fixes.db)")

    # Show source breakdown
    by_source = {}
    for f in all_fixes:
        src = f.get('source', 'unknown')
        by_source[src] = by_source.get(src, 0) + 1
    print(f"By source: {by_source}")
else:
    print("No new fixes to add.")
