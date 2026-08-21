import json
import re
from difflib import SequenceMatcher

from _path_utils import data_path, get_all_games, get_all_fixes, upsert_fixes
def clean_name(name):
    name = str(name).lower().strip()
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'[-_]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()

print("Loading games...")
with open(data_path('dist-electron/win-unpacked/resources/games.json'), 'r', encoding='utf-8') as f:
    games_db = json.load(f)

games_by_name = {}
for g in games_db:
    name_clean = clean_name(g.get('name', ''))
    if name_clean:
        games_by_name[name_clean] = g
        
print(f"Loaded {len(games_db)} games, {len(games_by_name)} unique names")

print("Loading existing fixes...")
with open(data_path('dist-electron/win-unpacked/resources/fixes.json'), 'r', encoding='utf-8') as f:
    existing = json.load(f)
existing_appids = {g['appid'] for g in existing if g.get('appid')}
print(f"Existing: {len(existing)}")

print("Loading scraped games...")
with open(data_path('scraped_online_fix.json'), 'r', encoding='utf-8') as f:
    scraped = json.load(f)

unmatched = scraped.get('unmatched', [])
print(f"Scraped: {len(unmatched)}")

def fuzzy_find(scraped_name, threshold=0.6):
    cleaned = clean_name(scraped_name)
    
    if cleaned in games_by_name:
        game = games_by_name[cleaned]
        if str(game['appid']) not in existing_appids:
            return game
    
    best_score = threshold
    best_game = None
    
    for game_name, game in games_by_name.items():
        if game['appid'] in existing_appids:
            continue
        score = similarity(cleaned, game_name)
        if score > best_score:
            best_score = score
            best_game = game
    
    return best_game

print("\nMatching with lower threshold (0.6)...")
new_fixes = []
for i, g in enumerate(unmatched):
    game = fuzzy_find(g['name'], threshold=0.6)
    if game:
        appid = str(game['appid'])
        if appid not in existing_appids:
            new_fixes.append({
                'appid': appid,
                'name': game['name'],
                'badges': ['Online'],
                'fix_count': 1,
                'download_url': '',
                'download_urls': [],
                'game_url': g['url'],
                'source': 'online-fix.me'
            })
            existing_appids.add(appid)
    
    if (i + 1) % 300 == 0:
        print(f"Processed {i + 1}, new fixes: {len(new_fixes)}")

print(f"\nMatched: {len(new_fixes)}")

all_fixes = existing + new_fixes
print(f"Total: {len(all_fixes)}")

by_source = {}
for f in all_fixes:
    src = f.get('source', 'unknown')
    by_source[src] = by_source.get(src, 0) + 1
print(f"By source: {by_source}")

with open(data_path('dist-electron/win-unpacked/resources/fixes.json'), 'w') as f:
    json.dump(all_fixes, f, indent=2)

print("\nSaved!")