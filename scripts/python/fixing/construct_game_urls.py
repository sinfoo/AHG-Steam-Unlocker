"""Construct game_url for all online-fix.me fixes from download_url pattern.
This is more reliable than name-matching against scraped data because:
1. The download URL always contains the game name slug
2. The constructed URL matches the online-fix.me URL pattern exactly
3. Zero false positives (unlike name matching against scraped data)
"""
import re

from _path_utils import get_all_fixes, upsert_fixes

fixes = get_all_fixes()

online_fixes = [f for f in fixes if f.get('source') == 'online-fix.me']
before = sum(1 for f in online_fixes if f.get('game_url'))

# Pattern from App.tsx fallback
pattern = re.compile(r'(?:uploads|hosters)\.online-fix\.me[^/]+/uploads/([^/]+)/')

updated = 0
for fix in online_fixes:
    dl = fix.get('download_url', '')
    m = pattern.search(dl)
    if m:
        slug = m.group(1)
        fix['game_url'] = 'https://online-fix.me/games/page/1/%s.html' % slug
        updated += 1

upsert_fixes(fixes)

after = sum(1 for f in online_fixes if f.get('game_url'))
print('Before: %d online-fix.me fixes with game_url' % before)
print('Updated: %d fixes with constructed game_url' % updated)
print('After: %d online-fix.me fixes with game_url' % after)
print('Remaining without game_url: %d' % (len(online_fixes) - after))

if updated > 0:
    print('\nSample constructed URLs:')
    shown = 0
    for fix in online_fixes:
        if 'game_url' in fix and fix['game_url'].startswith('https://online-fix.me/games/') and shown < 5:
            print('  %s -> %s' % (fix['name'], fix['game_url']))
            shown += 1
