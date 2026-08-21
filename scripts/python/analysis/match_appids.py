import json
import re

from _path_utils import data_path, get_all_games, get_all_fixes
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

print("Loading existing fixes...")
existing = get_all_fixes()
existing_appids = {g['appid'] for g in existing if g.get('appid')}
print(f"Existing fixes: {len(existing)}")

print("Loading scraped data...")
with open(data_path('scraped_online_fix.json'), 'r', encoding='utf-8') as f:
    scraped = json.load(f)

unmatched = scraped.get('unmatched', [])
print(f"Unmatched from scraper: {len(unmatched)}")

matched = []
still_unmatched = []

for i, g in enumerate(unmatched):
    raw_name = g['name']
    name = clean_name(raw_name)
    
    game = games_by_name.get(name)
    if game:
        appid = str(game['appid'])
        if appid not in existing_appids:
            matched.append({
                'appid': appid,
                'name': game['name'],
                'url': g['url'],
                'source': 'online-fix.me'
            })
            existing_appids.add(appid)
    else:
        still_unmatched.append(g)
    
    if (i + 1) % 500 == 0:
        print(f"Processed {i + 1}, matched so far: {len(matched)}")

print(f"\nMatched: {len(matched)}")
print(f"Still unmatched: {len(still_unmatched)}")
if matched:
    print(f"Sample matched:")
    for m in matched[:5]:
        print(f"  {m['appid']}: {m['name']}")

output = {'matched': matched, 'unmatched': still_unmatched}
with open(data_path('matched_online_fix.json'), 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
print("\nSaved to matched_online_fix.json")