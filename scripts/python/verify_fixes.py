"""Verify fixes integrity after importing new fixes."""
from collections import Counter
from _path_utils import get_all_fixes, get_all_games

fixes = get_all_fixes()
games = get_all_games()

games_set = set(g.get('appid') for g in games if g.get('appid'))

# Basic counts
sources = Counter(f.get('source', 'unknown') for f in fixes)
empty_url = sum(1 for f in fixes if not f.get('download_url'))
empty_badges = sum(1 for f in fixes if not f.get('badges'))
no_appid = sum(1 for f in fixes if not f.get('appid'))

print(f"{'='*60}")
print(f"FIXES.JSON INTEGRITY REPORT")
print(f"{'='*60}")
print(f"Total fixes: {len(fixes)}")
print(f"Total games in games.json: {len(games)}")
print(f"By source: {dict(sources)}")
print(f"Empty download_url: {empty_url}")
print(f"Empty badges: {empty_badges}")
print(f"No appid: {no_appid}")

# Cross-reference: fixes with appid in games.json
fixes_set = set(f.get('appid') for f in fixes if f.get('appid'))
orphan_fixes = fixes_set - games_set
print(f"\nFixes with appid IN games.json: {len(fixes_set - orphan_fixes)}")
print(f"Fixes with appid NOT in games.json: {len(orphan_fixes)}")

orphan_list = [f for f in fixes if f.get('appid') in orphan_fixes]
orphan_sources = Counter(f.get('source', 'unknown') for f in orphan_list)
print(f"Orphan fix sources: {dict(orphan_sources)}")

# Duplicate appids in fixes
appids = [f.get('appid') for f in fixes if f.get('appid')]
dupes = [(a, c) for a, c in Counter(appids).items() if c > 1]
print(f"\nDuplicate appids in fixes.json: {len(dupes)}")
for d, count in dupes[:5]:
    entries = [f for f in fixes if f.get('appid') == d]
    print(f"  {d} (x{count}): {[e.get('name') for e in entries]}")

# File sizes and sync status
print(f"\n{'='*60}")
print(f"FILE SYNC STATUS")
print(f"{'='*60}")
for fn in ['fixes.json', 'games.json', 'dist-electron/fixes.json', 'dist-electron/games.json']:
    if os.path.exists(fn):
        print(f"{fn}: {os.path.getsize(fn):,} bytes")
    else:
        print(f"{fn}: MISSING!")

root_fixes_sz = os.path.getsize('fixes.json')
dist_fixes_sz = os.path.getsize('dist-electron/fixes.json')
root_games_sz = os.path.getsize('games.json')
dist_games_sz = os.path.getsize('dist-electron/games.json')

print(f"\nfixes.json synced: {root_fixes_sz == dist_fixes_sz}")
print(f"games.json synced: {root_games_sz == dist_games_sz}")
