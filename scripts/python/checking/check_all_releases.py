import urllib.request
import json
url = 'https://api.github.com/repos/sinfoo/AHG-Steam-Unlocker-Releases/releases'
req = urllib.request.Request(url, headers={'User-Agent': 'AHGSteamUnlocker/9.2'})
with urllib.request.urlopen(req, timeout=10) as resp:
    data = json.loads(resp.read().decode())
print('All releases:')
for r in data[:5]:
    print(f'  {r.get("tag_name")}')