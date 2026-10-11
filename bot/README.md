# AHG Discord Bot

Discord bot + the HTTPS API the desktop app talks to. It is the only place that holds
the Discord bot token and the GitHub gist token.

## Run

1. `copy .env.example .env` and fill in the blanks (see comments inside).
2. `run.bat` (installs `discord.py` + `requests` on first run, restarts on crash).

## Host it 24/7 (so customers never run anything)

The desktop app only needs the bot to be reachable; customers install nothing. Run the bot on any
always-on Linux box (Oracle Cloud "Always Free" VM, a $4 VPS, a Raspberry Pi):

```bash
# once: install Docker, then
git clone https://github.com/sinfoo/AHG-Steam-Unlocker && cd AHG-Steam-Unlocker/bot
cp .env.example .env && nano .env      # fill the secrets
docker compose up -d --build           # starts on boot, restarts on crash, updates the endpoint gist
docker compose logs -f                 # look for "Tunnel up: https://....trycloudflare.com"
```

It is the same bot (cloudflared is baked into the image), so no app rebuild is needed: the app reads
the tunnel URL from the endpoint gist. Stop any copy running on your own PC first — only one bot
instance may use the token. For a permanent URL use a Cloudflare named tunnel + `licenseApiUrl`.

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

20 requests per minute per IP.
