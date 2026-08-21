import requests
from bs4 import BeautifulSoup
import json
import re
import time
import urllib.parse

from _path_utils import data_path
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

BASE_URL = 'https://online-fix.me'
UPLOAD_URL = 'https://uploads.online-fix.me:2053/uploads'

def get_page(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        return BeautifulSoup(resp.content, 'html.parser')
    except:
        return None

def get_game_list():
    """Get all game URLs from pagination"""
    games = []
    for page in range(1, 63):
        url = f"{BASE_URL}/games/page/{page}/"
        soup = get_page(url)
        if soup:
            entries = soup.find_all('a', class_='big-link')
            for entry in entries:
                href = entry.get('href', '')
                if '/games/' in href and href.endswith('.html'):
                    games.append(href)
        time.sleep(0.1)
    return games

def extract_download_url(soup, game_name):
    """Extract the actual .rar/.zip download URL from game page"""
    if not soup:
        return None
    
    # Look for uploads.online-fix.me links
    links = soup.find_all('a', href=True)
    for link in links:
        href = link.get('href', '')
        if 'uploads.online-fix.me' in href:
            # Found upload link - now get the actual file
            return href
    
    # Alternative: construct URL from game name
    # Pattern: https://uploads.online-fix.me:2053/uploads/Game%20Name/Fix%20Repair/GameName_Fix_Repair_Steam_Generic.rar
    clean_name = re.sub(r'[^\w\s]', '', game_name).strip()
    clean_name = re.sub(r'\s+', ' ', clean_name)
    url_encoded = urllib.parse.quote(clean_name)
    
    # Try the folder URL
    folder_url = f"{UPLOAD_URL}/{url_encoded}/"
    return folder_url

def main():
    print("Scraping ALL online-fix.me download URLs...")
    
    # Get all game URLs
    print("[1] Getting game list...")
    game_urls = get_game_list()
    print(f"    Found {len(game_urls)} games")
    
    # Load existing fixes to match appids
    print("[2] Loading existing data...")
    with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
        existing = json.load(f)
    existing_map = {g['appid']: g for g in existing}
    
    with open(data_path('games.json'), 'r', encoding='utf-8') as f:
        games_db = json.load(f)
    appid_to_name = {g['appid']: g['name'] for g in games_db if g.get('appid')}
    
    # Scrape download URLs
    print("[3] Scraping download URLs...")
    results = []
    processed = 0
    
    for game_url in game_urls:
        processed += 1
        if processed % 50 == 0:
            print(f"    Progress: {processed}/{len(game_urls)}")
        
        soup = get_page(game_url)
        if not soup:
            continue
        
        # Get game name
        name = game_url.split('/')[-1].replace('.html', '')
        match = re.search(r'\d+-(.+)$', name)
        if match:
            raw_name = match.group(1).replace('-', ' ')
        else:
            raw_name = name
        
        # Try to find appid
        appid = None
        for aid, gname in appid_to_name.items():
            clean_gname = re.sub(r'[^\w\s]', '', gname).lower()
            clean_raw = re.sub(r'[^\w\s]', '', raw_name.lower())
            if clean_gname == clean_raw or clean_gname in clean_raw or clean_raw in clean_gname:
                appid = aid
                break
        
        # Extract download URL
        download_url = extract_download_url(soup, raw_name)
        
        if download_url:
            results.append({
                'url': game_url,
                'name': raw_name,
                'appid': appid,
                'download_url': download_url
            })
        
        time.sleep(0.05)
    
    print(f"\n[4] Total with download URLs: {len(results)}")
    
    # Update fixes.json
    print("[5] Updating fixes.json...")
    updated = 0
    for r in results:
        if r['appid'] and r['appid'] in existing_map:
            fix = existing_map[r['appid']]
            if fix.get('source') == 'online-fix.me':
                fix['download_url'] = r['download_url']
                fix['download_urls'] = [r['download_url']]
                updated += 1
    
    print(f"    Updated {updated} fixes")
    
    with open(data_path('fixes.json'), 'w', encoding='utf-8') as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
    
    # Save scraped results
    with open(data_path('scraped_downloads.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n[6] Done! Saved to fixes.json and scraped_downloads.json")
    
    # Show sample
    print("\nSample download URLs:")
    for r in results[:5]:
        print(f"  {r['appid']}: {r['name']}")
        print(f"    -> {r['download_url']}")

if __name__ == '__main__':
    main()