from _path_utils import get_all_fixes, upsert_fixes
# Load fixes
fixes = get_all_fixes()

# Add "Online" badge to all online-fix.me sources
updated = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me':
        badges = fix.get('badges', [])
        if 'Online' not in badges:
            badges.append('Online')
            fix['badges'] = badges
            updated += 1

print(f'Added Online badge to {updated} fixes')

upsert_fixes(fixes)

print('Done!')