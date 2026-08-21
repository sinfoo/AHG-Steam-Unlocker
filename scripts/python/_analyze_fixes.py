import json

# Check matched_online_fix.json content
matched = json.load(open('data/matched_online_fix.json','r',encoding='utf-8'))
new_matches = matched.get('matched', [])
unmatched_data = matched.get('unmatched', [])
print('matched_online_fix.json:')
print(f'  Already matched IDs: {len(new_matches)}')
print(f'  Still unmatched: {len(unmatched_data)}')

# Check scraped_online_fix.json
scraped = json.load(open('data/scraped_online_fix.json','r',encoding='utf-8'))
print('\nscraped_online_fix.json:')
print(f'  Total pages: {scraped.get("total_pages")}')
print(f'  Total scraped: {scraped.get("total_scraped")}')
print(f'  New matches from scraper: {len(scraped.get("new_matches",[]))}')
unmatched = scraped.get('unmatched', [])
print(f'  Unmatched: {len(unmatched)}')

# Check how many unmatched have high scores
high = [u for u in unmatched if u.get('best_fuzzy_score', 0) >= 0.7]
print(f'  Unmatched with score >= 0.7: {len(high)}')

# Show top near misses
sorted_u = sorted(unmatched, key=lambda x: x.get('best_fuzzy_score', 0), reverse=True)
print('\nTop 15 near-misses:')
for u in sorted_u[:15]:
    print(f'  score={u["best_fuzzy_score"]:.3f}  {u["name"]}')

# Now check if the 124 new matches are already in fixes
from _path_utils import get_all_fixes
fixes = get_all_fixes()
fixes_appids = {f['appid'] for f in fixes if f.get('appid')}
not_in_fixes = [m for m in new_matches if str(m['appid']) not in fixes_appids]
print(f'\nNew matches already in fixes.json: {len(new_matches) - len(not_in_fixes)}')
print(f'New matches NOT in fixes.json: {len(not_in_fixes)}')
if not_in_fixes:
    print('First 5 new matches to add:')
    for m in not_in_fixes[:5]:
        print(f'  appid={m["appid"]} name={m["name"]}')

# Check if there are more pages on online-fix.me beyond page 62
print('\n--- Scraper only goes up to page 62 ---')
print('We should check if online-fix.me has more pages now.')
