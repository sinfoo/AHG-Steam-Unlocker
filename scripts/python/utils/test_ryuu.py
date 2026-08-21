import requests
import json

from _path_utils import data_path
# Load current fixes
with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)

# Check how many ryuu fixes we have
ryuu_fixes = [f for f in fixes if f.get('source') != 'online-fix.me']
online_fixes = [f for f in fixes if f.get('source') == 'online-fix.me']

print(f"Ryuu fixes: {len(ryuu_fixes)}")
print(f"Online-fix fixes: {len(online_fixes)}")

# Test if ryuu.lol has some online-fix games
print("\nTesting ryuu.lol for online-fix games...")
test_count = 0
found_in_ryuu = 0

for fix in online_fixes[:20]:
    appid = fix.get('appid')
    name = fix.get('name')
    
    # Test ryuu with appid
    url = f'https://generator.ryuu.lol/fixes/{appid}.zip'
    try:
        r = requests.head(url, timeout=5)
        if r.status_code == 200:
            found_in_ryuu += 1
            print(f"  FOUND: {appid} - {name}")
    except:
        pass
    test_count += 1

print(f"\nTested {test_count} games: {found_in_ryuu} found in ryuu.lol")