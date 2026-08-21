import requests
import re
import json

resp = requests.get('https://online-fix.me/games/page/1/', headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
print(f"Status: {resp.status_code}")
print(f"Content length: {len(resp.text)}")

# Find all images
img_pattern = r'(https://online-fix\.me/uploads/[^\s"\'<>]+\.(jpg|jpeg|png))'
imgs = re.findall(img_pattern, resp.text)
print(f"\nTotal images found: {len(imgs)}")

# Dedupe
unique_imgs = list(dict.fromkeys([i[0] for i in imgs]))
print(f"Unique images: {len(unique_imgs)}")

# Show first 5
for img in unique_imgs[:5]:
    print(f"  {img}")

# Find article/game links
link_pattern = r'(https://online-fix\.me/games/[^\s"\'<>]+)'
links = re.findall(link_pattern, resp.text)
# Filter out non-game links
game_links = [l for l in links if '/games/page' not in l and '/games/tag' not in l and '/games/search' not in l]
unique_game_links = list(dict.fromkeys(game_links))
print(f"\nGame links: {len(unique_game_links)}")
for l in unique_game_links[:5]:
    print(f"  {l}")