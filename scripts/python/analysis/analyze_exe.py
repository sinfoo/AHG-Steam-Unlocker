import re

with open(r'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\RyuuManifestToolV2.exe', 'rb') as f:
    data = f.read()

# Extract ASCII strings (min 6 chars)
strings = re.findall(b'[\x20-\x7e]{6,}', data)

# Filter for relevant keywords
keywords = [b'api', b'auth', b'token', b'session', b'download', b'discord', b'oauth', b'http', b'manifest', b'depot', b'branch', b'public', b'beta', b'ryuu', b'generator', b'steam', b'client_id', b'secret', b'redirect', b'grant', b'access_token', b'refresh', b'cookie', b'bearer']

filtered = []
for s in strings:
    lower = s.lower()
    for kw in keywords:
        if kw in lower:
            filtered.append(s.decode('ascii', errors='replace'))
            break

# Print unique results
seen = set()
for s in filtered:
    if s not in seen:
        seen.add(s)
        print(s)
