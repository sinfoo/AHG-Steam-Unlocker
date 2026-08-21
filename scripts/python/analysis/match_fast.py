import json
import re

from _path_utils import data_path, get_all_games, get_all_fixes, upsert_fixes
def clean_name(name):
    name = str(name).lower().strip()
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'[-_]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

print("Loading games (fast mode)...")
games_db = get_all_games()

games_index = {}
for g in games_db:
    name_clean = clean_name(g.get('name', ''))
    if name_clean:
        games_index[name_clean] = g
        
print(f"Games: {len(games_index)} unique names")

print("Loading existing...")
existing = get_all_fixes()

existing_appids = {g['appid'] for g in existing if g.get('appid')}
print(f"Existing fixes: {len(existing)}, appids: {len(existing_appids)}")

print("Loading scraped...")
with open(data_path('scraped_online_fix.json'), 'r', encoding='utf-8') as f:
    scraped = json.load(f)

unmatched = scraped.get('unmatched', [])
print(f"Scraped to match: {len(unmatched)}")

def find_match(name):
    cleaned = clean_name(name)
    
    if cleaned in games_index:
        game = games_index[cleaned]
        if str(game['appid']) not in existing_appids:
            return game
    
    return None

matches = []
for i, g in enumerate(unmatched):
    game = find_match(g['name'])
    if game:
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
    
    if (i + 1) % 500 == 0:
        print(f"Processed {i + 1}, matches: {len(matches)}")

print(f"\nDirect matches: {len(matches)}")

all_fixes = existing + matches
by_source = {'ryuu.lol': 490, 'online-fix.me': len(all_fixes) - 490}
print(f"Total: {len(all_fixes)}, sources: {by_source}")

upsert_fixes(all_fixes)
print("Saved!")