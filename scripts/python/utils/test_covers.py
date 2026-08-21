from _path_utils import data_path
import json
import urllib.request

# Test more games that do/don't have covers
with open(rdata_path('ui\games.json'), encoding='utf-8') as f:
    data = json.load(f)

# Pick first 20 games to see which have working covers
for g in data[:30]:
    appid = g.get('appid')
    name = g.get('name','?')[:40]
    url = f'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg'
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://store.steampowered.com/'
        })
        resp = urllib.request.urlopen(req, timeout=8)
        data_len = len(resp.read())
        print(f'OK  {appid} | {name} | {data_len} bytes')
    except Exception as e:
        code = getattr(e, 'code', '?')
        print(f'FAIL {appid} ({code}) | {name}')
