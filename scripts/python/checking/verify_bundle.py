import json

# Simulate what the EXE does at startup
import os

# Check what the code will find
bundle_dir = "dist/AHG_Steam_Unlocker_TEST_2"
exe_dir = "dist/AHG_Steam_Unlocker_TEST_2"

# The _find_file checks these paths:
# 1. BUNDLE_DIR (which is sys._MEIPASS = the _internal folder in onedir mode)
# 2. EXE_DIR 
# 3. BUNDLE_DIR/_internal

# For onedir, sys._MEIPASS is the dist/AHG_Steam_Unlocker_TEST_2 folder itself
internal_path = os.path.join(bundle_dir, "_internal", "games.json")
print(f"Checking: {internal_path}")
print(f"Exists: {os.path.exists(internal_path)}")

# Load and check
if os.path.exists(internal_path):
    with open(internal_path, 'r', encoding='utf-8') as f:
        games = json.load(f)
    print(f"Total games: {len(games)}")
    
    # Check DRM
    drm_true = sum(1 for g in games if g.get('drm', False))
    drm_false = sum(1 for g in games if not g.get('drm', False))
    print(f"DRM=True: {drm_true}, DRM=False: {drm_false}")
    
    # Check header_image
    with_header = sum(1 for g in games if g.get('header_image'))
    print(f"With header_image: {with_header}")
    
    # Sample a few games
    print("\nSample games:")
    for g in games[:3]:
        print(f"  {g.get('appid')}: {g.get('name')[:30]} - drm:{g.get('drm')} - img:{bool(g.get('header_image'))}")