# AHG Discord Bot

Discord bot + the HTTPS API the desktop app talks to. It is the only place that holds
the Discord bot token, the OAuth client secret and the GitHub gist token.

## Run

1. `copy .env.example .env` and fill in the blanks (see comments inside).
2. `run.bat` (installs `discord.py` + `requests` on first run, restarts on crash).

## HTTPS (no domain needed)

With `ENDPOINT_GIST_ID` set, the bot starts a free Cloudflare quick tunnel
(`cloudflared` must be installed) and writes its `https://*.trycloudflare.com` URL to
the public endpoint gist. The app reads the URL from that gist, so restarts that
change the URL need no app rebuild.

Have a domain on Cloudflare later? Run a named tunnel to `http://localhost:8765`, set
`"licenseApiUrl": "https://license.<domain>"` in the app's `config/secrets.json`, rebuild,
and clear `ENDPOINT_GIST_ID`.

## API

| Route | Body | Returns |
|---|---|---|
| `POST /license/check` | `{key, machineId}` | `{status}`: missing, pending, used, bound, other |
| `POST /license/activate` | `{key, machineId}` | `{status}`; binds a pending key to the machine |
| `POST /discord/token` | `{grant_type, code \| refresh_token}` | Discord OAuth token JSON |
| `POST /discord/revoke` | `{token}` | `{ok}` |
| `POST /discord/share` | `{accessToken, appid, gameName, coverUrl, dlcCount}` | `{ok}` |

20 requests per minute per IP.
