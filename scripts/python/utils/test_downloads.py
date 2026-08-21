import requests

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://online-fix.me/',
    'Origin': 'https://online-fix.me'
}

# Test multiple URL patterns
urls = [
    # Pattern 1: uploads.online-fix.me with file
    'https://uploads.online-fix.me/uploads/We%20Gotta%20Go/Fix%20Repair/WeGottaGo_Fix_Repair_Steam_Generic.rar',
    # Pattern 2: Just folder listing
    'https://uploads.online-fix.me/uploads/We%20Gotta%20Go/',
    # Pattern 3: Without port
    'https://uploads.online-fix.me/uploads/We%20Gotta%20Go/Fix%20Repair/',
    # Pattern 4: Another game we know exists
    'https://uploads.online-fix.me/uploads/We%20Gotta%20Go/Fix%20Repair/WeGottaGo.rar',
]

session = requests.Session()
session.headers.update(HEADERS)

for url in urls:
    print(f"\nTesting: {url}")
    try:
        resp = session.head(url, allow_redirects=True, timeout=10)
        print(f"  Status: {resp.status_code}")
        if resp.status_code != 401:
            print(f"  Content-Length: {resp.headers.get('content-length', 'N/A')}")
            print(f"  Content-Type: {resp.headers.get('content-type', 'N/A')}")
    except Exception as e:
        print(f"  Error: {e}")