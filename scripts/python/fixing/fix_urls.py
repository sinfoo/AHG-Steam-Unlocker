import re
from urllib.parse import quote

from _path_utils import get_all_fixes, upsert_fixes
def clean_name_for_url(name):
    # Remove "po seti" suffix
    name = re.sub(r'\s+po\s+seti$', '', name, flags=re.IGNORECASE)
    return name.strip()

def clean_name_for_file(name):
    # Remove "po seti" and make filename
    name = re.sub(r'\s+po\s+seti$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+', '', name)  # Remove spaces for filename
    return name.strip()

print("Loading fixes...")
fixes = get_all_fixes()

print(f"Loaded {len(fixes)} fixes")

fixed = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me' and fix.get('download_url'):
        name = fix.get('name', '')
        if name and 'po seti' in name.lower():
            url_name = clean_name_for_url(name)
            file_name = clean_name_for_file(name)
            
            # CORRECT format without "po seti":
            fix['download_url'] = f"https://uploads.online-fix.me:2053/uploads/{quote(url_name)}/Fix%20Repair/{file_name}_Fix_Repair_Steam_Generic.rar"
            fixed += 1

print(f"Fixed {fixed} URLs (removed 'po seti')")

upsert_fixes(fixes)

print("Saved!")

# Show sample
print("\nSample URLs:")
for fix in fixes[:5]:
    if fix.get('source') == 'online-fix.me':
        print(f"  {fix['name']}: {fix.get('download_url', '')}")