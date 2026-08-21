import json
import requests
from bs4 import BeautifulSoup
import re

# Load the unmatched from matched_online_fix.json
matched = json.load(open('data/matched_online_fix.json','r',encoding='utf-8'))
unmatched = matched.get('unmatched', [])

print(f'Total unmatched: {len(unmatched)}')

# Check a few unmatched game pages to see if they have Steam appid info
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

for u in unmatched[:5]:
    name = u.get('name', 'unknown')
    url = u.get('url', '')
    print(f'\n--- {name} ---')
    print(f'URL: {url}')
    
    if not url:
        continue
    
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(r.content, 'html.parser')
        
        # Look for Steam store links
        links = soup.find_all('a', href=True)
        steam_links = []
        for link in links:
            href = link.get('href', '')
            if 'steampowered.com' in href or 'store.steampowered.com' in href:
                steam_links.append(href)
                # Extract appid from Steam URL
                appid_match = re.search(r'/app/(\d+)', href)
                if appid_match:
                    print(f'  Steam appid found: {appid_match.group(1)} -> {href}')
        
        if not steam_links:
            print(f'  No Steam links found')
            
        # Also look for the game title / header that might contain info
        h1 = soup.find('h1')
        if h1:
            print(f'  Title: {h1.get_text(strip=True)[:100]}')
            
    except Exception as e:
        print(f'  Error: {e}')

# Also check the scraped_online_fix.json unmatched for similar analysis
scraped = json.load(open('data/scraped_online_fix.json','r',encoding='utf-8'))
scraped_unmatched = scraped.get('unmatched', [])
print(f'\n\nScraped unmatched: {len(scraped_unmatched)}')

# Get scores distribution
scores = {}
for u in scraped_unmatched:
    score = u.get('best_fuzzy_score', 0)
    bucket = int(score * 10) / 10
    scores[bucket] = scores.get(bucket, 0) + 1

print('Score distribution (scraped unmatched):')
for bucket in sorted(scores.keys()):
    print(f'  {bucket:.1f}-{bucket+0.1:.1f}: {scores[bucket]}')
