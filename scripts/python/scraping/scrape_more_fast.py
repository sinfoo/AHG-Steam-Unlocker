import json
import requests
from bs4 import BeautifulSoup
import re

from _path_utils import data_path
# Load games database
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

# Load fixes
with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)

appid_to_name = {g['appid']: g['name'] for g in games if g.get('appid')}
existing_appids = {f['appid'] for f in fixes if f.get('appid')}

print(f'Existing appids: {len(existing_appids)}')

def clean_name(name):
    name = str(name).lower()
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'[-_]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

# Scrape multiple pages efficiently
print('Fetching online-fix.me pages...')
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

all_games = []
for page in range(1, 63):
    try:
        url = f'https://online-fix.me/games/page/{page}/'
        resp = requests.get(url, headers=HEADERS, timeout=5)
        soup = BeautifulSoup(resp.content, 'html.parser')
        entries = soup.find_all('a', class_='big-link')
        for entry in entries:
            href = entry.get('href', '')
            if '/games/' in href and href.endswith('.html'):
                name = href.split('/')[-1].replace('.html', '')
                match = re.search(r'\d+-(.+)$', name)
                if match:
                    clean = match.group(1).replace('-', ' ')
                    all_games.append({'url': href, 'name': clean})
        if page % 10 == 0:
            print(f'Page {page}: {len(all_games)} games')
    except Exception as e:
        print(f'Page {page} error: {e}')
        break

print(f'Total scraped: {len(all_games)} games')

# Deduplicate
seen = set()
unique = []
for g in all_games:
    key = clean_name(g['name'])
    if key not in seen:
        seen.add(key)
        unique.append(g)

print(f'Unique: {len(unique)}')

# Match to appids
import urllib.parse
new_games = []
for g in unique:
    if len(new_games) >= 300:
        break
    if len(new_games) % 50 == 0:
        print(f'Matched: {len(new_games)}')
    cleaned = clean_name(g['name'])
    found = False
    for appid, name in appid_to_name.items():
        if appid in existing_appids:
            continue
        name_clean = clean_name(name)
        if name_clean == cleaned or (len(name_clean) > 3 and (name_clean in cleaned or cleaned in name_clean)):
            encoded = urllib.parse.quote(name)
            no_space = name.replace(' ', '')
            download_url = f'https://uploads.online-fix.me:2053/uploads/{encoded}/Fix%20Repair/{no_space}_Fix_Repair_Steam_Generic.rar'
            
            new_games.append({
                'appid': appid,
                'name': name,
                'badges': ['Online'],
                'fix_count': 1,
                'download_url': download_url,
                'download_urls': [download_url],
                'game_url': g['url'],
                'source': 'online-fix.me'
            })
            existing_appids.add(appid)
            found = True
            break

print(f'New games matched: {len(new_games)}')

# Add new games to fixes
if new_games:
    fixes.extend(new_games)
    with open(data_path('fixes.json'), 'w', encoding='utf-8') as f:
        json.dump(fixes, f, indent=2, ensure_ascii=False)

print(f'Total fixes now: {len(fixes)}')
online_count = len([f for f in fixes if f.get('source') == 'online-fix.me'])
print(f'online-fix.me fixes: {online_count}')
print('Done!')