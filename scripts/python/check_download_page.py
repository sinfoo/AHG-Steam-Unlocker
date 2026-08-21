import requests
from bs4 import BeautifulSoup
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

# Use current URL format from listing
url = 'https://online-fix.me/games/survival/17320-dayz-dayzavr-po-seti.html'
resp = requests.get(url, headers=headers, timeout=10)
soup = BeautifulSoup(resp.content, 'html.parser')
print(f'Status: {resp.status_code}')
print(f'Title: {soup.title.string if soup.title else "NONE"}')

# Find download/upload links
for a in soup.find_all('a', href=True):
    href = a.get('href','')
    if 'upload' in href.lower() or 'download' in href.lower():
        txt = a.get_text(strip=True)[:60]
        print(f'  [{txt}] -> {href[:150]}')
    if '.rar' in href or '.zip' in href:
        txt = a.get_text(strip=True)[:60]
        print(f'  [RAR] [{txt}] -> {href[:150]}')

# Find iframes
for iframe in soup.find_all('iframe', src=True):
    src = iframe.get('src','')
    print(f'  IFRAME: {src[:150]}')

# Find element with class containing "download" or "fix"
for el in soup.find_all(class_=re.compile(r'download|fix|button|btn', re.I)):
    print(f'  EL: class={el.get("class")} text={el.get_text(strip=True)[:60]}')
    if el.name == 'a':
        print(f'     href={el.get("href","")[:150]}')
