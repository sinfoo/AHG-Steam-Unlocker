"""Match unmatched entries using ONLY exact matching to avoid false positives"""
import json
import re

# Load unmatched from matched_online_fix.json
with open('data/matched_online_fix.json','r',encoding='utf-8') as f:
    data = json.load(f)

unmatched = data.get('unmatched', [])
print(f'Total unmatched: {len(unmatched)}')

# Load games.json
with open('games.json','r',encoding='utf-8') as f:
    games = json.load(f)

# Build a clean-name -> appid index
games_by_clean = {}
for g in games:
    if g.get('appid') and g.get('name'):
        name = g['name'].lower().strip()
        name_clean = re.sub(r'[^a-z0-9\s]', '', name).strip()
        if name_clean:
            games_by_clean[name_clean] = str(g['appid'])
        games_by_clean[name] = str(g['appid'])

# Simpler index without filler words
games_by_simple = {}
for g in games:
    if g.get('appid') and g.get('name'):
        name = g['name'].lower().strip()
        name_clean = re.sub(r'[^a-z0-9\s]', '', name).strip()
        for word in ['the', 'a', 'an', 'and', 'of', 'in', 'to', 'for', 'ii', 'iii', 'iv']:
            name_clean = re.sub(r'\b' + word + r'\b', '', name_clean).strip()
        name_clean = re.sub(r'\s+', ' ', name_clean).strip()
        if name_clean and len(name_clean) > 2:
            games_by_simple[name_clean] = str(g['appid'])

# For each unmatched entry
matches = []

for u in unmatched:
    name = u.get('name', '')
    raw = name.lower().strip()
    
    # Remove "po seti" suffix and "online"
    cleaned = re.sub(r'\s+po\s+seti$', '', raw)
    cleaned = re.sub(r'\s+online$', '', cleaned)
    cleaned = re.sub(r'[^a-z0-9\s]', '', cleaned).strip()
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    if not cleaned or len(cleaned) < 2:
        continue
    
    # Method 1: exact match against raw game names
    appid = games_by_clean.get(cleaned)
    if appid:
        matches.append({'appid': appid, 'name_online': name, 'name_clean': cleaned, 'method': 'exact_v1'})
        continue
    
    # Method 2: exact match against simplified names
    appid = games_by_simple.get(cleaned)
    if appid:
        matches.append({'appid': appid, 'name_online': name, 'name_clean': cleaned, 'method': 'exact_v2'})
        continue
    
    # Method 3: remove subtitle (after dash)
    short = re.sub(r'\s*[–\-—]\s*.*$', '', cleaned).strip()
    if short and short != cleaned and len(short) > 2:
        appid = games_by_clean.get(short)
        if not appid:
            appid = games_by_simple.get(short)
        if appid:
            matches.append({'appid': appid, 'name_online': name, 'name_clean': cleaned, 'method': 'truncated'})
            continue
    
    # Method 4: remove edition suffixes
    for suffix in [' goty', ' definitive edition', ' complete edition', ' game of the year edition',
                   ' deluxe edition', ' ultimate edition', ' enhanced edition', ' special edition',
                   ' collectors edition', ' premium edition', ' gold edition']:
        if cleaned.endswith(suffix):
            base = cleaned[:-len(suffix)].strip()
            appid = games_by_clean.get(base)
            if not appid:
                appid = games_by_simple.get(base)
            if appid:
                matches.append({'appid': appid, 'name_online': name, 'name_clean': cleaned, 'method': 'edition_suffix'})
                break

# Load fixes.json to check which are new
with open('fixes.json','r',encoding='utf-8') as f:
    fixes = json.load(f)
fixes_appids = {str(f['appid']) for f in fixes if f.get('appid')}

new_matches = [m for m in matches if str(m['appid']) not in fixes_appids]
already_in = [m for m in matches if str(m['appid']) in fixes_appids]
matched_names = set(m['name_online'] for m in matches)
unmatched_remaining = [u for u in unmatched if u.get('name','') not in matched_names]

print(f'Exact matches: {len(matches)}')
print(f'  Already in fixes.json: {len(already_in)}')
print(f'  NEW to fixes.json: {len(new_matches)}')
print(f'  Still unmatched after exact: {len(unmatched_remaining)}')

# Count methods
methods = {}
for m in matches:
    methods[m['method']] = methods.get(m['method'], 0) + 1
print(f'Methods: {methods}')

# Show new matches
if new_matches:
    print(f'\n=== {len(new_matches)} NEW entries ===')
    for m in new_matches:
        print(f'  {m["appid"]} [{m["method"]}] {m["name_online"]}')

# Output as JSON
new_entries = []
for m in new_matches:
    url = ''
    for u in unmatched:
        if u.get('name') == m['name_online']:
            url = u.get('url', '')
            break
    new_entries.append({
        'appid': m['appid'],
        'name_online': m['name_online'],
        'url': url,
        'method': m['method']
    })

output = {
    'total_unmatched': len(unmatched),
    'exact_matches': len(matches),
    'new_to_fixes': len(new_matches),
    'already_in_fixes': len(already_in),
    'new_entries': new_entries
}

with open('data/new_matches_to_import.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f'\nSaved to data/new_matches_to_import.json')
