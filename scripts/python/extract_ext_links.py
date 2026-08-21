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

# Test with one game's ext links found earlier
ext_urls = [
    'https://online-fix.me/ext/D-TjHnhA1vJt7DgS3PDUCC2E-r7hAM42H2pytQa9arRqCRi7Je_1CL4vq77GoeBu-ctFEqCG5hAjHT8F4ezZF7jBwIniKCuM9tYQizk681Q=',
    'https://online-fix.me/ext/D-TjHnhA1vJt7DgS3PDUCFstkrCGRxt8sZSOhR5ne6dQyp1YCrFvfO6eJKlEIJ97nQ5kDkJS8C9fT7HYhD5LKg==',
    'https://online-fix.me/ext/9G64jYmIEGyb-dJ2SbxpIiqzjoQs7fkgk4im-XuPtB0j4nxNtSNS5mt0-chQTRox',
]

for ext_url in ext_urls:
    print(f'\n=== Ext URL: {ext_url[:60]}... ===')
    resp = requests.get(ext_url, headers=headers, timeout=15, allow_redirects=True)
    soup = BeautifulSoup(resp.content, 'html.parser')
    
    title = soup.title.string if soup.title else 'NONE'
    print(f'Title: {title}')
    
    # Find ALL links on the page
    for a in soup.find_all('a', href=True):
        href = a.get('href', '')
        txt = a.get_text(strip=True)[:60]
        if href and not href.startswith('#') and not href.startswith('javascript'):
            print(f'  LINK [{txt}] -> {href[:150]}')
    
    # Find any redirect script
    for script in soup.find_all('script'):
        if script.string:
            matches = re.findall(r'(?:location|window\.location|document\.location)\s*[=.]\s*[\'"]([^\'"]+)[\'"]', script.string, re.I)
            for m in matches:
                print(f'  SCRIPT redirect: {m[:150]}')
            matches2 = re.findall(r'(?:href|src)\s*=\s*[\'"](https?://[^\'"]+)[\'"]', script.string)
            for m in matches2:
                print(f'  SCRIPT url: {m[:150]}')
