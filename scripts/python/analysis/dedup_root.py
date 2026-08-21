from _path_utils import data_path
import json

# Load from root
with open(rdata_path('fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)

print(f"Total: {len(fixes)}")

# Find duplicates
seen = {}
unique = []

for fix in fixes:
    aid = fix.get('appid')
    if aid not in seen:
        seen[aid] = True
        unique.append(fix)

print(f"Unique: {len(unique)}")
print(f"Removed: {len(fixes) - len(unique)}")

# Save
with open(rdata_path('fixes.json'), 'w', encoding='utf-8') as f:
    json.dump(unique, f, indent=2, ensure_ascii=False)

print("Saved!")