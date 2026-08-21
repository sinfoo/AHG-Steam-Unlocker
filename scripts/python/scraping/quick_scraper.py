import requests
from bs4 import BeautifulSoup
import json
import re
import time
import urllib.parse

HEADERS = {'User-Agent': 'Mozilla/5.0'}

def get_game_info(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=8)
        soup = BeautifulSoup(resp.content, 'html.parser')
        
        # Find Steam name
        steam_name = None
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            if 'store.steampowered.com' in href:
                text = link.get_text().strip()
                if text and len(text) > 2:
                    steam_name = text
                    break
        
        if not steam_name:
            name = url.split('/')[-1].replace('.html', '')
            match = re.search(r'\d+-(.+)$', name)
            if match:
                steam_name = match.group(1).replace('-', ' ')
        
        if steam_name:
            clean = urllib.parse.quote(steam_name)
            no_space = steam_name.replace(' ', '')
            download = f'https://uploads.online-fix.me:2053/uploads/{clean}/Fix%20Repair/{no_space}_Fix_Repair_Steam_Generic.rar'
            return {'url': url, 'name': steam_name, 'download': download}
    except:
        pass
    return None

# Get URLs from first 10 pages only
print("Getting game URLs from pages 1-10...")
urls = []
for page in range(1, 11):
    soup = BeautifulSoup(requests.get(f'https://online-fix.me/games/page/{page}/', headers=HEADERS, timeout=8).content, 'html.parser')
    for entry in soup.find_all('a', class_='big-link'):
        href = entry.get('href', '')
        if '/games/' in href and href.endswith('.html'):
            urls.append(href)
    print(f"Page {page}: {len(urls)} total")
    time.sleep(0.1)

print(f"\nProcessing {len(urls)} games...")
results = []
for i, url in enumerate(urls):
    if i % 50 == 0:
        print(f"Progress: {i}/{len(urls)}")
    info = get_game_info(url)
    if info:
        results.append(info)
    time.sleep(0.05)

print(f"\nGot info for {len(results)} games")

# Save
    with open(data_path('scraped_sample.json'), 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("\nSample:")
for r in results[:3]:
    print(f"  {r['name']} -> {r['download']}")