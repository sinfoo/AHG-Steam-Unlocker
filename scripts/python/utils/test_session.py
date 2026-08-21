import requests
import re

# Create session to maintain cookies
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})

print("[1] Visiting online-fix.me to get cookies...")
r = session.get('https://online-fix.me/', timeout=10)
print(f"    Status: {r.status_code}")
print(f"    Cookies: {dict(session.cookies)}")

# Now try download
print("\n[2] Trying upload URL with session cookies...")
url = 'https://uploads.online-fix.me:2053/uploads/We%20Gotta%20Go/Fix%20Repair/'
r = session.get(url, timeout=10)
print(f"    Status: {r.status_code}")
print(f"    Response: {r.text[:200] if r.text else 'empty'}")

# Try direct file
print("\n[3] Trying direct .rar file...")
url2 = 'https://uploads.online-fix.me:2053/uploads/We%20Gotta%20Go/Fix%20Repair/WeGottaGo_Fix_Repair_Steam_Generic.rar'
r2 = session.get(url2, timeout=10)
print(f"    Status: {r2.status_code}")

# Try different approach - use a known working URL pattern
print("\n[4] Checking if server is online with ping...")
ping = session.get('https://uploads.online-fix.me:2053/', timeout=10)
print(f"    Server ping: {ping.status_code}")

# List the folder using basic auth attempt
print("\n[5] Trying hosters URL...")
url3 = 'https://hosters.online-fix.me:2053/We%20Gotta%20Go'
r3 = session.get(url3, timeout=10)
print(f"    Status: {r3.status_code}")
print(f"    Headers: {dict(r3.headers)}")