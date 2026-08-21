from _path_utils import data_path, get_all_games
import json, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

old = json.load(open(data_path('backup_v0.9_download_modal_20260503_1330/games.json'), 'r', encoding='utf-8'))
current = get_all_games()

old_ids = {g['appid'] for g in old}
added = [g for g in current if g['appid'] not in old_ids]

with open(data_path('added_games.txt'), 'w', encoding='utf-8') as f:
    f.write(f"NEWLY ADDED GAMES ({len(added)} total)\n")
    f.write("=" * 60 + "\n\n")
    for g in sorted(added, key=lambda x: x['name']):
        f.write(f"{g['appid']}: {g['name']}\n")

print(f"Saved {len(added)} games to added_games.txt")
print("\nFirst 30:")
for g in sorted(added, key=lambda x: x['name'])[:30]:
    print(f"  {g['appid']}: {g['name']}")
