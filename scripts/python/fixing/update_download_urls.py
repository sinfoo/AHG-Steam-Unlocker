import re
import urllib.parse
import urllib.request

from _path_utils import get_all_fixes, upsert_fixes


def validate_url(url, timeout=10):
    """Validate a download URL exists via HTTP HEAD request, fallback to GET range request."""
    try:
        req = urllib.request.Request(url, method='HEAD')
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.status == 200
    except urllib.request.HTTPError as e:
        if e.code == 404:
            pass  # Will fall through to GET attempt below
        else:
            return False
    except Exception:
        pass

    # Fallback: try GET with Range header (servers that block HEAD)
    try:
        req = urllib.request.Request(url)
        req.add_header('Range', 'bytes=0-0')
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.status in (200, 206)
    except urllib.request.HTTPError as e:
        if e.code == 404:
            return False
        return False
    except Exception:
        return False


# URL filename patterns to try in order
URL_PATTERNS = [
    "{no_space_name}_Fix_Repair_Steam_Generic.rar",
    "{no_space_name}_Fix_Repair.rar",
    "{no_space_name}_Steam_Generic.rar",
    "{no_space_name}_Fix.rar",
]

# Load existing fixes
fixes = get_all_fixes()

# Track which patterns succeed for reporting
pattern_success = {p: 0 for p in URL_PATTERNS}
updated = 0

for fix in fixes:
    if fix.get('source') == 'online-fix.me':
        name = fix.get('name', '')
        if not name:
            continue

        no_space_name = name.replace(' ', '')
        base_url = (
            f'https://uploads.online-fix.me:2053/uploads/'
            f'{urllib.parse.quote(name)}/Fix%20Repair'
        )

        found_valid = False
        for pattern in URL_PATTERNS:
            filename = pattern.format(no_space_name=no_space_name)
            url = f'{base_url}/{filename}'
            if validate_url(url):
                fix['download_url'] = url
                fix['download_urls'] = [url]
                pattern_success[pattern] += 1
                found_valid = True
                print(f"  OK [{pattern}] {name}")
                break

        if not found_valid:
            # Use primary pattern as fallback even if invalid
            filename = URL_PATTERNS[0].format(no_space_name=no_space_name)
            url = f'{base_url}/{filename}'
            fix['download_url'] = url
            fix['download_urls'] = [url]
            print(f"  XX [no valid URL] {name}")

        updated += 1

print(f'\nUpdated {updated} fixes')
print('\nPattern success rates:')
for pattern, count in pattern_success.items():
    pct = (count / updated * 100) if updated > 0 else 0
    print(f"  {pattern}: {count}/{updated} ({pct:.1f}%)")

upsert_fixes(fixes)

print('Saved!')

# Show sample
count = 0
for fix in fixes:
    if fix.get('source') == 'online-fix.me' and count < 5:
        print(f"  {fix['appid']}: {fix['name']}")
        print(f"    -> {fix['download_url']}")
        count += 1
