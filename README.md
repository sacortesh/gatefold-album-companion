# Gatefold

A companion app on top of Spotify for **deliberate album listening** — work
through a backlog of albums one at a time, read the whole-album lyrics and
context while you listen, triage tracks into playlists, then leave a verdict and
a review before the album clears from the queue.

It is not a downloader and not a general Spotify client. It is a single-account,
self-hosted tool for people who still listen to records front to back.

## What it does

- **Backlog** — queue albums (search, paste a link, or import every album out of
  a playlist a friend sent you) and start them with shuffle forced off.
- **Album view** — full tracklist, synced lyrics (LRCLIB), and an *About this
  album* panel with a blurb, personnel/credits and label info pulled from
  Wikipedia, MusicBrainz and Discogs.
- **Triage while listening** — one **Like** button (save to Liked Songs) and one
  **Banger** button (add to a chosen playlist + auto-Like), on the current track
  or any recent track. `P` play/pause, `L` like, `B` banger from the keyboard.
- **Verdict + review** — Keep / Revisit / Pass / Delete, a rating, tags, and
  notes (with an optional structured template). Reviews are written as plain
  Markdown you own; Keep saves the album to your Library, Delete removes it.
- **Ambient player** — a slim now-playing bar on every page.

Docs: [`docs/functional-spec.md`](docs/functional-spec.md) ·
[`docs/architecture.md`](docs/architecture.md) ·
[`docs/implementation-plan.md`](docs/implementation-plan.md) ·
[`docs/self-hosting.md`](docs/self-hosting.md)

## Stack

npm-workspaces monorepo:

| package | what |
|---|---|
| `packages/shared` | Zod schemas + shared types |
| `packages/server` | Fastify API — holds the Spotify credentials, does the OAuth exchange, reads/writes the config + review files |
| `packages/web` | React + Vite SPA (TanStack Query, React Router) |

The backend is the only filesystem writer and the only holder of Spotify tokens;
the browser never sees a token. Persistence is plain files: config as JSON,
reviews as Markdown, an on-disk cache for album/lyrics/context lookups.

## Run it (development)

Requires Node ≥ 20 and a **Spotify account** (Premium only for playback
*control* — observing and triage work without it).

1. Create a Spotify app at <https://developer.spotify.com/dashboard> and add the
   redirect URI **`http://127.0.0.1:8888/callback`** verbatim. Auth is
   Authorization Code + PKCE, so there's no client secret.
2. `cp .env.example .env` and fill in `SPOTIFY_CLIENT_ID`.
   Optionally add `DISCOGS_CONSUMER_KEY` / `DISCOGS_CONSUMER_SECRET`
   (<https://www.discogs.com/settings/developers>) to enable the credits panel.
   (Both can also be set later from the Settings page instead.)
3. Install and start:

   ```bash
   npm install
   npm run dev        # server on :8888, Vite on :5173
   ```

4. Open <http://127.0.0.1:5173>, go to **Settings → Connect Spotify**.

Production-style single process:

```bash
npm run build && npm start   # Fastify serves the built SPA + API on :8888
```

Useful scripts: `npm run typecheck`, `npm test`.

## Self-hosting

One container, one `/config` volume, all setup done in the UI — no `.env`
required (though one still works, for docker-compose users who prefer it).

```bash
mkdir gatefold && cd gatefold
curl -O https://raw.githubusercontent.com/sacortesh/gatefold-album-companion/main/docker-compose.yml
docker compose up -d
```

Open `http://<host>:8888` and follow Settings: paste a Spotify client ID,
see the exact redirect URI to register, connect. Everything mutable lives
under `./config` — that's the whole backup surface.

One constraint worth knowing early: Spotify only allows a plain-`http`
redirect URI for `127.0.0.1`. Reaching the app from another device needs a
real domain with HTTPS in front (a reverse proxy or a tunnel).

Full walkthrough — the Spotify app, Discogs, remote access, reverse-proxy
configs (Caddy/Traefik/nginx/Cloudflare Tunnel), backup, updating — in
[`docs/self-hosting.md`](docs/self-hosting.md).

## Status

MVP1 core loop (Phases 0–6) and Revision 1 (Phase 8: backlog-first UI, ambient
player, context panel, playlist import) are done. Phase 9 (self-hosting:
runtime config, API key + optional UI auth, PKCE auth, the `/config` volume,
the Docker image, and the update-check banner) is done. Phase 7 (polish,
responsive layout, tests) is the remaining open track.

## License

[AGPL-3.0-only](LICENSE). If you run a modified version as a network service,
you must make your changes available.
