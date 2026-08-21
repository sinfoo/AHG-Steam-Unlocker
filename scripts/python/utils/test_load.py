import sys
import os

# Test loading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import needed parts
import json

def _find_file(filename):
    BUNDLE_DIR = os.path.dirname(os.path.abspath("main_test2.py"))
    path = os.path.join(BUNDLE_DIR, filename)
    print(f"Looking for {filename} at {path}, exists: {os.path.exists(path)}")
    return path

GAMES_JSON = _find_file("games.json")

def _load_json_file(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

print("Loading games...")
json_data = _load_json_file(GAMES_JSON)
if json_data:
    print(f"Loaded {len(json_data)} games")
    print(f"First game: {json_data[0]}")
    print(f"Sample game 1000: {json_data[1000]}")
else:
    print("Failed to load")