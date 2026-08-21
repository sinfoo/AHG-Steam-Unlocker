import requests
import sys
sys.stdout.reconfigure(encoding='utf-8')

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://online-fix.me/',
}

# Try following the Mega.nz ext link redirect
ext_url = 'https://online-fix.me/ext/D-TjHnhA1vJt7DgS3PDUCC2E-r7hAM42H2pytQa9arRqCRi7Je_1CL4vq77GoeBu-ctFEqCG5hAjHT8F4ezZF7jBwIniKCuM9tYQizk681Q='

# First try with no redirect - see what the response is
resp = requests.get(ext_url, headers=headers, timeout=15, allow_redirects=False)
print(f'Status: {resp.status_code}')
print(f'Headers: {dict(resp.headers)}')
print(f'Content preview: {resp.text[:500]}')
print()

# Now try with redirects
resp2 = requests.get(ext_url, headers=headers, timeout=30, allow_redirects=True)
print(f'Final status: {resp2.status_code}')
print(f'Final URL: {resp2.url}')
print(f'Content length: {len(resp2.content)}')
# Show redirect history
print(f'Redirect history ({len(resp2.history)} hops):')
for i, r in enumerate(resp2.history):
    print(f'  {i}: {r.status_code} -> {r.url}')
    print(f'     Location: {r.headers.get("Location", "N/A")}')
