import json
import re

from _path_utils import data_path
def clean_for_url(name):
    # Clean name for URL
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'\s+', '%20', name)
    return name

def clean_for_filename(name):
    name = re.sub(r'\s+po\s+seti$', '', name)
    name = re.sub(r'\s+', '_', name)
    return name

print("Loading fixes...")
with open(data_path('dist-electron/win-unpacked/resources/fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)

print(f"Loaded {len(fixes)} fixes")

updated = 0
for fix in fixes:
    if not fix.get('download_url') and fix.get('source') == 'online-fix.me':
        name = fix.get('name', '')
        if name:
            url_name = clean_for_url(name)
            file_name = clean_for_filename(name)
            # Generate download URL pattern
            fix['download_url'] = f"https://uploads.online-fix.me:2053/uploads/{url_name}%20po%20seti/Fix%20Repair/{file_name}_Fix_Repair_Steam_Generic.rar"
            updated += 1

print(f"Updated {updated} fixes with generated download URLs")

with open(data_path('dist-electron/win-unpacked/resources/fixes.json'), 'w', encoding='utf-8') as f:
    json.dump(fixes, f, indent=2, ensure_ascii=False)

print("Saved!")

# Verify
with open(data_path('dist-electron/win-unpacked/resources/fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)
with_url = sum(1 for f in fixes if f.get('download_url'))
print(f"Now have download_url: {with_url}")