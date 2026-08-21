"""Analyze the 556 unmatched entries and figure out matching strategies"""
import json
import re

# Load unmatched from matched_online_fix.json
with open('data/matched_online_fix.json','r',encoding='utf-8') as f:
    data = json.load(f)

unmatched = data.get('unmatched', [])
print(f'Total unmatched: {len(unmatched)}')

# Load games.json to check if these games even exist in our DB
with open('games.json','r',encoding='utf-8') as f:
    games = json.load(f)

# Build a searchable index: lowercased names
games_index = {}
for g in games:
    if g.get('appid') and g.get('name'):
        name_clean = g['name'].lower().strip()
        games_index[name_clean] = g['appid']
        # Also index without special chars
        simple = re.sub(r'[^a-z0-9\s]', '', name_clean).strip()
        if simple and simple != name_clean:
            games_index[simple] = g['appid']

# For each unmatched entry, try to find it
matchable = []
not_found = []

for u in unmatched:
    name = u.get('name', '')
    raw_name = name.lower().strip()
    # Remove "po seti" suffix (Russian for "online")
    cleaned = re.sub(r'\s+po\s+seti$', '', raw_name)
    cleaned = re.sub(r'\s+online$', '', cleaned)
    cleaned = re.sub(r'[^a-z0-9\s]', '', cleaned).strip()
    
    found = False
    # Try exact match
    if cleaned in games_index:
        matchable.append({**u, 'matched_appid': games_index[cleaned], 'method': 'exact'})
        found = True
    
    if not found:
        # Try partial/containment match
        for gname, appid in games_index.items():
            if len(cleaned) > 5 and (cleaned in gname or gname in cleaned):
                matchable.append({**u, 'matched_appid': appid, 'method': 'containment', 'matched_name': gname})
                found = True
                break
    
    if not found:
        not_found.append(u)

print(f'\nMatchable (found in games.json): {len(matchable)}')
print(f'Not found in games.json: {len(not_found)}')

if matchable:
    print('\nMatchable entries (first 15):')
    for m in matchable[:15]:
        print(f'  {m["matched_appid"]} [{m["method"]}] {m["name"]}')
        if m.get('matched_name'):
            print(f'    -> matched: {m["matched_name"]}')

# Check if these are already in fixes.json
with open('fixes.json','r',encoding='utf-8') as f:
    fixes = json.load(f)
fixes_appids = {str(f['appid']) for f in fixes if f.get('appid')}

new_to_fixes = [m for m in matchable if str(m['matched_appid']) not in fixes_appids]
already_in_fixes = [m for m in matchable if str(m['matched_appid']) in fixes_appids]
print(f'\nMatchable but ALREADY in fixes.json: {len(already_in_fixes)}')
print(f'Matchable and NEW to fixes.json: {len(new_to_fixes)}')

if new_to_fixes:
    print('\nNEW entries to add (first 20):')
    for m in new_to_fixes[:20]:
        print(f'  appid={m["matched_appid"]} {m["name"]}')

if not_found:
    print(f'\nNot found in games.json (first 20):')
    for n in not_found[:20]:
        print(f'  {n["name"]}')
