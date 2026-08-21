from _path_utils import get_all_fixes, upsert_fixes

# Load fixes
fixes = get_all_fixes()

print("=== CHECKING FOR DUPLICATES ===")
print(f"Total before: {len(fixes)}")

# Find duplicates by appid
seen_ids = {}
duplicates = []

for i, fix in enumerate(fixes):
    aid = fix.get('appid')
    if aid in seen_ids:
        duplicates.append((i, aid, fix.get('name')))
    else:
        seen_ids[aid] = i

print(f"Duplicates found: {len(duplicates)}")

if duplicates:
    print("\nDuplicate appIDs:")
    for idx, aid, name in duplicates[:10]:
        print(f"  {aid}: {name}")
    if len(duplicates) > 10:
        print(f"  ... and {len(duplicates) - 10} more")

# Remove duplicates (keep first occurrence)
unique_map = {}
unique_fixes = []

for fix in fixes:
    aid = fix.get('appid')
    if aid not in unique_map:
        unique_map[aid] = True
        unique_fixes.append(fix)

print(f"\nTotal after dedup: {len(unique_fixes)}")
print(f"Removed: {len(fixes) - len(unique_fixes)}")

# Save cleaned
upsert_fixes(unique_fixes)

print("Saved cleaned fixes.json")

# Verify
verify = get_all_fixes()
print(f"Verified: {len(verify)}")