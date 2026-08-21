from _path_utils import get_all_fixes, get_all_games, upsert_fixes
fixes = get_all_fixes()

games_db = get_all_games()

# Create appid -> Steam name mapping
appid_to_steam_name = {g['appid']: g['name'] for g in games_db if g.get('appid')}

# For online-fix.me sources, use Steam names
updated = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me':
        appid = fix.get('appid')
        if appid in appid_to_steam_name:
            steam_name = appid_to_steam_name[appid]
            # Construct URL with Steam name
            import urllib.parse
            clean_name = urllib.parse.quote(steam_name)
            no_space_name = steam_name.replace(' ', '')
            url = f'https://uploads.online-fix.me:2053/uploads/{clean_name}/Fix%20Repair/{no_space_name}_Fix_Repair_Steam_Generic.rar'
            fix['name'] = steam_name  # Update to Steam name
            fix['download_url'] = url
            fix['download_urls'] = [url]
            updated += 1

print(f'Updated {updated} fixes with Steam names')

upsert_fixes(fixes)

# Show samples
print("\nSample (with Steam names):")
count = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me' and count < 5:
        print(f"  {fix['appid']}: {fix['name']}")
        print(f"    -> {fix['download_url']}")
        count += 1