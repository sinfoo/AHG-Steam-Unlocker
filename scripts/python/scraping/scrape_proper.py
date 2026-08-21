from _path_utils import data_path
import requests
import re
import json
import time
from collections import OrderedDict
from html.parser import HTMLParser

class GamePageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_img = False
        self.in_link = False
        self.current_link = None
        self.current_img = None
        self.games = []
    
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'a':
            if attrs_dict.get('class') == 'img':
                self.in_link = True
                self.current_link = attrs_dict.get('href')
        elif tag == 'img' and self.in_link:
            if 'data-src' in attrs_dict:
                self.current_img = attrs_dict['data-src']
    
    def handle_endtag(self, tag):
        if tag == 'a' and self.in_link:
            if self.current_link and self.current_img:
                self.games.append((self.current_link, self.current_img))
            self.in_link = False
            self.current_link = None
            self.current_img = None

def scrape_page(page_num):
    url = f"https://online-fix.me/games/page/{page_num}/"
    try:
        resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=20)
        if resp.status_code == 200:
            parser = GamePageParser()
            parser.feed(resp.text)
            return parser.games
    except Exception as e:
        print(f"Error page {page_num}: {e}")
    return []

print("=== SCRAPING WITH PROPER COVER EXTRACTION ===\n")

# Scrape all pages
all_games = OrderedDict()

for page in range(1, 63):
    games = scrape_page(page)
    for game_url, cover in games:
        # Skip non-game links
        if any(x in game_url for x in ['/games/page', '/games/tag', '/games/search', 'rss']):
            continue
        
        # Extract appid
        match = re.search(r'/games/[^/]+/(\d+)-', game_url)
        if match:
            appid = match.group(1)
            if appid not in all_games:
                all_games[appid] = {
                    'url': game_url,
                    'cover': cover
                }
    
    if page % 10 == 0:
        print(f"Page {page}: {len(all_games)} unique games")
    
    time.sleep(0.15)

print(f"\nTotal unique games: {len(all_games)}")

# Create fixes
fixes = []
for appid, game in all_games.items():
    slug_match = re.search(r'/games/[^/]+/\d+-(.+)\.html', game['url'])
    slug = slug_match.group(1) if slug_match else ''
    name = slug.replace('-po-seti', '').replace('-', ' ').title()
    
    fix = {
        "appid": appid,
        "name": name,
        "badges": ["Online"],
        "fix_count": 1,
        "download_url": f"https://uploads.online-fix.me:2053/uploads/{slug.replace('-po-seti', '')}/Fix%20Repair",
        "download_urls": [f"https://uploads.online-fix.me:2053/uploads/{slug.replace('-po-seti', '')}/Fix%20Repair"],
        "source": "online-fix.me",
        "game_url": game['url'],
        "cover": game['cover']
    }
    fixes.append(fix)

# Add ryuu.lol fixes
try:
    with open(rdata_path('backup_v0.4\fixes.json'), 'r', encoding='utf-8') as f:
        ryuu = json.load(f)
    ryuu_fixes = [f for f in ryuu if f.get('source') == 'ryuu.lol']
    print(f"Adding {len(ryuu_fixes)} ryuu.lol fixes")
    fixes.extend(ryuu_fixes)
except Exception as e:
    print(f"Could not add ryuu.lol: {e}")

print(f"Total fixes: {len(fixes)}")

# Stats
with_covers = len([f for f in fixes if f.get('cover')])
print(f"With covers: {with_covers}")

# Save
output = rdata_path('fixes.json')
with open(output, 'w', encoding='utf-8') as f:
    json.dump(fixes, f, indent=2, ensure_ascii=False)

print(f"\nSaved to {output}")