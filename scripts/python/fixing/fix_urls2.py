import re
from urllib.parse import quote

from _path_utils import get_all_fixes, upsert_fixes
fixes = get_all_fixes()

fixed = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me':
        url = fix.get('download_url', '')
        if 'po%20seti' in url.lower():
            match = re.search(r'/uploads/([^/]+)/', url)
            if match:
                old_path = match.group(1)
                url_name = old_path.replace('%20', ' ')
                url_name = re.sub(r'\s+po\s+seti$', '', url_name, flags=re.IGNORECASE).strip()
                file_name = url_name.replace(' ', '')
                
                new_url = f"https://uploads.online-fix.me:2053/uploads/{quote(url_name)}/Fix%20Repair/{file_name}_Fix_Repair_Steam_Generic.rar"
                fix['download_url'] = new_url
                fixed += 1
                if fixed <= 3:
                    print(f"{old_path} -> {url_name}")
                    print(f"URL: {new_url}")

print(f"\nFixed {fixed} URLs")
upsert_fixes(fixes)