import requests
from bs4 import BeautifulSoup
import json
import re
import time

from _path_utils import data_path
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

BASE_URL = 'https://online-fix.me'

def get_page(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 520:
            return None
        return BeautifulSoup(resp.content, 'html.parser')
    except:
        return None

def extract_download_url(soup, base_url):
    if not soup:
        return None, None
    
    download_url = None
    game_url = None
    
    links = soup.find_all('a', href=True)
    for link in links:
        href = link['href']
        if 'uploads.online-fix.me' in href and ('rar' in href or 'zip' in href or 'download' in href.lower()):
            download_url = href
            break
    
    if download_url:
        page_url = base_url
    else:
        for link in links:
            href = link['href']
            if '/games/' in href and href.endswith('.html'):
                game_url = href
                break
    
    return download_url, game_url

print("Loading existing fixes...")
with open(data_path('dist-electron/win-unpacked/resources/fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)

print(f"Loaded {len(fixes)} fixes")

need_url = []
for f in fixes:
    if not f.get('download_url') or f.get('download_url') == '':
        if f.get('game_url'):
            need_url.append(f)
        else:
            need_url.append(f)

print(f"Need download URL: {len(need_url)}")

for i, fix in enumerate(need_url[:100]):
    game_url = fix.get('game_url')
    if not game_url:
        name = fix.get('name', '')
        slug = name.lower().replace(' ', '-')
        game_url = f"{BASE_URL}/games/{slug}.html"
    
    soup = get_page(game_url)
    dl_url, new_game_url = extract_download_url(soup, game_url)
    
    if dl_url:
        fix['download_url'] = dl_url
        print(f"{i+1}. Found: {fix['name'][:30]} -> {dl_url[:50]}...")
    elif new_game_url:
        fix['game_url'] = new_game_url
        print(f"{i+1}. Game URL: {fix['name'][:30]}")
    else:
        print(f"{i+1}. NOT FOUND: {fix['name'][:30]}")
    
    time.sleep(0.3)
    
    if (i + 1) % 50 == 0:
        print(f"Processed {i + 1}...")

with open(data_path('dist-electron/win-unpacked/resources/fixes.json'), 'w', encoding='utf-8') as f:
    json.dump(fixes, f, indent=2, ensure_ascii=False)

print(f"\nSaved! Total: {len(fixes)}")
with_download = sum(1 for f in fixes if f.get('download_url'))
print(f"With download URL: {with_download}")