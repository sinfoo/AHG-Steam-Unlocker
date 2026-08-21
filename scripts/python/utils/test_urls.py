import json
import urllib.request
import sys

appids = ['3472040', '3681010', '3949040', '485510', '1325200']
for appid in appids:
    url = f'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=10)
        data = resp.read()
        print(f'{appid}: {resp.status} ({len(data)} bytes, {resp.headers.get("Content-Type")})')
    except Exception as e:
        print(f'{appid}: FAILED - {e}')
    
    # Try with Referer
    url2 = f'https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg'
    try:
        req2 = urllib.request.Request(url2, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://store.steampowered.com/'})
        resp2 = urllib.request.urlopen(req2, timeout=10)
        data2 = resp2.read()
        print(f'{appid} (cf+ref): {resp2.status} ({len(data2)} bytes)')
    except Exception as e:
        print(f'{appid} (cf+ref): FAILED - {e}')
