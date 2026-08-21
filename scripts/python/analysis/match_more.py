import json
import urllib.parse
from _path_utils import data_path, get_all_fixes, upsert_fixes

# Load existing scraped matches
with open(data_path('scraped_online_fix.json'), 'r', encoding='utf-8') as f:
    scraped_data = json.load(f)

new_matches = scraped_data.get('new_matches', [])
print(f'New matches in scraped file: {len(new_matches)}')

# Count ones with appids
with_appid = [m for m in new_matches if m.get('appid')]
print(f'With appid: {len(with_appid)}')

# Load fixes
fixes = get_all_fixes()

existing_appids = {f['appid'] for f in fixes if f.get('appid')}
print(f'Existing appids in fixes: {len(existing_appids)}')

# Add new games that have appids and aren't already in fixes
added = 0
for m in new_matches:
    appid = m.get('appid')
    if not appid:
        continue
    if appid in existing_appids:
        continue
    
    name = m.get('name', '')
    if not name:
        continue
    
    existing_appids.add(appid)
    encoded = urllib.parse.quote(name)
    no_space = name.replace(' ', '')
    download_url = f'https://uploads.online-fix.me:2053/uploads/{encoded}/Fix%20Repair/{no_space}_Fix_Repair_Steam_Generic.rar'
    
    # Clean name for display (remove po seti suffix)
    clean_name = name.replace(' po seti', '').replace(' po-seti', '').strip()
    
    fixes.append({
        'appid': str(appid),
        'name': clean_name.title() if clean_name else name,
        'badges': ['Online'],
        'fix_count': 1,
        'download_url': download_url,
        'download_urls': [download_url],
        'game_url': m.get('url', ''),
        'source': 'online-fix.me'
    })
    added += 1

print(f'Added: {added} new games')
print(f'Total fixes: {len(fixes)}')

if added > 0:
    upsert_fixes(fixes)

# Stats
online = len([f for f in fixes if f.get('source') == 'online-fix.me'])
print(f'online-fix.me: {online}')
print('Done!')