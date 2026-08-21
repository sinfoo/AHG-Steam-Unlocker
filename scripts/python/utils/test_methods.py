import requests
headers = {'User-Agent': 'Mozilla/5.0'}

# Try different methods on hosters
url = 'https://hosters.online-fix.me:2053/We%20Gotta%20Go'

for method in ['GET', 'POST', 'PUT']:
    try:
        func = getattr(requests, method.lower())
        r = func(url, headers=headers, timeout=8, allow_redirects=True)
        ct = r.headers.get('content-type', 'N/A')
        print(f'{method}: {r.status_code} | {ct[:50]}')
        if r.status_code == 200:
            print(f'  Content preview: {r.text[:150]}')
    except Exception as e:
        print(f'{method}: ERROR - {e}')