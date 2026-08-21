import requests
import time

from _path_utils import data_path, get_all_games, upsert_games, get_games_by_appid
print("Starting fresh fetch from Steam API...")

# Get all Steam apps
url = "https://api.steampowered.com/ISteamApps/GetAppList/v2/"
resp = requests.get(url, timeout=120)

if resp.status_code == 200:
    data = resp.json()
    all_apps = data.get('applist', {}).get('apps', [])
    print(f"Total Steam apps: {len(all_apps)}")
    
    # Load current
    try:
        existing_games = get_all_games()
    except:
        existing_games = []
    
    existing_ids = set(str(g.get('appid')) for g in existing_games)
    print(f"Existing: {len(existing_ids)}")
    
    # Add ALL new apps (not just recent - get everything!)
    new_count = 0
    for app in all_apps:
        aid = str(app.get('appid', ''))
        name = app.get('name', '')
        
        if aid not in existing_ids and name and len(name) > 2:
            try:
                existing_games.append({
                    'appid': int(aid),
                    'name': name,
                    'header_image': '',
                    'drm': False,
                    'tags': []
                })
                existing_ids.add(aid)
                new_count += 1
            except:
                pass
    
    print(f"Added {new_count} new games")
    print(f"Total now: {len(existing_games)}")
    
    # Save
    upsert_games(existing_games)
    
    print("Saved games.json!")
else:
    print(f"Failed: {resp.status_code}")