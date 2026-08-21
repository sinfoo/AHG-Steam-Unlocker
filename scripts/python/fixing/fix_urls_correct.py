import re

from _path_utils import get_all_games, get_all_fixes, upsert_fixes
# Load games database for Steam names
games = get_all_games()

# Build appid -> Steam name map
appid_to_steam = {g['appid']: g['name'] for g in games if g.get('appid')}

# Load fixes
fixes = get_all_fixes()

# Update online-fix.me sources
updated = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me':
        appid = fix.get('appid')
        if appid in appid_to_steam:
            steam_name = appid_to_steam[appid]
            # Clean name for URL
            import urllib.parse
            encoded = urllib.parse.quote(steam_name)
            no_space = steam_name.replace(' ', '')
            url = f'https://uploads.online-fix.me:2053/uploads/{encoded}/Fix%20Repair/{no_space}_Fix_Repair_Steam_Generic.rar'
            fix['name'] = steam_name
            fix['download_url'] = url
            fix['download_urls'] = [url]
            updated += 1

print(f'Updated {updated} fixes with correct Steam names and URLs')

upsert_fixes(fixes)

# Show samples
print("\nSamples:")
count = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me' and count < 5:
        print(f"  {fix['appid']}: {fix['name']}")
        print(f"    {fix['download_url']}")
        count += 1