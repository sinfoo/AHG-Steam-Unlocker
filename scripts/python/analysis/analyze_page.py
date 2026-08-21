import requests
import re

s = requests.Session()
s.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

r = s.get('https://online-fix.me/', timeout=10)
print('Main page:', r.status_code)

# Get game page directly
game = s.get('https://online-fix.me/games/horror/18065-we-gotta-go-po-seti.html', timeout=10)
print('Game page:', game.status_code)

# Extract all upload URLs
html = game.text
uploads = re.findall(r'https://[^\s"\'<>]+uploads[^\s"\'<>]*', html)
print('Upload URLs:', uploads[:5])

# Also find download buttons
buttons = re.findall(r'href="([^"]+)"[^>]*btn-success', html)
print('Download buttons:', buttons[:5])

# Try the URL from button
for btn in buttons[:2]:
    print(f"\nTrying: {btn}")
    r2 = s.head(btn, timeout=8, allow_redirects=True)
    print(f"  Status: {r2.status_code}")