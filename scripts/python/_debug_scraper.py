"""Debug the scraper - test imports and first entry"""
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
print("sys.path OK")

from _path_utils import data_path, get_all_fixes
print(f"data_path OK: {data_path('.')}")

fixes = get_all_fixes()
targets = [(i, f) for i, f in enumerate(fixes)
           if f.get('source') == 'online-fix.me' and not f.get('download_url')]

print(f"Total fixes: {len(fixes)}")
print(f"Targets needing download_url: {len(targets)}")

if targets:
    idx, entry = targets[0]
    appid = entry.get('appid', '?')
    name = entry.get('name', '?')
    game_url = entry.get('game_url', '')
    print(f"First target: appid={appid} name={name}")
    print(f"  game_url: {game_url}")
    
    # Test HTTP request
    import requests
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    print(f"  Testing HTTP to: {game_url}")
    try:
        resp = requests.get(game_url, headers=headers, timeout=10)
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.content, 'html.parser')
            links = soup.find_all('a', href=True)
            upload_links = [l.get('href','') for l in links if 'uploads.online-fix.me' in l.get('href','')]
            print(f"  Upload links found: {len(upload_links)}")
            for ul in upload_links[:3]:
                print(f"    {ul[:120]}")
    except Exception as e:
        print(f"  ERROR: {e}")

print("\nDebug complete")
