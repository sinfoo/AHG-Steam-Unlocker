import json
import re

from _path_utils import data_path, get_all_fixes, upsert_fixes, get_fixes_by_appid, count_fixes
def clean_name(name):
    name = str(name).lower()
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'[-_]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def convert_to_fix_format(game, url, source):
    return {
        'appid': game['appid'],
        'name': game['name'],
        'badges': ['Online'],
        'fix_count': 1,
        'download_url': '',
        'download_urls': [],
        'source': source
    }

print("Loading existing fixes...")
existing = get_all_fixes()
existing_appids = {g['appid'] for g in existing if g.get('appid')}
print(f"Existing: {len(existing)} ({len(existing_appids)} with appid)")

print("Loading matched from scraper...")
with open(data_path('matched_online_fix.json'), 'r', encoding='utf-8') as f:
    matched = json.load(f)

new_matches = matched.get('matched', [])
print(f"New matches: {len(new_matches)}")

new_fixes = []
for m in new_matches:
    appid = str(m['appid'])
    if appid not in existing_appids:
        new_fixes.append({
            'appid': appid,
            'name': m['name'],
            'badges': ['Online'],
            'fix_count': 1,
            'download_url': '',
            'download_urls': [],
            'game_url': m['url'],
            'source': 'online-fix.me'
        })
        existing_appids.add(appid)

print(f"New unique fixes: {len(new_fixes)}")

all_fixes = existing + new_fixes
print(f"Total fixes after merge: {len(all_fixes)}")

by_source = {}
for f in all_fixes:
    src = f.get('source', 'unknown')
    by_source[src] = by_source.get(src, 0) + 1
print(f"By source: {by_source}")

upsert_fixes(all_fixes)
print(f"\nSaved fixes ({len(all_fixes)} total) to database")