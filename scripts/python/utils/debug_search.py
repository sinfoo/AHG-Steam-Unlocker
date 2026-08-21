import json
from _path_utils import data_path
f = open(data_path('fixes.json'),'r',encoding='utf-8')
fixes = json.load(f)

print(f'Total: {len(fixes)}')
print(f'Unique names: {len(set(f.get("name","") for f in fixes))}')

# First 15 names
print('\nFirst 15 fix names:')
for fix in fixes[:15]:
    print(f'  {fix.get("appid")}: {fix.get("name")}')

# Check for issues
print('\nChecking for issues...')
no_name = [f for f in fixes if not f.get('name')]
print(f'No name: {len(no_name)}')

# Check if sorting is stable - search should show relevant first
# The issue might be - search results are paginated and showing 50 per page
# but they're sorted by how they were imported (by appid essentially), not by relevance!