from _path_utils import get_all_games
data = get_all_games()
for g in data:
    if 'phasmophobia' in g.get('name', '').lower():
        print(f"appid: {g.get('appid')}, name: {g.get('name')}, tags: {g.get('tags')}")