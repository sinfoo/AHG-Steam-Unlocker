import sys
import os
import json

# Test the bundled path detection
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if getattr(sys, 'frozen', False):
    BUNDLE_DIR = sys._MEIPASS
    EXE_DIR = os.path.dirname(sys.executable)
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))
    EXE_DIR = BUNDLE_DIR

print(f"BUNDLE_DIR: {BUNDLE_DIR}")
print(f"EXE_DIR: {EXE_DIR}")
print(f"frozen: {getattr(sys, 'frozen', False)}")

# Try to find games.json
games_in_bundle = os.path.join(BUNDLE_DIR, "games.json")
games_in_exe_dir = os.path.join(EXE_DIR, "games.json")
games_in_internal = os.path.join(EXE_DIR, "_internal", "games.json")

print(f"Games in BUNDLE_DIR: {os.path.exists(games_in_bundle)}")
print(f"Games in EXE_DIR: {os.path.exists(games_in_exe_dir)}")
print(f"Games in _internal: {os.path.exists(games_in_internal)}")

# Try BUNDLE_DIR + _internal
games_internal2 = os.path.join(BUNDLE_DIR, "_internal", "games.json")
print(f"Games in BUNDLE_DIR/_internal: {os.path.exists(games_internal2)}")