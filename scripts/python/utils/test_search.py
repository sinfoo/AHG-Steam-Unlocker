import json
from _path_utils import data_path
f = open(data_path('fixes.json'),'r',encoding='utf-8')
fixes = json.load(f)

# Search for 'skyrim'
query = 'skyrim'
results = [fix for fix in fixes if query in fix.get('name','').lower()]
print(f'Search "{query}": {len(results)} matches')
for fix in results[:5]:
    print(f'  {fix.get("name")}')

# Search for 'god'
query2 = 'god'
results2 = [fix for fix in fixes if query2 in fix.get('name','').lower()]
print(f'\nSearch "{query2}": {len(results2)} matches')
for fix in results2[:10]:
    print(f'  {fix.get("name")}')