import json
import requests
from bs4 import BeautifulSoup
import re
import urllib.parse

from _path_utils import data_path
print('=== Reimporting online-fix.me fixes from scratch ===')

# Load games database
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

appid_to_name = {g['appid']: g['name'] for g in games if g.get('appid')}
name_to_appid = {g['name'].lower(): g['appid'] for g in games if g.get('appid')}

print(f'Steam games: {len(appid_to_name)}')

# First, scrape ALL game pages from online-fix.me
print('\nScraping online-fix.me game pages...')
session = requests.Session()
session.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})

all_online_games = []
for page in range(1, 63):
    try:
        url = f'https://online-fix.me/games/page/{page}/'
        resp = session.get(url, timeout=5)
        soup = BeautifulSoup(resp.content, 'html.parser')
        entries = soup.find_all('a', class_='big-link')
        for entry in entries:
            href = entry.get('href', '')
            if '/games/' in href and href.endswith('.html'):
                name_raw = href.split('/')[-1].replace('.html', '')
                match = re.search(r'\d+-(.+)$', name_raw)
                if match:
                    name_clean = match.group(1).replace('-', ' ')
                    # Extract category from URL
                    cat_match = re.search(r'/games/(\w+)/', href)
                    category = cat_match.group(1) if cat_match else 'games'
                    all_online_games.append({
                        'url': href,
                        'name': name_clean,
                        'category': category
                    })
        if page % 20 == 0:
            print(f'Page {page}: {len(all_online_games)} games')
    except Exception as e:
        print(f'Page {page} error: {e}')
        break

print(f'Total online-fix.me games: {len(all_online_games)}')

# Create lookup
game_lookup = {g['name'].lower(): g for g in all_online_games}

# Now create fixes for all online-fix.me games
print('\nMatching to Steam appids...')

def clean_for_match(name):
    name = str(name).lower().strip()
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'\s+po-seti$', '', name)
    return name

new_fixes = []
used_appids = set()

# Match by name
for og in all_online_games:
    name = og['name']
    clean = clean_for_match(name)
    
    # Try exact match first
    if clean in name_to_appid:
        appid = name_to_appid[clean]
        if appid not in used_appids:
            used_appids.add(appid)
            encoded = urllib.parse.quote(name)
            no_space = name.replace(' ', '')
            download_url = f'https://uploads.online-fix.me:2053/uploads/{encoded}/Fix%20Repair/{no_space}_Fix_Repair_Steam_Generic.rar'
            
            new_fixes.append({
                'appid': appid,
                'name': name,
                'badges': ['Online'],
                'fix_count': 1,
                'download_url': download_url,
                'download_urls': [download_url],
                'game_url': og['url'],
                'source': 'online-fix.me'
            })
            continue
    
    # Try fuzzy match
    matched = False
    for steam_name, steam_appid in name_to_appid.items():
        if steam_appid in used_appids:
            continue
        steam_clean = clean_for_match(steam_name)
        if clean == steam_clean or (len(clean) > 3 and (clean in steam_clean or steam_clean in clean)):
            used_appids.add(steam_appid)
            encoded = urllib.parse.quote(name)
            no_space = name.replace(' ', '')
            download_url = f'https://uploads.online-fix.me:2053/uploads/{encoded}/Fix%20Repair/{no_space}_Fix_Repair_Steam_Generic.rar'
            
            new_fixes.append({
                'appid': steam_appid,
                'name': name,
                'badges': ['Online'],
                'fix_count': 1,
                'download_url': download_url,
                'download_urls': [download_url],
                'game_url': og['url'],
                'source': 'online-fix.me'
            })
            matched = True
            break

print(f'Matched online-fix.me games: {len(new_fixes)}')

# Add ALL online-fix.me games even if they don't match Steam
print('\nAdding unmatched games...')
for og in all_online_games:
    name = og['name']
    clean = clean_for_match(name)
    
    if clean in name_to_appid:
        continue
    
    matched = False
    for steam_name, steam_appid in name_to_appid.items():
        if steam_appid in used_appids:
            continue
        steam_clean = clean_for_match(steam_name)
        if clean == steam_clean or (len(clean) > 3 and (clean in steam_clean or steam_clean in clean)):
            matched = True
            break
    
    if not matched:
        used_appids.add(clean)
        encoded = urllib.parse.quote(name)
        no_space = name.replace(' ', '')
        download_url = f'https://uploads.online-fix.me:2053/uploads/{encoded}/Fix%20Repair/{no_space}_Fix_Repair_Steam_Generic.rar'
        
        new_fixes.append({
            'appid': f'online_{clean[:20]}',
            'name': name,
            'badges': ['Online'],
            'fix_count': 1,
            'download_url': download_url,
            'download_urls': [download_url],
            'game_url': og['url'],
            'source': 'online-fix.me'
        })

unmatched = len(new_fixes) - 1766
print(f'Unmatched added: {unmatched}')

# Load existing ryuu.lol fixes
with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    existing = json.load(f)

ryuu_fixes = [f for f in existing if f.get('source') == 'ryuu.lol']
print(f'Existing ryuu.lol: {len(ryuu_fixes)}')

# Combine
all_fixes = ryuu_fixes + new_fixes
print(f'Total fixes: {len(all_fixes)}')

# Save
with open(data_path('fixes.json'), 'w', encoding='utf-8') as f:
    json.dump(all_fixes, f, indent=2, ensure_ascii=False)

print('Done!')
print(f'- ryuu.lol: {len(ryuu_fixes)}')
print(f'- online-fix.me: {len(new_fixes)}')