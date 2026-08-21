import requests
import time
import os

from _path_utils import data_path, get_all_games, upsert_games, count_games, get_games_by_appid
print("Downloading games_appid.json from GitHub...")
url = "https://raw.githubusercontent.com/jsnli/steamappidlist/master/data/games_appid.json"

try:
    resp = requests.get(url, timeout=120)
    if resp.status_code == 200:
        new_apps = resp.json()
        print(f"Downloaded {len(new_apps)} apps from GitHub")
    else:
        print(f"Failed to download: {resp.status_code}")
        exit()
except Exception as e:
    print(f"Error: {e}")
    exit()

# Load existing games
print("Loading existing games.json...")
try:
    existing_games = get_all_games()
except Exception as e:
    print(f"Error loading games: {e}")
    existing_games = []

# Create set of existing appids
existing_ids = set(str(g.get('appid')) for g in existing_games)
print(f"Existing games: {len(existing_ids)}")

# Download DLC too
print("Downloading DLC...")
resp = requests.get("https://raw.githubusercontent.com/jsnli/steamappidlist/master/data/dlc_appid.json", timeout=120)
if resp.status_code == 200:
    dlc_apps = resp.json()
    print(f"Downloaded {len(dlc_apps)} DLC items")

# Add new games that don't exist yet
new_count = 0
dlc_count = 0
for app in new_apps:
    appid = str(app.get('appid', ''))
    name = app.get('name', '')
    if appid not in existing_ids and name and len(str(name)) > 1:
        existing_games.append({
            'appid': int(appid),
            'name': str(name),
            'header_image': '',
            'drm': False,
            'tags': []
        })
        existing_ids.add(appid)
        new_count += 1

print(f"Added {new_count} new games")
print(f"Total now: {len(existing_games)}")

# Save
print("Saving games to database...")
upsert_games(existing_games)

print("Done!")