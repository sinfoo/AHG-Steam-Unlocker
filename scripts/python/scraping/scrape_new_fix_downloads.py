"""
Scrape download URLs for newly imported online-fix.me fixes.
Fast mode: construct URLs from game names (same fallback the scraper uses).
"""
import json
import re
import urllib.parse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _path_utils import data_path

UPLOAD_URL = 'https://uploads.online-fix.me:2053/uploads'

def construct_upload_url(game_name):
    clean_name = re.sub(r'[^\w\s]', '', game_name).strip()
    clean_name = re.sub(r'\s+', ' ', clean_name)
    url_encoded = urllib.parse.quote(clean_name)
    return f"{UPLOAD_URL}/{url_encoded}/"

def main():
    fix_path = data_path('fixes.json')
    
    with open(fix_path, 'r', encoding='utf-8') as f:
        fixes = json.load(f)
    
    target_indices = [
        i for i, f in enumerate(fixes)
        if f.get('source') == 'online-fix.me'
        and not f.get('download_url')
    ]
    
    total = len(target_indices)
    print(f"Entries needing download URLs: {total}")
    
    if not total:
        print("Nothing to do!")
        return
    
    for idx in target_indices:
        entry = fixes[idx]
        name = entry.get('name', '')
        download_url = construct_upload_url(name)
        entry['download_url'] = download_url
        entry['download_urls'] = [download_url]
    
    with open(fix_path, 'w', encoding='utf-8') as f:
        json.dump(fixes, f, indent=2, ensure_ascii=False)
    
    empty_remaining = sum(1 for f in fixes
                          if f.get('source') == 'online-fix.me' and not f.get('download_url'))
    print(f"Done. Empty remaining: {empty_remaining}")
    print(f"Total online-fix.me with download_url: "
          f"{sum(1 for f in fixes if f.get('source') == 'online-fix.me' and f.get('download_url'))}")

if __name__ == '__main__':
    main()
