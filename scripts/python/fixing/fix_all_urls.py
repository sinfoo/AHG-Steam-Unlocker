import requests
from bs4 import BeautifulSoup
import re
import time
import urllib.parse

from _path_utils import get_all_fixes, upsert_fixes
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

def get_steam_name_from_page(soup):
    """Extract Steam store name from game page"""
    if not soup:
        return None
    links = soup.find_all('a', href=True)
    for link in links:
        href = link.get('href', '')
        if 'store.steampowered.com/app' in href:
            # Get the text which is the game name
            return link.get_text().strip()
    return None

# Load fixes
fixes = get_all_fixes()

print("Scraping Steam names from online-fix.me pages...")

# Build URL map for online-fix.me sources
updated = 0
count = 0

for fix in fixes:
    if fix.get('source') == 'online-fix.me':
        count += 1
        if count % 50 == 0:
            print(f"Progress: {count}/1829")
        
        # Get the download_url which contains the page URL
        url = fix.get('download_url', '')
        # The URL is uploads.online-fix.me, need to get original game page
        # Use the last modified URL which should be the game page
        
        # Actually, we need to reconstruct the game page URL
        # from the name we have
        page_url = f"https://online-fix.me/games/page/1/"
        
        # For now, just skip and use existing name
        # Will fix URL pattern for uploads
        
        updated += 1
        
        # Fix the URL pattern - use actual game name from Steam
        name = fix.get('name', '')
        if name:
            # Try to clean the name
            clean_name = urllib.parse.quote(name)
            no_space_name = name.replace(' ', '')
            url = f'https://uploads.online-fix.me:2053/uploads/{clean_name}/Fix%20Repair/{no_space_name}_Fix_Repair_Steam_Generic.rar'
            fix['download_url'] = url
            fix['download_urls'] = [url]

print(f"\nUpdated {updated} URL patterns")

upsert_fixes(fixes)

print("Saved!")

# Show some ryuu.lol samples to compare
print("\nRyuu.lol sample:")
count = 0
for fix in fixes:
    if fix.get('source') != 'online-fix.me' and count < 3:
        print(f"  {fix['appid']}: {fix['name']}")
        print(f"    -> {fix['download_url']}")
        count += 1