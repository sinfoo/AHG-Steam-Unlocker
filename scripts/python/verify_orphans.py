"""Check orphan fixes (appid not in games) and their URLs."""
from _path_utils import get_all_fixes, get_all_games

fixes = get_all_fixes()
games = get_all_games()

games_set = set(g.get('appid') for g in games if g.get('appid'))
orphans = [f for f in fixes if f.get('appid') and f['appid'] not in games_set]

print(f'Total fixes: {len(fixes)}')
print(f'Orphan fixes (appid not in games.json): {len(orphans)}')
no_url = sum(1 for o in orphans if not o.get('download_url'))
print(f'  with download_url: {len(orphans) - no_url}')
print(f'  missing download_url: {no_url}')
print()

for o in orphans[:10]:
    url = o.get('download_url', 'MISSING')
    print(f'  {o.get("appid")}: {o.get("name")}')
    print(f'           url={url}')
