import json

from _path_utils import data_path
print("Loading fixes...")
with open(data_path('dist-electron/win-unpacked/resources/fixes.json'), 'r', encoding='utf-8') as f:
    fixes = json.load(f)

print(f"Loaded {len(fixes)} fixes")

# Check what's available
with_url = sum(1 for f in fixes if f.get('download_url'))
with_game_url = sum(1 for f in fixes if f.get('game_url'))
with_source = sum(1 for f in fixes if f.get('source'))

print(f"With download_url: {with_url}")
print(f"With game_url: {with_game_url}")
print(f"With source: {with_source}")

# Sample without URL
no_url = [f for f in fixes if not f.get('download_url')]
print(f"\nSample fixes without download_url:")
for f in no_url[:5]:
    print(f"  {f.get('name')} - game_url: {f.get('game_url')}, source: {f.get('source')}")