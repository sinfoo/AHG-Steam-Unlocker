import json

# Load the matched_online_fix.json (output from a more recent scrape/merge)
matched = json.load(open('data/matched_online_fix.json','r',encoding='utf-8'))
all_matched = matched.get('matched', [])
unmatched = matched.get('unmatched', [])

print('=== matched_online_fix.json ===')
print(f'Already matched: {len(all_matched)} fixes')
print(f'Still unmatched: {len(unmatched)} fixes')

# Load the current fixes from DB
from _path_utils import get_all_fixes
fixes = get_all_fixes()
fixes_appids = {str(f['appid']) for f in fixes if f.get('appid')}

# Check which matched entries are NOT yet in fixes.json
not_in_fixes = [m for m in all_matched if str(m.get('appid','')) not in fixes_appids]
already_in = [m for m in all_matched if str(m.get('appid','')) in fixes_appids]
print(f'\nAlready in fixes.json: {len(already_in)}')
print(f'NOT yet in fixes.json: {len(not_in_fixes)}')

if not_in_fixes:
    print(f'\nFirst 10 new matches to add:')
    for m in not_in_fixes[:10]:
        print(f'  appid={m.get("appid")} name={m.get("name")} url={m.get("url")}')
    
    print(f'\nAll {len(not_in_fixes)} new appids:')
    for m in not_in_fixes:
        print(f'  {m.get("appid")} - {m.get("name")}')

# Check the unmatched from matched_online_fix.json
print(f'\nUnmatched entries:')
for u in unmatched[:20]:
    print(f'  name={u.get("name")}')

# Check the combined total if we merge
print(f'\nPotential total: {len(fixes) + len(not_in_fixes)} fixes')
print(f'  Current: {len(fixes)}')
print(f'  Adding: {len(not_in_fixes)}')
