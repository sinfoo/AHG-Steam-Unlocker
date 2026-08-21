import requests
from bs4 import BeautifulSoup
import json
import re
import time

from _path_utils import data_path
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://online-fix.me/',
}

def get_page(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        if resp.status_code in [200, 302, 301]:
            return BeautifulSoup(resp.content, 'html.parser')
    except Exception as e:
        print(f"Error: {e}")
    return None

def extract_download_links(soup):
    """Extract actual download links from page"""
    links = []
    if not soup:
        return links
    
    # Find all links that could be downloads
    for a in soup.find_all('a', href=True):
        href = a['href']
        # Look for download links
        if 'mega' in href.lower() or 'yandex' in href.lower() or 'uploadbaz' in href.lower() or '1fichier' in href.lower() or 'uptobox' in href.lower():
            links.append(href)
        # Look for ext links (which redirect to downloads)
        elif '/ext/' in href:
            links.append(href)
        # Look for uploads.online-fix.me links
        elif 'uploads.online-fix.me' in href:
            links.append(href)
    
    return links

print("Loading fixes...")
with open(data_path('dist-electron/win-unpacked/resources/fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)

print(f"Loaded {len(fixes)} fixes")

# Get fixes that have game_url
need_scraping = [f for f in fixes if f.get('game_url')]
print(f"Need to scrape: {len(need_scraping)}")

found = 0
errors = 0

for i, fix in enumerate(need_scraping[:200]):  # Limit to 200 to avoid timeout
    game_url = fix.get('game_url')
    if not game_url:
        continue
    
    soup = get_page(game_url)
    download_links = extract_download_links(soup)
    
    if download_links:
        # Use the first valid download link
        fix['download_url'] = download_links[0]
        found += 1
        if found <= 5:
            print(f"Found: {fix['name']} -> {download_links[0][:60]}...")
    else:
        errors += 1
    
    time.sleep(0.3)  # Be respectful
    
    if (i + 1) % 50 == 0:
        print(f"Processed {i + 1}: found={found}, errors={errors}")

print(f"\nResults: found={found}, no_download={errors}")

with open(data_path('dist-electron/win-unpacked/resources/fixes.json'), 'w', encoding='utf-8') as f:
    json.dump(fixes, f, indent=2, ensure_ascii=False)

print("Saved!")
print(f"Total with real download_url: {sum(1 for f in fixes if f.get('download_url') and 'ext' in f.get('download_url', ''))}")