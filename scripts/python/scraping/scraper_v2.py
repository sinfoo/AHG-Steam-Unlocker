import requests
from bs4 import BeautifulSoup
import json
import re
import time

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

BASE_URL = 'https://online-fix.me'

def get_page(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=5)
        if resp.status_code == 520:
            return None
        resp.raise_for_status()
        return BeautifulSoup(resp.content, 'html.parser')
    except:
        return None

def extract_games(soup):
    games = []
    if not soup:
        return games
    entries = soup.find_all('a', class_='big-link')
    for entry in entries:
        href = entry.get('href', '')
        if '/games/' in href and href.endswith('.html'):
            try:
                name = href.split('/')[-1].replace('.html', '')
                match = re.search(r'\d+-(.+)$', name)
                if match:
                    game_name = match.group(1).replace('-', ' ')
                    game_name = re.sub(r'\s+po\s+seti$', '', game_name)
                    games.append({'url': href, 'name': game_name.strip().lower()})
            except:
                pass
    return games

print("Scraping online-fix.me pages...")
all_games = []

for page in range(1, 63):
    url = f"{BASE_URL}/games/page/{page}/"
    soup = get_page(url)
    if soup:
        games = extract_games(soup)
        all_games.extend(games)
        print(f"Page {page}: +{len(games)} = {len(all_games)}")
    else:
        print(f"Page {page}: FAILED")
    time.sleep(0.2)

seen = set()
unique = []
for g in all_games:
    key = g['name'].lower().strip()
    if key and key not in seen:
        seen.add(key)
        unique.append(g)

print(f"\nUnique: {len(unique)}")

    with open(data_path('scraped_v2.json'), 'w') as f:
    json.dump({'games': unique}, f, indent=2)
print("Saved to scraped_v2.json")