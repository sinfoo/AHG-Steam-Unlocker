import json
import urllib.parse

from _path_utils import data_path
# Load games database
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

appid_to_name = {g['appid']: g['name'] for g in games if g.get('appid')}

# Load fixes
with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)

# Add "Online" badge to all online-fix.me sources
updated = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me':
        badges = fix.get('badges', [])
        if 'Online' not in badges:
            badges.append('Online')
            fix['badges'] = badges
            updated += 1

print(f'Added Online badge to {updated} fixes')

with open(data_path('fixes.json'), 'w', encoding='utf-8') as f:
    json.dump(fixes, f, indent=2, ensure_ascii=False)

print('Saved!')

# Now scrape more games from online-fix.me
print('\nScraping more games from online-fix.me...')

import requests
from bs4 import BeautifulSoup
import re
import time

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

# Get existing appids
existing_appids = {f['appid'] for f in fixes if f.get('appid')}
print(f'Existing appids: {len(existing_appids)}')

def get_page(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=8)
        return BeautifulSoup(resp.content, 'html.parser')
    except:
        return None

def clean_name(name):
    name = str(name).lower()
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'[-_]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

# Scrape all pages
all_games = []
for page in range(1, 63):
    url = f'https://online-fix.me/games/page/{page}/'
    soup = get_page(url)
    if soup:
        entries = soup.find_all('a', class_='big-link')
        for entry in entries:
            href = entry.get('href', '')
            if '/games/' in href and href.endswith('.html'):
                name = href.split('/')[-1].replace('.html', '')
                match = re.search(r'\d+-(.+)$', name)
                if match:
                    clean = match.group(1).replace('-', ' ')
                    all_games.append({'url': href, 'name': clean})
    time.sleep(0.05)

print(f'Scraped {len(all_games)} games from online-fix.me')

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
    if len(new_games) >= 500:  # Add up to 500 more
        break
    cleaned = clean_name(g['name'])
    found = False
    for appid, name in appid_to_name.items():
        if appid in existing_appids:
            continue
        name_clean = clean_name(name)
        if name_clean == cleaned or (len(name_clean) > 3 and (name_clean in cleaned or cleaned in name_clean)):
            # Check if download URL would work
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

print('\nDone!')