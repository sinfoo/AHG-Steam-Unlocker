import json
import re

from _path_utils import data_path, get_all_games, get_all_fixes, upsert_fixes
def clean_name(name):
    name = str(name).lower().strip()
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'[-_]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def partial_match(search, target):
    search = search.lower().strip()
    target = target.lower().strip()
    
    if search in target or target in search:
        if len(search) >= 4:
            return True
    
    search_words = search.split()
    target_words = target.split()
    matches = sum(1 for sw in search_words if any(sw in tw or tw in sw for tw in target_words))
    
    if matches >= min(2, len(search_words)):
        return True
    
    return False

print("Loading games...")
games_db = get_all_games()

games_index = {}
for g in games_db:
    name_clean = clean_name(g.get('name', ''))
    if name_clean:
        games_index[name_clean] = g
        
print(f"Games: {len(games_index)} unique")

print("Loading existing fixes...")
existing = get_all_fixes()

existing_appids = {g['appid'] for g in existing if g.get('appid')}
print(f"Existing: {len(existing)}")

print("Loading scraped games...")
with open(data_path('scraped_online_fix.json'), 'r', encoding='utf-8') as f:
    scraped = json.load(f)

unmatched = scraped.get('unmatched', [])
print(f"To match: {len(unmatched)}")

matches = []
for i, g in enumerate(unmatched):
    scraped_name = g['name']
    cleaned = clean_name(scraped_name)
    
    if cleaned in games_index:
        game = games_index[cleaned]
        appid = str(game['appid'])
        if appid not in existing_appids:
            matches.append({
                'appid': appid,
                'name': game['name'],
                'badges': ['Online'],
                'fix_count': 1,
                'source': 'online-fix.me'
            })
            existing_appids.add(appid)
            continue
    
    for game_name, game in games_index.items():
        if game['appid'] in existing_appids:
            continue
        if partial_match(cleaned, game_name):
            appid = str(game['appid'])
            if appid not in existing_appids:
                matches.append({
                    'appid': appid,
                    'name': game['name'],
                    'badges': ['Online'],
                    'fix_count': 1,
                    'source': 'online-fix.me'
                })
                existing_appids.add(appid)
                break
    
    if (i + 1) % 400 == 0:
        print(f"{i + 1}: {len(matches)} matches")

print(f"\nTotal matches: {len(matches)}")

all_fixes = existing + matches
by_source = {'total': len(all_fixes)}
print(f"Total fixes: {len(all_fixes)}")

upsert_fixes(all_fixes)
print("Saved!")