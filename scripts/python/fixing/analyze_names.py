import json
import re
from _path_utils import get_all_fixes

fixes = get_all_fixes()

with open('data/scraped_online_fix.json', encoding='utf-8') as f:
    scraped = json.load(f)

no_url = [f for f in fixes if f.get('source') == 'online-fix.me' and not f.get('game_url')]
scraped_items = [(u['name'], u['url']) for u in scraped['unmatched']]

print("=== Fix names without game_url (first 20) ===")
for f in no_url[:20]:
    print("  FIX: %s" % f['name'])

print()
print("=== Scraped unmatched names (first 20) ===")
for name, url in scraped_items[:20]:
    print("  SCRAPED: %s  ->  %s" % (name, url))

def normalize(n):
    n = n.lower()
    n = re.sub(r'[^a-z0-9 ]', ' ', n)
    n = re.sub(r'\s+', ' ', n).strip()
    return n

fix_words = {}
for f in no_url:
    words = set(normalize(f['name']).split())
    fix_words[f['name']] = words

scraped_norm = {}
for name, url in scraped_items:
    words = set(normalize(name).split())
    # Remove 'po' and 'seti' which are noise words from scraped names
    words.discard('po')
    words.discard('seti')
    scraped_norm[name] = (words, url)

print()
print("=== Word overlap matches (>= 2 common words, first 30) ===")
match_count = 0
for fname, fwords in fix_words.items():
    best = None
    best_overlap = 0
    for sname, (swords, surl) in scraped_norm.items():
        overlap = len(fwords & swords)
        if overlap >= 2 and overlap > best_overlap:
            best = (sname, surl)
            best_overlap = overlap
    if best:
        print("  FIX: %s" % fname)
        print("    -> SCRAPED: %s" % best[0])
        print("    -> URL: %s" % best[1])
        print("    -> overlap: %d words" % best_overlap)
        match_count += 1
    if match_count >= 30:
        break

print()
print("Matches found in first 30: %d" % min(match_count, 30))
print("Total no_url fixes: %d" % len(no_url))
print("Total scraped items: %d" % len(scraped_items))
