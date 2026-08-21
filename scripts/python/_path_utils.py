#!/usr/bin/env python3
"""
Path resolution utilities for scripts in the scripts/python/ directory tree.
Allows scripts to find project root regardless of subdirectory depth.

Also provides SQLite database access (games.db / fixes.db) for pipeline scripts
that previously used json.load(open('games.json')).

Usage:
    from _path_utils import get_all_games, upsert_fix, ...
"""
import os
import sqlite3

# ── Path resolution ──────────────────────────────────────────────────────

def find_project_root():
    """Walk up from this module's location until we find package.json."""
    current = os.path.dirname(os.path.abspath(__file__))
    while current:
        if os.path.exists(os.path.join(current, 'package.json')):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent
    raise RuntimeError(
        "Could not find project root - no package.json found. "
        "Run scripts from within the project directory."
    )

PROJECT_ROOT = find_project_root()

def data_path(filename):
    """Resolve filename relative to project root."""
    return os.path.join(PROJECT_ROOT, filename)

# ── SQLite helpers ───────────────────────────────────────────────────────

GAMES_DB = data_path('games.db')
FIXES_DB = data_path('fixes.db')

def _games_conn():
    conn = sqlite3.connect(GAMES_DB)
    conn.row_factory = sqlite3.Row
    return conn

def _fixes_conn():
    conn = sqlite3.connect(FIXES_DB)
    conn.row_factory = sqlite3.Row
    return conn

# ── Game queries ─────────────────────────────────────────────────────────

def get_all_games():
    """Return all games as list of dicts (same shape as old games.json)."""
    conn = _games_conn()
    try:
        return [dict(r) for r in conn.execute("SELECT * FROM games ORDER BY CAST(appid AS INTEGER)").fetchall()]
    finally:
        conn.close()

def get_game(appid):
    conn = _games_conn()
    try:
        r = conn.execute("SELECT * FROM games WHERE appid = ?", (str(appid),)).fetchone()
        return dict(r) if r else None
    finally:
        conn.close()

def get_games_by_appid():
    return {g['appid']: g for g in get_all_games()}

def count_games():
    conn = _games_conn()
    try:
        return conn.execute("SELECT COUNT(*) FROM games").fetchone()[0]
    finally:
        conn.close()

def upsert_game(appid, **kw):
    allowed = {'appid','name','added_date','updated_date','type','tags','nsfw','drm','dlc','header_image','genres','platforms'}
    data = {k: v for k, v in kw.items() if k in allowed}
    data['appid'] = str(appid)
    cols = ', '.join(data.keys())
    ph = ', '.join('?' for _ in data)
    upd = ', '.join(f"{k}=excluded.{k}" for k in data if k != 'appid')
    conn = _games_conn()
    try:
        conn.execute(f"INSERT INTO games ({cols}) VALUES ({ph}) ON CONFLICT(appid) DO UPDATE SET {upd}", list(data.values()))
        conn.commit()
    finally:
        conn.close()

def upsert_games(games):
    if not games:
        return
    conn = _games_conn()
    try:
        for g in games:
            aid = str(g.get('appid', ''))
            if not aid:
                continue
            allowed = {'appid','name','added_date','updated_date','type','tags','nsfw','drm','dlc','header_image','genres','platforms'}
            data = {k: v for k, v in g.items() if k in allowed and v is not None}
            data['appid'] = aid
            cols = ', '.join(data.keys())
            ph = ', '.join('?' for _ in data)
            upd = ', '.join(f"{k}=excluded.{k}" for k in data if k != 'appid')
            conn.execute(f"INSERT INTO games ({cols}) VALUES ({ph}) ON CONFLICT(appid) DO UPDATE SET {upd}", list(data.values()))
        conn.commit()
    finally:
        conn.close()

# ── Fix queries ──────────────────────────────────────────────────────────

def get_all_fixes():
    conn = _fixes_conn()
    try:
        return [dict(r) for r in conn.execute("SELECT * FROM fixes ORDER BY CAST(appid AS INTEGER)").fetchall()]
    finally:
        conn.close()

def get_fix(appid):
    conn = _fixes_conn()
    try:
        r = conn.execute("SELECT * FROM fixes WHERE appid = ?", (str(appid),)).fetchone()
        return dict(r) if r else None
    finally:
        conn.close()

def get_fixes_by_appid():
    return {f['appid']: f for f in get_all_fixes()}

def count_fixes():
    conn = _fixes_conn()
    try:
        return conn.execute("SELECT COUNT(*) FROM fixes").fetchone()[0]
    finally:
        conn.close()

def upsert_fix(appid, **kw):
    allowed = {'appid','name','badges','fix_count','source','download_url','game_url','download_urls','filename','versions'}
    data = {k: v for k, v in kw.items() if k in allowed}
    data['appid'] = str(appid)
    cols = ', '.join(data.keys())
    ph = ', '.join('?' for _ in data)
    upd = ', '.join(f"{k}=excluded.{k}" for k in data if k != 'appid')
    conn = _fixes_conn()
    try:
        conn.execute(f"INSERT INTO fixes ({cols}) VALUES ({ph}) ON CONFLICT(appid) DO UPDATE SET {upd}", list(data.values()))
        conn.commit()
    finally:
        conn.close()

def upsert_fixes(fixes):
    if not fixes:
        return
    conn = _fixes_conn()
    try:
        for f in fixes:
            aid = str(f.get('appid', ''))
            if not aid:
                continue
            allowed = {'appid','name','badges','fix_count','source','download_url','game_url','download_urls','filename','versions'}
            data = {k: v for k, v in f.items() if k in allowed and v is not None}
            data['appid'] = aid
            cols = ', '.join(data.keys())
            ph = ', '.join('?' for _ in data)
            upd = ', '.join(f"{k}=excluded.{k}" for k in data if k != 'appid')
            conn.execute(f"INSERT INTO fixes ({cols}) VALUES ({ph}) ON CONFLICT(appid) DO UPDATE SET {upd}", list(data.values()))
        conn.commit()
    finally:
        conn.close()
