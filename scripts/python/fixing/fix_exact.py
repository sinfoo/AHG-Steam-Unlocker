import requests
from bs4 import BeautifulSoup
import re
import time
import urllib.parse

from _path_utils import get_all_games, get_all_fixes, upsert_fixes
HEADERS = {'User-Agent': 'Mozilla/5.0'}

def get_steam_name(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=8)
        soup = BeautifulSoup(resp.content, 'html.parser')
        for link in soup.find_all('a', href=True):
            if 'store.steampowered.com' in link.get('href', ''):
                text = link.get_text().strip()
                if text and len(text) > 2:
                    return text
        # Fallback: parse URL slug
        name = url.split('/')[-1].replace('.html', '')
        match = re.search(r'\d+-(.+)$', name)
        if match:
            return match.group(1).replace('-', ' ')
    except:
        pass
    return None

# Load games
games = get_all_games()

# Build exact name -> appid map (case insensitive)
name_to_appid = {}
for g in games:
    name = g.get('name', '')
    if name:
        name_to_appid[name.lower()] = g['appid']

# Load fixes
fixes = get_all_fixes()

# Process first 10 pages for now (300 games)
print("Scraping first 10 pages...")
game_info = {}

for page in range(1, 11):
    url = f'https://online-fix.me/games/page/{page}/'
    try:
        resp = requests.get(url, headers=HEADERS, timeout=8)
        soup = BeautifulSoup(resp.content, 'html.parser')
        for entry in soup.find_all('a', class_='big-link'):
            href = entry.get('href', '')
            if '/games/' in href and href.endswith('.html'):
                steam_name = get_steam_name(href)
                if steam_name:
                    clean_name = steam_name.lower().strip()
                    if clean_name in name_to_appid:
                        appid = name_to_appid[clean_name]
                        if appid not in game_info:
                            game_info[appid] = {
                                'steam_name': steam_name,
                                'url': href
                            }
    except Exception as e:
        print(f"Error page {page}: {e}")
    print(f"Page {page}/10")
    time.sleep(0.1)

print(f"\nFound {len(game_info)} exact matches")

# Update fixes
updated = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me':
        appid = fix.get('appid')
        if appid in game_info:
            info = game_info[appid]
            steam_name = info['steam_name']
            encoded = urllib.parse.quote(steam_name)
            no_space = steam_name.replace(' ', '')
            download_url = f'https://uploads.online-fix.me:2053/uploads/{encoded}/Fix%20Repair/{no_space}_Fix_Repair_Steam_Generic.rar'
            fix['name'] = steam_name
            fix['download_url'] = download_url
            fix['download_urls'] = [download_url]
            updated += 1

print(f"Updated {updated} fixes")

upsert_fixes(fixes)

# Show samples
print("\nSamples:")
for fix in fixes:
    if fix.get('source') == 'online-fix.me' and fix['appid'] in game_info:
        print(f"  {fix['appid']}: {fix['name']}")
        print(f"    -> {fix['download_url']}")
        break