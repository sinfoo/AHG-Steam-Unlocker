import requests
from bs4 import BeautifulSoup
import json
import re
import time
import difflib
from collections import defaultdict

from _path_utils import data_path

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

BASE_URL = 'https://online-fix.me'


def get_page(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        return BeautifulSoup(resp.content, 'html.parser')
    except:
        return None


def load_games_json():
    try:
        with open(data_path('games.json'), 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {g['appid']: g['name'] for g in data if g.get('appid')}
    except:
        return {}


def load_existing_fixes():
    try:
        with open(data_path('fixes.json'), 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, list):
            return {g['appid'] for g in data if g.get('appid')}
        return {g['appid'] for g in data.get('games', []) if g.get('appid')}
    except:
        return set()


def clean_name(name):
    """Clean a game name for matching.

    Strips parenthetical content (Steam, crack, language tags),
    normalizes separators, removes common suffixes.
    """
    name = str(name).lower()
    # Remove parenthetical content: (Steam), (crack), (ENG/RUS), etc.
    name = re.sub(r'\([^)]*\)', '', name)
    # Remove common editorial suffixes
    name = re.sub(r'\s+po\s+seti$', '', name)
    # Normalize separators to spaces
    name = re.sub(r'[-_]', ' ', name)
    # Collapse and trim whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def fuzzy_match(name, game_names, threshold=0.85):
    """Find the best fuzzy match for name among game_names using SequenceMatcher.

    Returns (best_appid, best_ratio) or (None, 0.0) if no match meets threshold.
    """
    best_ratio = 0.0
    best_match = None
    name_lower = name.lower()
    for cand_appid, cand_clean in game_names:
        ratio = difflib.SequenceMatcher(None, name_lower, cand_clean).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = cand_appid
            if ratio >= 1.0:
                break
    return best_match, best_ratio


def build_exact_lookup(games_db, existing_appids):
    """Build {cleaned_name: appid} lookup for O(1) exact matching."""
    lookup = {}
    for appid, name in games_db.items():
        if appid in existing_appids:
            continue
        cleaned = clean_name(name)
        if cleaned:
            lookup[cleaned] = appid
    return lookup


def build_fuzzy_index(games_db, existing_appids):
    """Build a prefix-grouped index for efficient fuzzy matching.

    Groups games by the first 3 characters of their cleaned name,
    reducing the candidate set for each fuzzy search.
    """
    index = defaultdict(list)
    for appid, name in games_db.items():
        if appid in existing_appids:
            continue
        cleaned = clean_name(name)
        if not cleaned:
            continue
        prefix = cleaned[:3] if len(cleaned) >= 3 else cleaned
        index[prefix].append((appid, cleaned))
    return index


def extract_games_from_page(soup):
    games = []
    if not soup:
        return games
    entries = soup.find_all('a', class_='big-link')
    for entry in entries:
        href = entry.get('href', '')
        if '/games/' in href and href.endswith('.html'):
            name = href.split('/')[-1].replace('.html', '')
            match = re.search(r'\d+-(.+)$', name)
            if match:
                name = match.group(1).replace('-', ' ')
                # Store both relative url and full game_url
                full_url = BASE_URL + href if href.startswith('/') else href
                games.append({'url': href, 'game_url': full_url, 'name': name})
    return games


def main():
    print("Scraping ALL online-fix.me pages...")

    games_db = load_games_json()
    existing_appids = load_existing_fixes()

    # Build matching indexes once for performance
    print(f"Building match indexes for {len(games_db)} games...")
    exact_lookup = build_exact_lookup(games_db, existing_appids)
    fuzzy_index = build_fuzzy_index(games_db, existing_appids)
    print(f"  Exact lookup: {len(exact_lookup)} entries")
    print(f"  Fuzzy index groups: {len(fuzzy_index)}")

    all_games = []

    for page in range(1, 63):
        url = f"{BASE_URL}/games/page/{page}/"
        soup = get_page(url)
        if soup:
            games = extract_games_from_page(soup)
            all_games.extend(games)
            print(f"Page {page}: +{len(games)} = {len(all_games)} total")
        else:
            print(f"Page {page}: FAILED")
        time.sleep(0.1)

    # Deduplicate by cleaned name
    seen = set()
    unique = []
    for g in all_games:
        key = clean_name(g['name'])
        if key not in seen:
            seen.add(key)
            unique.append(g)

    print(f"\nUnique games: {len(unique)}")

    # Match appids — three-pass strategy: exact, substring, fuzzy
    matched = []
    unmatched = []

    for g in unique:
        if g['name'] in existing_appids:
            continue

        cleaned = clean_name(g['name'])
        found = False

        # --- Pass 1: Exact match via lookup dict (O(1)) ---
        appid = exact_lookup.get(cleaned)
        if appid and appid not in existing_appids:
            matched.append({**g, 'appid': appid, 'game_url': g.get('game_url', '')})
            existing_appids.add(appid)
            continue

        # --- Pass 2: Substring / containment match ---
        for db_appid, db_name in games_db.items():
            if db_appid in existing_appids:
                continue
            db_clean = clean_name(db_name)
            if len(db_clean) > 3 and (db_clean in cleaned or cleaned in db_clean):
                matched.append({**g, 'appid': db_appid})
                existing_appids.add(db_appid)
                found = True
                break

        if found:
            continue

        # --- Pass 3: Fuzzy match via prefix-grouped index ---
        prefix = cleaned[:3] if len(cleaned) >= 3 else cleaned
        candidates = fuzzy_index.get(prefix, [])
        best_id, best_ratio = fuzzy_match(cleaned, candidates)

        if best_id and best_ratio >= 0.85 and best_id not in existing_appids:
            matched.append({**g, 'appid': best_id})
            existing_appids.add(best_id)
            print(f"  Fuzzy match [{best_ratio:.3f}]: '{g['name']}' -> appid {best_id}")
        else:
            # Broader attempt: search across all groups starting with first 2 chars
            if len(cleaned) >= 2:
                broader_prefix = cleaned[:2]
                broader_candidates = []
                for p, cands in fuzzy_index.items():
                    if p.startswith(broader_prefix):
                        broader_candidates.extend(cands)
                if broader_candidates:
                    best_id, best_ratio = fuzzy_match(cleaned, broader_candidates)
                    if best_id and best_ratio >= 0.85 and best_id not in existing_appids:
                        matched.append({**g, 'appid': best_id})
                        existing_appids.add(best_id)
                        print(f"  Fuzzy match (broad) [{best_ratio:.3f}]: '{g['name']}' -> appid {best_id}")
                        continue

            unmatched.append({
                **g,
                'appid': None,
                'best_fuzzy_score': round(best_ratio, 4),
            })

    print(f"\nNew matches: {len(matched)}")
    print(f"Unmatched: {len(unmatched)}")

    if unmatched:
        print("\nUnmatched games (top 30 by name for manual review):")
        # Sort by fuzzy score descending so highest-scoring near-misses appear first
        sorted_unmatched = sorted(unmatched, key=lambda x: x['best_fuzzy_score'], reverse=True)
        for g in sorted_unmatched[:30]:
            print(f"  score={g['best_fuzzy_score']:.3f}  {g['name']}")
        if len(unmatched) > 30:
            print(f"  ... and {len(unmatched) - 30} more")

    # Save output
    output = {
        'source': 'online-fix.me',
        'total_pages': 62,
        'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'total_scraped': len(unique),
        'new_matches': matched,
        'unmatched': unmatched,
    }

    with open(data_path('scraped_online_fix.json'), 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nSaved to scraped_online_fix.json")


if __name__ == '__main__':
    main()
