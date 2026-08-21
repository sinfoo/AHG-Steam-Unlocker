import requests
from bs4 import BeautifulSoup
import re

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
url = 'https://online-fix.me/games/4209180-escape.html'
resp = requests.get(url, headers=headers, timeout=10)
soup = BeautifulSoup(resp.content, 'html.parser')

print(f'Status: {resp.status_code}')
title_tag = soup.title
if title_tag:
    print(f'Title: {title_tag.string}')
else:
    print('Title: NONE')

# Find all links
links = soup.find_all('a', href=True)
print(f'\nFound {len(links)} links')
for link in links:
    href = link.get('href', '')
    text = link.get_text(strip=True)[:60]
    if any(kw in href.lower() for kw in ['upload', 'download', '.rar', '.zip', 'fix']):
        print(f'  [{text}] -> {href[:120]}')

# Find all iframes
iframes = soup.find_all('iframe', src=True)
print(f'\nFound {len(iframes)} iframes')
for iframe in iframes:
    src = iframe.get('src', '')
    print(f'  src: {src[:120]}')

# Find <a> with class containing download/fix
dl_links = soup.find_all('a', class_=re.compile(r'download|fix|button|btn', re.I))
for a in dl_links:
    print(f'  class="{a.get("class")}" href="{a.get("href","")[:120]}" text="{a.get_text(strip=True)[:60]}"')
