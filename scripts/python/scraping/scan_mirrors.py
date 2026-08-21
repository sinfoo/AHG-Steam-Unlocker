import json
import requests
import concurrent.futures

from _path_utils import data_path
# Load current games
with open(data_path('games.json'), 'r', encoding='utf-8', errors='ignore') as f:
    existing = json.load(f)
existing_ids = set(g['appid'] for g in existing)
print(f'Current: {len(existing_ids)} games')

# Check mirrors for more games
mirrors = [
    'WARDEN-DEV/Steam_ManifestHub',
    'SteamAutoCracks/ManifestHub',
    'pvzcxw/cai-install_stloader',
    'tympanicblock61/SteamManifestMirror',
    'isurfer21/steam-manifests',
    'WoodenTiger000/SteamManifestHub',
    'TheSecondComing001/SteamManifestHub',
    'frostheaven/steam-manifest-cache',
]

# Try different branches/paths
paths_to_try = [
    'main/games.json',
    'master/games.json',
    'main/data/games.json',
    'main/allgames.json',
]

def try_url(repo, path):
    url = f'https://raw.githubusercontent.com/{repo}/{path}'
    r = requests.get(url, timeout=30)
    return url, r.status_code, r.text[:100] if r.status_code == 200 else ''

total_new = set()
for repo in mirrors:
    for path in paths_to_try:
        try:
            url = f'https://raw.githubusercontent.com/{repo}/{path}'
            r = requests.get(url, timeout=30)
            if r.status_code == 200:
                try:
                    games = json.loads(r.text)
                    if isinstance(games, list) and len(games) > 100:
                        new_count = 0
                        for g in games:
                            if g.get('appid') not in existing_ids:
                                total_new.add(g.get('appid'))
                                new_count += 1
                        print(f'{repo}/{path}: {len(games)} games, {new_count} new')
                        break
                except:
                    pass
        except Exception as e:
            pass

print(f'\n=== Total unique new games available from mirrors: {len(total_new)} ===')