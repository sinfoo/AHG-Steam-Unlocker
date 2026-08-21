import requests

# Create session with cookies
s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})

# Get cookies from online-fix.me
print('[1] Getting cookies from online-fix.me...')
r = s.get('https://online-fix.me/', timeout=10)
print(f'    Cookies: {dict(s.cookies)}')

# Now try upload URL
print('\n[2] Trying upload URL with session...')
url = 'https://uploads.online-fix.me:2053/uploads/We%20Gotta%20Go/Fix%20Repair/'
r = s.get(url, timeout=10, allow_redirects=True)
print(f'    Status: {r.status_code}')

# Try direct file
print('\n[3] Trying direct file...')
url2 = 'https://uploads.online-fix.me:2053/uploads/We%20Gotta%20Go/Fix%20Repair/WeGottaGo_Fix_Repair_Steam_Generic.rar'
r2 = s.get(url2, timeout=10, stream=True, allow_redirects=True)
print(f'    Status: {r2.status_code}')
print(f'    Content-Length: {r2.headers.get("content-length", "N/A")}')

if r2.status_code == 200:
    # Save first chunk to check
    chunk = r2.iter_content(chunk_size=1024)
    first = next(chunk, None)
    if first:
        print(f'    First bytes: {first[:50]}')

# Try hosters with GET
print('\n[4] Trying hosters with GET...')
url3 = 'https://hosters.online-fix.me:2053/We%20Gotta%20Go'
r3 = s.get(url3, timeout=10, allow_redirects=True)
print(f'    Status: {r3.status_code}')

# Try with Referer
print('\n[5] Trying with Referer header...')
s2 = requests.Session()
s2.headers.update({
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://online-fix.me/games/horror/18065-we-gotta-go-po-seti.html'
})
url4 = 'https://uploads.online-fix.me:2053/uploads/We%20Gotta%20Go/Fix%20Repair/'
r4 = s2.get(url4, timeout=10, allow_redirects=True)
print(f'    Status: {r4.status_code}')