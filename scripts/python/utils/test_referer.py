import requests

# Key: Referer header works!
s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://online-fix.me/games/horror/18065-we-gotta-go-po-seti.html'
})

print('[1] Testing folder URL with Referer...')
url = 'https://uploads.online-fix.me:2053/uploads/We%20Gotta%20Go/Fix%20Repair/'
r = s.get(url, timeout=10)
print(f'    Status: {r.status_code}')
print(f'    Content: {r.text[:200] if r.text else "empty"}')

print('\n[2] Testing direct .rar file...')
url2 = 'https://uploads.online-fix.me:2053/uploads/We%20Gotta%20Go/Fix%20Repair/WeGottaGo_Fix_Repair_Steam_Generic.rar'
r2 = s.get(url2, timeout=10, stream=True)
print(f'    Status: {r2.status_code}')
print(f'    Content-Length: {r2.headers.get("content-length", "N/A")}')
print(f'    Content-Type: {r2.headers.get("content-type", "N/A")}')

if r2.status_code == 200:
    # Download first few KB
    content = b''
    for chunk in r2.iter_content(chunk_size=8192):
        content += chunk
        if len(content) > 8192:
            break
    print(f'    Downloaded: {len(content)} bytes')
    print(f'    First bytes: {content[:100]}')

print('\n[3] Testing another game (DayZ)...')
s3 = requests.Session()
s3.headers.update({
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://online-fix.me/games/survival/17320-dayz-dayzavr-po-seti.html'
})
url3 = 'https://uploads.online-fix.me:2053/uploads/DayZ/Fix%20Repair/DayZ_Fix_Repair_Steam_Generic.rar'
r3 = s3.get(url3, timeout=10)
print(f'    Status: {r3.status_code}')
if r3.status_code == 200:
    print(f'    Content-Length: {r3.headers.get("content-length", "N/A")}')