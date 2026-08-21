"""Test: resolve /ext/ redirect to find Steam appid from online-fix.me game pages"""
import requests
import re
from bs4 import BeautifulSoup

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

# Test on a few unmatched game URLs
test_urls = [
    'https://online-fix.me/games/adventures/18067-last-man-sitting-online.html',
    'https://online-fix.me/games/survival/17320-dayz-dayzavr-po-seti.html',
    'https://online-fix.me/games/puzzles/18069-together-moon-escape-po-seti.html',
]

for url in test_urls:
    print(f'\n=== {url} ===')
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(r.content, 'html.parser')
        
        # Find all links with ext/ in href
        ext_links = []
        all_links = soup.find_all('a', href=True)
        for link in all_links:
            href = link.get('href', '')
            if '/ext/' in href:
                ext_links.append({
                    'href': href,
                    'text': link.get_text(strip=True)[:100],
                    'title': link.get('title', '')[:100]
                })
        
        print(f'Ext links found: {len(ext_links)}')
        for el in ext_links[:3]:
            print(f'  href: {el["href"][:120]}')
            print(f'  text: {el["text"]}')
            print(f'  title: {el["title"]}')
        
        # Follow the /ext/ redirect to find the Steam URL
        if ext_links:
            ext_url = ext_links[0]['href']
            if ext_url.startswith('/'):
                ext_url = 'https://online-fix.me' + ext_url
            
            # HEAD request (no redirect follow) to see Location header
            try:
                s = requests.Session()
                s.max_redirects = 0
                resp = s.get(ext_url, headers=HEADERS, timeout=10, allow_redirects=False)
                print(f'\nExt redirect response: {resp.status_code}')
                print(f'Location header: {resp.headers.get("Location", "NONE")}')
                
                if resp.headers.get('Location'):
                    location = resp.headers['Location']
                    # Extract appid from Steam URL
                    appid_match = re.search(r'/app/(\d+)', location)
                    if appid_match:
                        print(f'Steam appid: {appid_match.group(1)}')
            except Exception as e:
                print(f'Redirect follow error: {e}')
                
                # Try with redirect following
                try:
                    resp2 = requests.get(ext_url, headers=HEADERS, timeout=10, allow_redirects=True)
                    print(f'Final URL: {resp2.url}')
                    appid_match = re.search(r'/app/(\d+)', resp2.url)
                    if appid_match:
                        print(f'Steam appid (followed): {appid_match.group(1)}')
                except Exception as e2:
                    print(f'Follow error: {e2}')
        
    except Exception as e:
        print(f'Error: {e}')
