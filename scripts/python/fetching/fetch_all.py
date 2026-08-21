import requests

from _path_utils import data_path, get_all_games, upsert_games, get_games_by_appid
# Current games
existing_games = get_all_games()

existing_ids = set(str(g.get('appid')) for g in existing_games)
print(f"Current: {len(existing_ids)} games")

# Steam Mobile API can get all apps
print("Fetching all Steam apps...")

try:
    # Get app list from Steam
    url = "https://api.steampowered.com/ISteamApps/GetAppList/v2/"
    resp = requests.get(url, timeout=60)
    if resp.status_code == 200:
        data = resp.json()
        all_apps = data.get('applist', {}).get('apps', [])
        print(f"Total apps on Steam: {len(all_apps)}")
        
        # Filter for actual games (not demos, tools, etc) and add only recent ones
        # Focus on apps with IDs > 10 million (recent)
        count = 0
        for app in all_apps:
            aid = str(app.get('appid', ''))
            name = app.get('name', '')
            
            if aid not in existing_ids and name and len(name) > 2:
                # Only add apps from 2020-2025 (appid > 5 million roughly)
                try:
                    if int(aid) > 5000000:  # Recent-ish apps
                        existing_games.append({
                            'appid': int(aid),
                            'name': name,
                            'header_image': '',
                            'drm': False,
                            'tags': []
                        })
                        count += 1
                        existing_ids.add(aid)
                        
                        if count >= 20000:  # Add up to 20K more
                            break
                except:
                    pass
        
        print(f"Added {count} new apps")
        
except Exception as e:
    print(f"Error: {e}")

print(f"Total now: {len(existing_games)}")

# Save
upsert_games(existing_games)

print("Saved!")