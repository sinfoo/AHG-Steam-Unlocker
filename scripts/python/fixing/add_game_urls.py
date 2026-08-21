import json
import urllib.parse

from _path_utils import data_path, get_all_games, get_all_fixes, upsert_fixes
# Load games database
games = get_all_games()

appid_to_name = {g['appid']: g['name'] for g in games if g.get('appid')}

# Load scraped data
with open(data_path('scraped_online_fix.json'), 'r', encoding='utf-8') as f:
    scraped = json.load(f)

# Build game_url mapping
game_url_map = {}
for g in scraped.get('new_matches', []):
    game_url_map[g['name'].lower()] = g['url']

# Load fixes
fixes = get_all_fixes()

# Update online-fix.me sources with game page URL
updated = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me':
        name = fix.get('name', '').lower()
        if name in game_url_map:
            fix['game_url'] = game_url_map[name]
            updated += 1

print(f'Updated {updated} fixes with game page URLs')

upsert_fixes(fixes)

# Show sample
print('\nSample:')
for fix in fixes[:3]:
    if fix.get('source') == 'online-fix.me':
        print(f"  {fix['name']}: {fix.get('game_url', 'NO URL')}")
        print(f"  Download: {fix['download_url'][:80]}...")