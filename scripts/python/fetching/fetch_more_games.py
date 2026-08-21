from _path_utils import data_path, get_all_games, upsert_games, get_games_by_appid
# Current games
existing_games = get_all_games()

existing_ids = set(g.get('appid') for g in existing_games)
print(f"Current: {len(existing_ids)} games")

# Try to use steamdb to get more apps
# SteamDB has a free API we can try
import requests

print("Fetching more games from Steam...")

# Get top selling / new releases - we can try different approaches
new_apps = []

# Try to get apps from steam store pages - limited
try:
    # Get recent apps from Steam API
    url = "https://api.steampowered.com/ISteamApps/GetAppList/v2/"
    resp = requests.get(url, timeout=30)
    if resp.status_code == 200:
        data = resp.json()
        all_apps = data.get('applist', {}).get('apps', [])
        print(f"Total apps in Steam: {len(all_apps)}")
        
        # Add new ones
        count = 0
        for app in all_apps:
            aid = str(app.get('appid', ''))
            if aid and aid.isdigit() and int(aid) > 0 and aid not in existing_ids:
                name = app.get('name', '')
                if name and len(name) > 2:
                    new_apps.append({
                        'appid': int(aid),
                        'name': name,
                        'header_image': '',
                        'drm': False,
                        'tags': []
                    })
                    count += 1
                    if count >= 10000:  # Add up to 10K more
                        break
        
        print(f"Found {count} new games to add")
except Exception as e:
    print(f"Error fetching: {e}")

# Merge - prioritize existing, add new ones
# Add new games to the end
all_games = existing_games + new_apps

print(f"Total after merge: {len(all_games)}")

# Save
upsert_games(all_games)

print("Saved!")