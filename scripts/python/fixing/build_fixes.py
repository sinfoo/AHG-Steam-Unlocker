import json
import re

from _path_utils import data_path, get_all_fixes, upsert_fixes, get_fixes_by_appid, get_all_games, get_games_by_appid
def clean_name(name):
    name = str(name).lower()
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'[-_]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

print("Loading games database...")
games_db = get_all_games()

games_by_name = {}
for g in games_db:
    name_clean = clean_name(g.get('name', ''))
    if name_clean:
        games_by_name[name_clean] = g
        
print(f"Loaded {len(games_db)} games, {len(games_by_name)} unique names")

print("Loading existing ryuu fixes...")
ryuu_fixes = get_all_fixes()
print(f"Ryuu fixes: {len(ryuu_fixes)}")

print("Loading scraped data...")
with open(data_path('scraped_online_fix.json'), 'r', encoding='utf-8') as f:
    scraped = json.load(f)

unmatched = scraped.get('unmatched', [])
print(f"Scraped games: {len(unmatched)}")

existing_appids = {g['appid'] for g in ryuu_fixes if g.get('appid')}
print(f"Existing appids: {len(existing_appids)}")

def find_game(scraped_name):
    cleaned = clean_name(scraped_name)
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

online_fixes = []
for i, g in enumerate(unmatched):
    game = find_game(g['name'])
    if game:
        appid = str(game['appid'])
        if appid not in existing_appids:
            online_fixes.append({
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
    if (i + 1) % 200 == 0:
        print(f"Processed {i + 1}, online fixes: {len(online_fixes)}")

print(f"\nOnline fixes matched: {len(online_fixes)}")

all_fixes = ryuu_fixes + online_fixes
print(f"Total fixes: {len(all_fixes)}")

by_source = {}
for f in all_fixes:
    src = f.get('source', 'unknown')
    by_source[src] = by_source.get(src, 0) + 1
print(f"By source: {by_source}")

upsert_fixes(all_fixes)

print(f"\nUpserted {len(all_fixes)} fixes to database")