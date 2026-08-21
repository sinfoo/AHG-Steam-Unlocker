"""Show and verify new matches before merging into fixes.json"""
import json

# Load the new matches
with open('data/new_matches_to_import.json','r',encoding='utf-8') as f:
    data = json.load(f)

entries = data['new_entries']
print(f'Total new entries: {len(entries)}')

# Analyze methods
methods = {}
for e in entries:
    m = e['method']
    methods[m] = methods.get(m, 0) + 1
print('\nMethods distribution:')
for m, c in sorted(methods.items()):
    print(f'  {m}: {c}')

# Show all entries
print('\nAll new entries to import:')
for e in entries:
    print(f'  {e["appid"]} [{e["method"]}] {e["name"]}')

# Verify against games.json to get correct names
with open('games.json','r',encoding='utf-8') as f:
    games = json.load(f)
games_map = {g['appid']: g['name'] for g in games if g.get('appid')}

# Check one entry per appid for game names
appid_to_name = {}
for e in entries:
    aid = str(e['appid'])
    if aid in games_map and aid not in appid_to_name:
        appid_to_name[aid] = games_map[aid]

print(f'\nGame names for new entries ({len(appid_to_name)} unique appids):')
for aid, name in sorted(appid_to_name.items()):
    print(f'  {aid}: {name}')
