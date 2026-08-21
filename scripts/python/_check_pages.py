import requests
from bs4 import BeautifulSoup

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

# Check page 62 (should have 30 games)
url62 = 'https://online-fix.me/games/page/62/'
r62 = requests.get(url62, headers=HEADERS, timeout=10)
s62 = BeautifulSoup(r62.content, 'html.parser')
entries62 = s62.find_all('a', class_='big-link')
entries62 = [e for e in entries62 if '/games/' in e.get('href','') and e.get('href','').endswith('.html')]
print('Page 62 big-link games:', len(entries62))

# Check page 63
url63 = 'https://online-fix.me/games/page/63/'
r63 = requests.get(url63, headers=HEADERS, timeout=10)
s63 = BeautifulSoup(r63.content, 'html.parser')
entries63 = s63.find_all('a', class_='big-link')
entries63 = [e for e in entries63 if '/games/' in e.get('href','') and e.get('href','').endswith('.html')]
print('Page 63 big-link games:', len(entries63))

title63 = s63.find('title')
print('Page 63 title:', title63.text.strip() if title63 else 'N/A')

# Show games on page 63
import re
print('\nGames on page 63:')
for e in entries63:
    href = e.get('href','')
    name = href.split('/')[-1].replace('.html','')
    match = re.search(r'\d+-(.+)$', name)
    if match:
        name = match.group(1).replace('-',' ')
    print(f'  {name}')

# Check page 64
url64 = 'https://online-fix.me/games/page/64/'
r64 = requests.get(url64, headers=HEADERS, timeout=10)
s64 = BeautifulSoup(r64.content, 'html.parser')
entries64 = s64.find_all('a', class_='big-link')
entries64 = [e for e in entries64 if '/games/' in e.get('href','') and e.get('href','').endswith('.html')]
print('\nGames on page 64:')
for e in entries64:
    href = e.get('href','')
    name = href.split('/')[-1].replace('.html','')
    match = re.search(r'\d+-(.+)$', name)
    if match:
        name = match.group(1).replace('-',' ')
    print(f'  {name}')

# Check the main games page for pagination
url_main = 'https://online-fix.me/games/'
r_main = requests.get(url_main, headers=HEADERS, timeout=10)
s_main = BeautifulSoup(r_main.content, 'html.parser')

# Find the last page number from pagination at bottom
import re as regex
nav = s_main.find('div', class_='navigation')
if nav:
    print('\nPagination on main page:')
    links = nav.find_all('a')
    pages = []
    for link in links:
        txt = link.get_text(strip=True)
        href = link.get('href','')
        print(f'  {txt} -> {href}')
        # Extract page numbers
        m = regex.search(r'/page/(\d+)/', href)
        if m:
            pages.append(int(m.group(1)))
    if pages:
        print(f'Pages range: 1-{max(pages)}')
