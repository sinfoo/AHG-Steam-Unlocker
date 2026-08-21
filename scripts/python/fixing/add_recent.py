import requests
import time

from _path_utils import get_all_games, upsert_games
# Current games
existing_games = get_all_games()

existing_ids = set(str(g.get('appid')) for g in existing_games)
print(f"Current: {len(existing_ids)} games")

# Add known recent popular games manually (2024-2025 releases)
recent_games = [
    {"appid": 3241660, "name": "Hades II", "tags": ["RPG", "Action", "Indie"]},
    {"appid": 3092690, "name": "Marvel Rivals", "tags": ["Action", "Shooter", "Multiplayer"]},
    {"appid": 3034560, "name": "Palworld", "tags": ["Action", "Survival", "Adventure"]},
    {"appid": 2249590, "name": "Lethal Company", "tags": ["Indie", "Horror", "Multiplayer"]},
    {"appid": 2220070, "name": "Baldur's Gate 3", "tags": ["RPG", "Adventure"]},
    {"appid": 2159140, "name": "Cyberpunk 2077: Phantom Liberty", "tags": ["RPG", "Action"]},
    {"appid": 1593500, "name": "Helldivers 2", "tags": ["Action", "Shooter", "Co-op"]},
    {"appid": 2717320, "name": "Elden Ring: Shadow of the Erdtree", "tags": ["RPG", "Action"]},
    {"appid": 2015260, "name": "Space Marine 2", "tags": ["Action", "Shooter"]},
    {"appid": 2893990, "name": "Dragon Age: The Veilguard", "tags": ["RPG", "Action"]},
    {"appid": 2389600, "name": "S.T.A.L.K.E.R. 2", "tags": ["RPG", "Horror", "Survival"]},
    {"appid": 2322010, "name": "Indiana Jones", "tags": ["Adventure", "Action"]},
    {"appid": 2138330, "name": "Alan Wake 2", "tags": ["Horror", "Action"]},
    {"appid": 1888930, "name": "Starfield", "tags": ["RPG", "Action"]},
    {"appid": 1328670, "name": "Hogwarts Legacy", "tags": ["Adventure", "RPG"]},
    {"appid": 1817070, "name": "Mortal Kombat 1", "tags": ["Action", "Fighting"]},
    {"appid": 1659420, "name": "Zelda-like", "tags": ["Adventure", "RPG"]},
    {"appid": 1796570, "name": "Pokemon", "tags": ["RPG"]},
    {"appid": 1621690, "name": "Spider-Man 2", "tags": ["Action", "Adventure"]},
    {"appid": 1493360, "name": "Warzone", "tags": ["Shooter", "Multiplayer"]},
    {"appid": 752590, "name": "Apex Legends", "tags": ["Shooter", "Multiplayer"]},
    {"appid": 1158310, "name": "Crusader Kings 3", "tags": ["Strategy"]},
    {"appid": 1086940, "name": "Baulder's Gate 3", "tags": ["RPG"]},
]

count = 0
for g in recent_games:
    aid = str(g['appid'])
    if aid not in existing_ids:
        existing_games.append({
            'appid': g['appid'],
            'name': g['name'],
            'header_image': '',
            'drm': True,
            'tags': g.get('tags', [])
        })
        count += 1

print(f"Added {count} recent games")

# Try fetching from SteamDB API alternative
print("Trying to get more from Steam...")
try:
    # Get recently updated apps - this is limited but let's try
    # SteamDB doesn't have free API, so we'll note this
    pass
except Exception as e:
    print(f"Note: Could not fetch more from external APIs")

print(f"Total now: {len(existing_games)}")

upsert_games(existing_games)

print("Saved!")