import requests
import json

repos_to_check = [
    ('GHubGamer/SteamDeck-Manifests', 'main'),
    ('JannikCZE/SteamDeck-Keys', 'main'),
    ('DeckManifests/ManifestHub', 'main'),
    ('sergiopereira/steam-manifests', 'main'),
    ('NicksWorldOf/SteamManifests', 'main'),
    ('thecyberphunk/steam-depot-keys', 'main'),
    ('RetroDECK/SteamDeck-Keys', 'main'),
    ('mikee251/SteamDeck-Manifests', 'main'),
    ('LizardMode/SteamDeck-Manifests', 'main'),
]

for repo, branch in repos_to_check:
    try:
        url = f'https://api.github.com/repos/{repo}/contents'
        r = requests.get(url, timeout=10, headers={'User-Agent': 'AHG-Unlocker'})
        if r.status_code == 200:
            files = [f['name'] for f in r.json() if f.get('type') == 'file']
            games_file = [f for f in files if 'game' in f.lower()]
            print(f'{repo} -> {games_file if games_file else files[:5]}')
        else:
            print(f'{repo} -> HTTP {r.status_code}')
    except Exception as e:
        print(f'{repo} -> {e}')