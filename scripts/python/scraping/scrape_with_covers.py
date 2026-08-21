from _path_utils import data_path
import requests
import re
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import OrderedDict

print("=== SCRAPING ONLINE-FIX.ME WITH COVERS ===")
print()

def get_game_data_from_listing(page_url):
    """Extract game URLs and covers from listing pages"""
    games = []
    try:
        resp = requests.get(page_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=20)
        if resp.status_code == 200:
            # Extract cover images and game URLs
            # Pattern: data-src="https://online-fix.me/uploads/..." followed by link
            pattern = r'<a class="img" href="(https://online-fix\.me/games/[^"]+)"><img[^>]+data-src="(https://online-fix\.me/uploads/[^"]+)"'
            matches = re.findall(pattern, resp.text)
            
            for url, cover in matches:
                if any(x in url for x in ['/games/page', '/games/tag', '/games/search']):
                    continue
                # Extract appid from URL
                match = re.search(r'/games/[^/]+/(\d+)-(.+)\.html', url)
                if match:
                    appid = match.group(1)
                    slug = match.group(2)
                    # Extract cover hash
                    cover_match = re.search(r'/(\d+)_poster\.jpg', cover)
                    cover_hash = cover_match.group(1) if cover_match else None
                    
                    games.append({
                        'url': url,
                        'appid': appid,
                        'slug': slug,
                        'cover': cover if cover_hash else None
                    })
    except Exception as e:
        print(f"Error fetching {page_url}: {e}")
    return games

# Scrape pages 1-62 in batches
all_games = OrderedDict()
page_count = 62

print(f"Scraping {page_count} pages...")

for page in range(1, page_count + 1):
    url = f"https://online-fix.me/games/page/{page}/"
    games = get_game_data_from_listing(url)
    
    for g in games:
        if g['appid'] not in all_games:
            all_games[g['appid']] = g
    
    if page % 10 == 0:
        print(f"  Page {page}: {len(all_games)} unique games")
    
    time.sleep(0.2)  # Polite delay

print(f"\nTotal unique games: {len(all_games)}")

# Convert to fixes
fixes = []
for appid, game in all_games.items():
    # Parse name from slug
    slug = game['slug'].replace('-po-seti', '').replace('-', ' ')
    name = slug.title()
    
    fix = {
        "appid": appid,
        "name": name,
        "badges": ["Online"],
        "fix_count": 1,
        "download_url": f"https://uploads.online-fix.me:2053/uploads/{game['slug'].replace('-po-seti', '')}/Fix%20Repair",
        "download_urls": [f"https://uploads.online-fix.me:2053/uploads/{game['slug'].replace('-po-seti', '')}/Fix%20Repair"],
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
    print(f"Could not add ryuu.lol fixes: {e}")

print(f"Total fixes: {len(fixes)}")
print(f"Fixes with covers: {len([f for f in fixes if f.get('cover')])}")

# Save
output_path = rdata_path('fixes.json')
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(fixes, f, indent=2, ensure_ascii=False)

print(f"\nSaved to {output_path}")