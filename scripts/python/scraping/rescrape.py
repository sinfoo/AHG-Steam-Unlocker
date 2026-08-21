import json
import requests
from bs4 import BeautifulSoup
import re
import urllib.parse

from _path_utils import data_path
print('Loading data...')

with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)

with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

appid_to_name = {g['appid']: g['name'] for g in games if g.get('appid')}
existing_appids = {f['appid'] for f in fixes if f.get('appid')}

print(f'Existing fixes: {len(fixes)}')
print(f'Scraping online-fix.me for fresh data...')

# Scrape all pages
session = requests.Session()
session.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                     'Accept': 'text/html,application/xhtml+xml'})
session.allow_redirects = True

def clean_name(name):
    name = str(name).lower()
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'[-_]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

all_games = []
for page in range(1, 63):
    try:
        url = f'https://online-fix.me/games/page/{page}/'
        resp = session.get(url, timeout=5)
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
        print(f'Page {page} error: {e}')

print(f'Total scraped: {len(all_games)}')

# Dedupe
seen = set()
unique = []
for g in all_games:
    key = clean_name(g['name'])
    if key not in seen:
        seen.add(key)
        unique.append(g)

print(f'Unique: {len(unique)}')

# Create lookup for game_url
game_url_lookup = {clean_name(g['name']): g['url'] for g in unique}

# Update fixes with game_url
updated = 0
for fix in fixes:
    if fix.get('source') != 'online-fix.me':
        continue
    
    name = fix.get('name', '')
    if not name:
        continue
    
    key = clean_name(name)
    if key in game_url_lookup and not fix.get('game_url'):
        fix['game_url'] = game_url_lookup[key]
        updated += 1

print(f'Updated with game_url: {updated}')

# Re-fetch download_url for all online-fix.me fixes
print('Updating download URLs...')
updated_dl = 0
for fix in fixes:
    if fix.get('source') != 'online-fix.me':
        continue
    
    name = fix.get('name', '')
    if not name:
        continue
    
    encoded = urllib.parse.quote(name)
    no_space = name.replace(' ', '')
    download_url = f'https://uploads.online-fix.me:2053/uploads/{encoded}/Fix%20Repair/{no_space}_Fix_Repair_Steam_Generic.rar'
    
    fix['download_url'] = download_url
    fix['download_urls'] = [download_url]
    updated_dl += 1

print(f'Updated download URLs: {updated_dl}')

# Save
with open(data_path('fixes.json'), 'w', encoding='utf-8') as f:
    json.dump(fixes, f, indent=2, ensure_ascii=False)

print(f'Total fixes: {len(fixes)}')
print('Done!')