import urllib.request
import json
url = 'https://api.github.com/repos/ahg-team/AHG-Steam-Unlocker/releases/latest'
req = urllib.request.Request(url, headers={'User-Agent': 'AHGSteamUnlocker/9.2'})
with urllib.request.urlopen(req, timeout=10) as resp:
    data = json.loads(resp.read().decode())
print('Tag:', data.get('tag_name'))
print('Assets:')
for a in data.get('assets', []):
    print(f'  - {a.get("name")} ({a.get("size")} bytes)')
print('Body preview:')
print(data.get('body', '')[:500])