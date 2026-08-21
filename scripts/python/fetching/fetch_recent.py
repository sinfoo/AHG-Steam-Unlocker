import requests

from _path_utils import data_path, get_all_games, upsert_games, get_games_by_appid
# Current games
existing_games = get_all_games()

existing_ids = set(str(g.get('appid')) for g in existing_games)
print(f"Current: {len(existing_ids)} games")

print("Fetching all Steam apps and adding recent ones...")

try:
    url = "https://api.steampowered.com/ISteamApps/GetAppList/v2/"
    resp = requests.get(url, timeout=60)
    if resp.status_code == 200:
        data = resp.json()
        all_apps = data.get('applist', {}).get('apps', [])
        print(f"Total apps on Steam: {len(all_apps)}")
        
        # Add apps with appid > 5 million (most are 2019+)
        count = 0
        added = 0
        for app in all_apps:
            aid = str(app.get('appid', ''))
            name = app.get('name', '')
            
            if aid not in existing_ids and name and len(name) > 2:
                try:
                    appid_num = int(aid)
                    if appid_num > 5000000:  # Recent apps
                        existing_games.append({
                            'appid': appid_num,
                            'name': name,
                            'header_image': '',
                            'drm': False,
                            'tags': []
                        })
                        existing_ids.add(aid)
                        added += 1
                        count += 1
                        
                        if count >= 30000:  # Add up to 30K more
                            break
                except:
                    pass
        
        print(f"Found {added} new recent apps to add (appid > 5M)")
        
except Exception as e:
    print(f"Error: {e}")

print(f"Total now: {len(existing_games)}")

# Save
upsert_games(existing_games)

print("Saved!")