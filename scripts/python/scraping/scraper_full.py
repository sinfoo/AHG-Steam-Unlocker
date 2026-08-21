import requests
from bs4 import BeautifulSoup
import json
import re
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

from _path_utils import data_path
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

def get_page(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        return BeautifulSoup(resp.content, 'html.parser')
    except:
        return None

def get_game_info(game_url):
    """Extract game name and download URL from a game page"""
    soup = get_page(game_url)
    if not soup:
        return None
    
    # Get Steam game name from the page
    steam_name = None
    links = soup.find_all('a', href=True)
    for link in links:
        href = link.get('href', '')
        if 'store.steampowered.com' in href:
            # The text content is the game name
            text = link.get_text().strip()
            if text:
                steam_name = text
                break
    
    # If no Steam link found, use the URL slug
    if not steam_name:
        name = game_url.split('/')[-1].replace('.html', '')
        match = re.search(r'\d+-(.+)$', name)
        if match:
            steam_name = match.group(1).replace('-', ' ')
    
    # Construct download URL with the Steam name
    if steam_name:
        clean_name = urllib.parse.quote(steam_name)
        no_space_name = steam_name.replace(' ', '')
        download_url = f'https://uploads.online-fix.me:2053/uploads/{clean_name}/Fix%20Repair/{no_space_name}_Fix_Repair_Steam_Generic.rar'
        return {
            'url': game_url,
            'steam_name': steam_name,
            'download_url': download_url
        }
    return None

def main():
    print("Scraping ALL online-fix.me games for Steam names and download URLs...")
    
    # Get all game URLs
    print("[1] Getting game list...")
    game_urls = []
    for page in range(1, 63):
        url = f"https://online-fix.me/games/page/{page}/"
        soup = get_page(url)
        if soup:
            entries = soup.find_all('a', class_='big-link')
            for entry in entries:
                href = entry.get('href', '')
                if '/games/' in href and href.endswith('.html'):
                    game_urls.append(href)
        if page % 10 == 0:
            print(f"  Page {page}/62 - {len(game_urls)} games found")
        time.sleep(0.1)
    
    print(f"\n[2] Found {len(game_urls)} game pages")
    
    # Process in parallel for speed
    print("[3] Scraping Steam names and download URLs...")
    results = []
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(get_game_info, url): url for url in game_urls}
        done = 0
        for future in as_completed(futures):
            done += 1
            if done % 100 == 0:
                print(f"  Progress: {done}/{len(game_urls)}")
            try:
                result = future.result()
                if result:
                    results.append(result)
            except:
                pass
    
    print(f"\n[4] Got info for {len(results)} games")
    
    # Save results
    with open(data_path('scraped_games_full.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # Update fixes.json
    print("[5] Updating fixes.json...")
    with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
        fixes = json.load(f)
    
    # Build appid -> result map
    appid_to_result = {}
    for r in results:
        # Try to match by name
        clean_result_name = re.sub(r'[^\w\s]', '', r['steam_name'].lower())
        for fix in fixes:
            if fix.get('source') == 'online-fix.me':
                fix_name = fix.get('name', '')
                clean_fix_name = re.sub(r'[^\w\s]', '', fix_name.lower())
                if clean_result_name == clean_fix_name or clean_result_name in clean_fix_name:
                    appid_to_result[fix['appid']] = r
                    break
    
    updated = 0
    for fix in fixes:
        if fix.get('source') == 'online-fix.me':
            appid = fix['appid']
            if appid in appid_to_result:
                r = appid_to_result[appid]
                fix['name'] = r['steam_name']
                fix['download_url'] = r['download_url']
                fix['download_urls'] = [r['download_url']]
                updated += 1
    
    print(f"    Updated {updated} fixes with Steam names and correct URLs")
    
    with open(data_path('fixes.json'), 'w', encoding='utf-8') as f:
        json.dump(fixes, f, indent=2, ensure_ascii=False)
    
    print("\n[6] Done!")
    
    # Show samples
    print("\nSample download URLs:")
    for r in results[:5]:
        print(f"  {r['steam_name']}")
        print(f"    -> {r['download_url']}")

if __name__ == '__main__':
    main()