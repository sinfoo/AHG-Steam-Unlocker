import json

from _path_utils import data_path
with open(data_path('games.json'), 'r', encoding='utf-8') as f:
    games = json.load(f)

# Check appid 491700
result = [g for g in games if g.get('appid') == '491700']
print(f"Appid 491700: {result}")

# Check appid 759010  
result2 = [g for g in games if g.get('appid') == '759010']
print(f"Appid 759010: {result2}")

# Check some online-fix games
with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)

print("\nOnline-fix games:")
count = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me' and count < 5:
        appid = fix.get('appid')
        steam_match = [g for g in games if g.get('appid') == appid]
        if steam_match:
            print(f"  {appid}: Fix name='{fix['name']}' vs Steam name='{steam_match[0]['name']}'")
        else:
            print(f"  {appid}: Fix name='{fix['name']}' - NO STEAM MATCH")
        count += 1