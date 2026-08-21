import json
import requests
from bs4 import BeautifulSoup
import re
import urllib.parse

from _path_utils import data_path
# Load existing data
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)

appid_to_name = {g['appid']: g['name'] for g in games if g.get('appid')}
existing_appids = {f['appid'] for f in fixes if f.get('appid')}

print(f'Existing appids: {len(existing_appids)}')
print(f'Steam games: {len(appid_to_name)}')

# Reuse session
session = requests.Session()
session.headers.update({'User-Agent': 'Mozilla/5.0'})

def clean_name(name):
    name = str(name).lower()
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'[-_]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

# Scrape all pages
print('Scraping pages...')
all_games = []
for page in range(1, 63):
    try:
        url = f'https://online-fix.me/games/page/{page}/'
        resp = session.get(url, timeout=3)
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
        if page % 20 == 0:
            print(f'Page {page}: {len(all_games)}')
    except Exception as e:
        print(f'Page {page}: {e}')

print(f'Total scraped: {len(all_games)}')

# Deduplicate
seen = set()
unique = []
for g in all_games:
    key = clean_name(g['name'])
    if key not in seen:
        seen.add(key)
        unique.append(g)

print(f'Unique games: {len(unique)}')

# Match to appids
new_games = []
for g in unique:
    if len(new_games) >= 500:
        break
    if len(new_games) % 100 == 0:
        print(f'Matched: {len(new_games)}')
    
    cleaned = clean_name(g['name'])
    for appid, name in appid_to_name.items():
        if appid in existing_appids:
            continue
        name_clean = clean_name(name)
        if name_clean == cleaned or (len(name_clean) > 3 and (name_clean in cleaned or cleaned in name_clean)):
            encoded = urllib.parse.quote(name)
            no_space = name.replace(' ', '')
            download_url = f'https://uploads.online-fix.me:2053/uploads/{encoded}/Fix%20Repair/{no_space}_Fix_Repair_Steam_Generic.rar'
            
            fix_name = name.replace(' po seti', '').replace(' po-seti', '').strip()
            
            new_games.append({
                'appid': appid,
                'name': fix_name,
                'badges': ['Online'],
                'fix_count': 1,
                'download_url': download_url,
                'download_urls': [download_url],
                'game_url': g['url'],
                'source': 'online-fix.me'
            })
            existing_appids.add(appid)
            break

print(f'New games to add: {len(new_games)}')

if new_games:
    fixes.extend(new_games)
    with open(data_path('fixes.json'), 'w', encoding='utf-8') as f:
        json.dump(fixes, f, indent=2, ensure_ascii=False)

total = len(fixes)
online = len([f for f in fixes if f.get('source') == 'online-fix.me'])
print(f'Total fixes: {total}')
print(f'online-fix.me: {online}')
print('Done!')