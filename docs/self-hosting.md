# Self-hosting Gatefold

One container, one volume, all setup done in the UI — the Sonarr/Radarr
shape. Each self-hoster brings their own Spotify app (and, optionally, a
Discogs key); there's no shared backend and no multi-tenancy.

- [Quick start](#quick-start)
- [The Spotify app](#the-spotify-app)
- [Local vs. remote access](#local-vs-remote-access)
- [Reverse proxy examples](#reverse-proxy-examples)
- [Discogs (optional)](#discogs-optional)
- [Security](#security)
- [Backup](#backup)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)

## Quick start

```bash
mkdir gatefold && cd gatefold
curl -O https://raw.githubusercontent.com/sacortesh/gatefold-album-companion/main/docker-compose.yml
docker compose up -d
```

Open `http://<this machine>:8888`. Nothing is configured yet — Settings
walks you through the rest: a Spotify client ID, and optionally a Discogs
key and a UI password.

Everything mutable — config, reviews, the on-disk cache, the Spotify
token — lives under `./config` next to the compose file (mounted to
`/config` in the container). That directory is the entire backup surface;
nothing else in the container matters.

`docker-compose.yml` pulls the published image by default. Building from
source instead (e.g. before a tag exists, or to test a local change) is
`docker compose up -d --build`.

## The Spotify app

Gatefold needs its own Spotify application — one you register, for free,
against your own account. This is standard for any tool that talks to a
user's Spotify library (Sonarr/Radarr-for-Spotify, effectively); there's
no shared client ID to reuse.

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   and log in with the Spotify account Gatefold should control.
2. **Create app**. Any name/description works — this is never shown to
   anyone but you. Pick **Web API** when it asks which APIs you're using.
3. Open the new app → **Settings**. Leave it open; you'll come back to
   paste in the redirect URI in a moment.
4. In Gatefold, open **Settings → Spotify app**. It shows a **Redirect
   URI** field — copy it.
5. Back in the Spotify dashboard, paste that URI into **Redirect URIs**
   and **Save**.
6. Copy the app's **Client ID** (visible on the app's Settings page — no
   client secret needed, Gatefold uses PKCE) and paste it into Gatefold's
   **Client ID** field. Save.
7. Back on the main Settings page, **Connect Spotify** and approve the
   permission screen.

If the redirect URI shown in step 4 ever changes (e.g. you set a `PUBLIC_URL`
after the fact), repeat steps 4–5 — Spotify checks it for an exact match.

## Local vs. remote access

Spotify's OAuth only allows a plain-`http` redirect URI for `127.0.0.1` —
that's a Spotify platform rule, not something Gatefold can route around.
So there are two supported tiers:

**Local only** — you browse Gatefold from the same machine it runs on (or
over SSH port-forwarding). Leave **Public URL** blank in Settings; the
redirect URI stays `http://127.0.0.1:8888/callback`. No TLS, no domain,
nothing else to configure. This is the default `docker-compose.yml`.

**Remote** — you want to open Gatefold from a phone, another computer, or
anywhere off the host box. This needs:
- a domain name (or subdomain) pointed at the host,
- HTTPS in front of it (a reverse proxy or tunnel — Gatefold itself only
  speaks plain HTTP),
- `HOST=0.0.0.0` on the container so it accepts non-loopback connections
  (already the image default),
- **Public URL** set in Settings (or the `PUBLIC_URL` env var) to the
  `https://…` address people actually visit — the redirect URI is derived
  from it and shown back to you to paste into the Spotify dashboard.

Every `/api/*` call requires the API key regardless of tier (see
[Security](#security)) — that's what stands in for "loopback-only" once
the app is reachable from the wider network.

## Reverse proxy examples

Pick whichever you already run. All of them just need to terminate TLS on
your domain and forward to the container on port `8888`.

### Caddy

```
album.example.com {
    reverse_proxy gatefold:8888
}
```

Caddy issues and renews the certificate automatically. If Caddy isn't in
the same Docker network as Gatefold, use the host's address instead of
the service name.

### Cloudflare Tunnel

No open inbound port needed — the tunnel daemon dials out to Cloudflare.

```yaml
# cloudflared config.yml
tunnel: <tunnel-id>
credentials-file: /etc/cloudflared/<tunnel-id>.json
ingress:
  - hostname: album.example.com
    service: http://gatefold:8888
  - service: http_status:404
```

### Traefik (Docker labels)

```yaml
services:
  gatefold:
    image: ghcr.io/sacortesh/gatefold-album-companion:latest
    volumes: ["./config:/config"]
    environment:
      PUBLIC_URL: "https://album.example.com"
    labels:
      traefik.enable: "true"
      traefik.http.routers.gatefold.rule: "Host(`album.example.com`)"
      traefik.http.routers.gatefold.tls.certresolver: "letsencrypt"
      traefik.http.services.gatefold.loadbalancer.server.port: "8888"
```

### nginx

```nginx
server {
    listen 443 ssl;
    server_name album.example.com;

    ssl_certificate     /etc/letsencrypt/live/album.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/album.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Whichever proxy you use, set **Public URL** in Gatefold's Settings (or
`PUBLIC_URL`) to the externally-visible `https://` address — the app
doesn't try to infer it from proxy headers.

## Discogs (optional)

Enables the personnel/credits half of the "About this album" panel
(Wikipedia + MusicBrainz work without it). Free:

1. Create a key pair at
   [discogs.com/settings/developers](https://www.discogs.com/settings/developers).
2. Paste the consumer key + secret into **Settings → Discogs**.

## Security

- **API key** — required on every `/api/*` call (`X-Api-Key` header or
  `?apikey=`), generated automatically on first run. Anyone who can reach
  the container's port and has the key can control playback and edit your
  library — treat it like a password, and put it behind HTTPS for any
  non-local tier. Regenerate it any time from **Settings → Security**.
- **UI sign-in** — optional username + password gate on the SPA itself,
  for when the app is reachable by more than just you (a household, a
  remote box). Off by default. Also in **Settings → Security**.
- The container runs as an unprivileged user (`node`, uid 1000) even
  though the entrypoint briefly runs as root to fix bind-mount ownership
  on `/config`.

## Backup

Everything that matters is `./config` (the `/config` volume):
`app.json` (Spotify token, API key, session secret, your settings),
`config/*.json` (backlog, buttons, revisit queue), `reviews/*.md`, and a
disposable `cache/` you don't need to keep. Stop the container before
copying it if you want a consistent snapshot:

```bash
docker compose stop
tar czf gatefold-backup-$(date +%F).tar.gz config/
docker compose start
```

Restoring is the reverse: stop, extract over `config/`, start.

## Updating

There's no in-app self-updater (containers manage their own updates —
same reasoning Sonarr/Radarr use). Gatefold shows an **update available**
banner (checked against GitHub releases, ~6h cache) when a newer tag has
shipped; act on it with:

```bash
docker compose pull && docker compose up -d
```

Or point [Watchtower](https://containrrr.dev/watchtower/) at the
container to automate that.

## Troubleshooting

**"INVALID_CLIENT: Invalid redirect URI" from Spotify** — the URI shown
in Settings doesn't exactly match what's registered in the dashboard
(including scheme and trailing slash). Re-copy it and save on both ends.

**Connect works locally but not after setting a domain** — you likely
need to redo the [Spotify app](#the-spotify-app) steps 4–5: the redirect
URI changes when `PUBLIC_URL` changes, and Spotify checks for an exact
match against whatever's currently registered.

**Reconnect asks for permission again after an update** — expected once,
the first time you upgrade from a pre-PKCE build (Phase 9.4); a
confidential-flow refresh token can't be used under PKCE. One more
Connect click fixes it permanently.

**Healthcheck failing / `docker compose ps` shows unhealthy** — check
`docker compose logs gatefold`; the healthcheck itself just hits
`GET /api/health`, which needs no key and stays up even if Spotify isn't
connected yet, so a failure here usually means the process didn't start
at all (bad `CONFIG_DIR` permissions, a bind mount owned by a uid that
`chown` couldn't touch, etc).
