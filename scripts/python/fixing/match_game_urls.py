import json

from _path_utils import get_all_fixes, upsert_fixes, data_path

scraped_path = data_path('data/scraped_online_fix.json')

# Load fixes
fixes = get_all_fixes()

# Load scraped data
with open(scraped_path, 'r', encoding='utf-8') as f:
    scraped = json.load(f)

# Build scraped name -> URL map from unmatched entries
scraped_map = {}
for u in scraped.get('unmatched', []):
    name = u.get('name', '').lower().strip()
    url = u.get('url', '')
    if name and url:
        scraped_map[name] = url

print(f"Scraped unmatched entries: {len(scraped.get('unmatched', []))}")
print(f"Scraped URL map size: {len(scraped_map)}")

# Match online-fix.me fixes without game_url
online_no_url = [f for f in fixes if f.get('source') == 'online-fix.me' and not f.get('game_url')]
print(f"Online fixes without game_url: {len(online_no_url)}")

# Exact match first
exact_matches = 0
for fix in fixes:
    if fix.get('source') != 'online-fix.me':
        continue
    if fix.get('game_url'):
        continue
    fix_name = fix.get('name', '').lower().strip()
    if fix_name in scraped_map:
        fix['game_url'] = scraped_map[fix_name]
        exact_matches += 1

print(f"Exact matches: {exact_matches}")

# Partial match for remaining: try contains-based matching
remaining = [f for f in fixes if f.get('source') == 'online-fix.me' and not f.get('game_url')]
print(f"Remaining after exact match: {len(remaining)}")

partial_matches = 0
for fix in remaining:
    fix_name = fix.get('name', '').lower().strip()
    # Try to find a scraped entry where one name contains the other
    for scraped_name, scraped_url in scraped_map.items():
        # Avoid trivial single-word matches
        if len(fix_name) < 4 or len(scraped_name) < 4:
            continue
        if fix_name in scraped_name or scraped_name in fix_name:
            fix['game_url'] = scraped_url
            partial_matches += 1
            break

print(f"Partial matches: {partial_matches}")

# Final stats
online = [f for f in fixes if f.get('source') == 'online-fix.me']
with_url = [f for f in online if f.get('game_url')]
print(f"\nFinal stats:")
print(f"  Total online-fix.me fixes: {len(online)}")
print(f"  With game_url: {len(with_url)}")
print(f"  Without game_url: {len(online) - len(with_url)}")

# Save updated fixes
upsert_fixes(fixes)

print("\nSaved updated fixes to database")

# Show samples
print("\n=== Sample updated fixes ===")
updated = [f for f in fixes if f.get('source') == 'online-fix.me' and f.get('game_url')]
for f in updated[:5]:
    print(f"  {f['name']}: {f['game_url']}")
