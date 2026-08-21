import sys
import os
import json

# Simulate frozen mode
if getattr(sys, 'frozen', False):
    BUNDLE_DIR = sys._MEIPASS
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath("main_test2.py"))

print(f"BUNDLE_DIR: {BUNDLE_DIR}")

# Check files in bundle
games_path = os.path.join(BUNDLE_DIR, "games.json")
print(f"games.json exists in BUNDLE_DIR: {os.path.exists(games_path)}")

# List files in BUNDLE_DIR
print("\nFiles in BUNDLE_DIR:")
for f in os.listdir(BUNDLE_DIR):
    if f.endswith('.json') or f.endswith('.png'):
        print(f"  {f}")