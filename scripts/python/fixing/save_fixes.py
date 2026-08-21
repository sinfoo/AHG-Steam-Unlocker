import json
import re

from _path_utils import data_path, get_all_games, get_all_fixes, upsert_fixes, get_fixes_by_appid
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

by_source = {}
for f in existing:
    src = f.get('source', 'unknown')
    by_source[src] = by_source.get(src, 0) + 1
print(f"By source: {by_source}")

upsert_fixes(existing)

print(f"\nSaved {len(existing)} fixes to database")
print(f"Total fixes: {len(existing)}")