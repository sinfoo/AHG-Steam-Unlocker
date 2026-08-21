import json
import re

from _path_utils import data_path, get_all_games, get_all_fixes, upsert_fixes
print("Loading games database...")
games_db = get_all_games()

games_by_name = {}
for g in games_db:
    name_clean = g.get('name', '').lower().strip()
    if name_clean:
        games_by_name[name_clean] = g
        
print(f"Loaded {len(games_db)} games")

print("Loading existing fixes...")
existing = get_all_fixes()
existing_appids = {g['appid'] for g in existing if g.get('appid')}
print(f"Existing: {len(existing)}")

print("Loading matched data...")
with open(data_path('matched_online_fix.json'), 'r', encoding='utf-8') as f:
    matched_data = json.load(f)

still_unmatched = matched_data.get('unmatched', [])
print(f"Still unmatched: {len(still_unmatched)}")

def clean_scraped_name(name):
    name = str(name).lower()
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'[-_]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def find_game(scraped_name):
    cleaned = clean_scraped_name(scraped_name)
    
    if cleaned in games_by_name:
        game = games_by_name[cleaned]
        if str(game['appid']) not in existing_appids:
            return game
    
    for game_name, game in games_by_name.items():
        if game['appid'] in existing_appids:
            continue
        if cleaned in game_name or game_name in cleaned:
            if len(cleaned) > 3 and len(game_name) > 3:
                return game
    
    return None

new_fixes = []
for i, g in enumerate(still_unmatched):
    game = find_game(g['name'])
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
    
    if (i + 1) % 100 == 0:
        print(f"Processed {i + 1}, new fixes: {len(new_fixes)}")

print(f"\nNew fixes with fuzzy: {len(new_fixes)}")
print(f"Sample:")
for f in new_fixes[:5]:
    print(f"  {f['appid']}: {f['name']}")

existing.extend(new_fixes)
print(f"Total: {len(existing)}")

by_source = {}
for f in existing:
    src = f.get('source', 'unknown')
    by_source[src] = by_source.get(src, 0) + 1
print(f"By source: {by_source}")

upsert_fixes(existing)
print("\nSaved to fixes.db")