from _path_utils import get_all_fixes
fixes = get_all_fixes()

print(f'Total fixes: {len(fixes)}')

srcs = {}
for game in fixes:
    s = game.get('source','unknown')
    srcs[s] = srcs.get(s, 0) + 1

print('By source:')
for k,v in sorted(srcs.items(), key=lambda x:-x[1]):
    print(f'  {k}: {v}')

with_url = sum(1 for f in fixes if f.get('download_url'))
print(f'With download_url: {with_url}')

with_urls = sum(1 for f in fixes if f.get('download_urls'))
print(f'With download_urls[]: {with_urls}')

of_me = [f for f in fixes if f.get('source') == 'online-fix.me']
print(f'online-fix.me fixes: {len(of_me)}')
if of_me:
    with_dl = sum(1 for f in of_me if f.get('download_url'))
    print(f'  with download_url: {with_dl}')
    for f in of_me[:5]:
        du = f.get('download_url', 'N/A')
        name = f.get('name', 'UNKNOWN')
        appid = f.get('appid', 'N/A')
        print(f'  - {name} (appid: {appid}) url: {str(du)[:100]}')

# Check games.json
with open('games.json','r',encoding='utf-8') as f:
    games = json.load(f)
print(f'\nTotal games in games.json: {len(games)}')
