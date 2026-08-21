import requests
from bs4 import BeautifulSoup
import json
import re
import time
import threading
from queue import Queue

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

BASE_URL = 'https://online-fix.me'

game_urls = Queue()
all_games = []
lock = threading.Lock()

def get_page(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return BeautifulSoup(resp.content, 'html.parser')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def extract_games_from_page(soup):
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
                    games.append({
                        'url': href,
                        'name': game_name.strip().lower()
                    })
            except:
                pass
    return games

def scrape_page(page_num):
    url = f"{BASE_URL}/games/page/{page_num}/"
    soup = get_page(url)
    if soup:
        games = extract_games_from_page(soup)
        with lock:
            all_games.extend(games)
        return len(games)
    return 0

def scrape_by_category(category, max_pages=10):
    urls = [
        f"{BASE_URL}/games/{category}/page/1/",
        f"{BASE_URL}/games/{category}/",
    ]
    for url in urls:
        soup = get_page(url)
        if soup:
            games = extract_games_from_page(soup)
            with lock:
                all_games.extend(games)
            
            for page in range(2, max_pages + 1):
                page_url = url.replace('/page/1/', f'/page/{page}/')
                soup = get_page(page_url)
                if soup:
                    games = extract_games_from_page(soup)
                    if not games:
                        break
                    with lock:
                        all_games.extend(games)
                time.sleep(0.2)

print("Scraping online-fix.me...")

categories = [
    'action', 'adventures', 'arcade', 'horror', 'indie', 
    'multiplayer', 'puzzles', 'racing', 'rpg', 'sandbox',
    'shooter', 'simulator', 'sports', 'strategy', 'survival'
]

for category in categories:
    print(f"Scraping category: {category}")
    scrape_by_category(category, max_pages=15)
    time.sleep(0.3)

print(f"\nScraping all pages 1-100...")
for page in range(1, 101):
    count = scrape_page(page)
    if page % 20 == 0:
        print(f"Page {page}: total {len(all_games)}")
    time.sleep(0.15)

seen = set()
unique = []
for g in all_games:
    key = g['name'].lower().strip()
    if key and key not in seen:
        seen.add(key)
        unique.append(g)

print(f"\nTotal scraped: {len(all_games)}")
print(f"Unique games: {len(unique)}")

output = {
    'source': 'online-fix.me',
    'total_scraped': len(unique),
    'games': unique
}

    with open(data_path('scraped_online_fix_v2.json'), 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"Saved to scraped_online_fix_v2.json")