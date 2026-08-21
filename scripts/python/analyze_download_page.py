import requests
from bs4 import BeautifulSoup
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://online-fix.me/',
}

# Check the Mega.nz ext page
ext_url = 'https://online-fix.me/ext/D-TjHnhA1vJt7DgS3PDUCC2E-r7hAM42H2pytQa9arRqCRi7Je_1CL4vq77GoeBu-ctFEqCG5hAjHT8F4ezZF7jBwIniKCuM9tYQizk681Q='
resp = requests.get(ext_url, headers=headers, timeout=15, allow_redirects=True)
soup = BeautifulSoup(resp.content, 'html.parser')

# Save full HTML for examination
with open('ext_page_debug.html', 'w', encoding='utf-8') as f:
    f.write(str(soup.prettify()))
print('Saved full HTML to ext_page_debug.html')

# Check ALL elements for download-related content
for el in soup.find_all(True):
    classes = el.get('class', [])
    if any('dl' in str(c).lower() or 'down' in str(c).lower() or 'btn' in str(c).lower() for c in classes):
        print(f'  DL element: <{el.name} class={classes}> text={el.get_text(strip=True)[:80]}')

# Look for data attributes, onclick handlers
for el in soup.find_all(lambda tag: any(attr.startswith('data-') or attr in ['onclick','href','src'] for attr in tag.attrs)):
    for attr, val in el.attrs.items():
        if isinstance(val, str) and ('http' in val or 'mega' in val.lower() or 'yandex' in val.lower() or 'download' in val.lower()):
            print(f'  [{el.name}] {attr}={val[:150]}')
