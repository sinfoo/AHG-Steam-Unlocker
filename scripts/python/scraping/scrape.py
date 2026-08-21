from _path_utils import data_path
import requests
import re
import json
import time

print("=== SCRAPING ONLINE-FIX.ME ===")
print()

# Load existing fixes
with open(rdata_path('dist-electron\win-unpacked\resources\fixes.json'), 'r', encoding='utf-8') as f:
    existing = json.load(f)

existing_ids = {f['appid'] for f in existing}
print(f"Existing fixes: {len(existing)}")

all_urls = set()

# Scrape all 62 pages
for page in range(1, 63):
    if page % 10 == 1:
        print(f"Page {page}...", end=" ")
    
    url = f"https://online-fix.me/games/page/{page}/"
    
    try:
        resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
        
        if resp.status_code == 200:
            # Find all game links
            links = re.findall(r'href="(https://online-fix\.me/games/[^"]+)"', resp.text, re.IGNORECASE)
            
            for link in links:
                # Skip non-game links
                if any(x in link for x in ['/games/page', '/games/tag', '/games/search', '/auth', '/register', '/login']):
                    continue
                all_urls.add(link)
        
        if page % 10 == 0:
            print(f"{len(all_urls)} total")
            
    except Exception as e:
        print(f"Error page {page}: {e}")
    
    time.sleep(0.3)

print(f"Final: {len(all_urls)}")
print()
print("=== PROCESSING ===")

new_fixes = []
seen = set()

for game_url in all_urls:
    match = re.search(r'/games/[^/]+/(\d+)-(.+)\.html', game_url)
    if match:
        appid = match.group(1)
        slug = match.group(2).replace('-po-seti', '')
        
        if appid in existing_ids or appid in seen:
            continue
        seen.add(appid)
        
        # Clean name
        name = slug.replace('-', ' ').title()
        
        fix = {
            "appid": appid,
            "name": name,
            "badges": ["Online"],
            "fix_count": 1,
            "download_url": f"https://uploads.online-fix.me:2053/uploads/{slug}/Fix%20Repair",
            "download_urls": [f"https://uploads.online-fix.me:2053/uploads/{slug}/Fix%20Repair"],
            "source": "online-fix.me",
            "game_url": game_url
        }
        new_fixes.append(fix)

print(f"New games found: {len(new_fixes)}")

if new_fixes:
    merged = existing + new_fixes
    
    with open(rdata_path('dist-electron\win-unpacked\resources\fixes.json'), 'w', encoding='utf-8') as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
    
    print(f"Saved! Total: {len(merged)}")
    
    # Verify
    with open(rdata_path('dist-electron\win-unpacked\resources\fixes.json'), 'r', encoding='utf-8') as f:
        verify = json.load(f)
    print(f"Verified: {len(verify)}")
else:
    print("Nothing new to add.")