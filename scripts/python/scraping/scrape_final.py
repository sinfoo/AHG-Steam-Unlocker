from _path_utils import data_path
import requests
import re
import json
import time

print("=== SCRAPING AND DEDUPLICATING ===")
print()

# Load existing
try:
    with open(rdata_path('fixes.json'), 'r', encoding='utf-8') as f:
        existing = json.load(f)
except:
    existing = []

existing_ids = {f['appid'] for f in existing}
print(f"Existing: {len(existing)}")

all_urls = set()

# Scrape all 62 pages
for page in range(1, 63):
    if page % 10 == 1:
        print(f"Page {page}...", end=" ")
    
    url = f"https://online-fix.me/games/page/{page}/"
    
    try:
        resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
        
        if resp.status_code == 200:
            links = re.findall(r'href="(https://online-fix\.me/games/[^"]+)"', resp.text, re.IGNORECASE)
            
            for link in links:
                if any(x in link for x in ['/games/page', '/games/tag', '/games/search', '/auth', '/register', '/login']):
                    continue
                all_urls.add(link)
        
        if page % 10 == 0:
            print(f"{len(all_urls)} total")
            
    except Exception as e:
        print(f"Error: {e}")
    
    time.sleep(0.3)

print(f"Final: {len(all_urls)}")
print()

# Create new fixes
new_fixes = []
seen_ids = set()

for game_url in all_urls:
    match = re.search(r'/games/[^/]+/(\d+)-(.+)\.html', game_url)
    if match:
        appid = match.group(1)
        slug = match.group(2).replace('-po-seti', '')
        
        if appid in seen_ids:
            continue
        seen_ids.add(appid)
        
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

print(f"New online-fix.me fixes: {len(new_fixes)}")

# Keep ryuu.lol fixes from existing
ryuu_fixes = [f for f in existing if f.get('source') == 'ryuu.lol']
print(f"Keeping ryuu.lol fixes: {len(ryuu_fixes)}")

# Merge
merged = new_fixes + ryuu_fixes
print(f"Total merged: {len(merged)}")

# Save to ROOT folder (where build reads from)
with open(rdata_path('fixes.json'), 'w', encoding='utf-8') as f:
    json.dump(merged, f, indent=2, ensure_ascii=False)

print()
print("Saved to root fixes.json")

# Verify
with open(rdata_path('fixes.json'), 'r', encoding='utf-8') as f:
    verify = json.load(f)
print(f"Verified: {len(verify)}")