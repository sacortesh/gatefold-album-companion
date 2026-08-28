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
[`docs/implementation-plan.md`](docs/implementation-plan.md)

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
   redirect URI **`http://127.0.0.1:8888/callback`** verbatim.
2. `cp .env.example .env` and fill in `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`.
   Optionally add `DISCOGS_CONSUMER_KEY` / `DISCOGS_CONSUMER_SECRET`
   (<https://www.discogs.com/settings/developers>) to enable the credits panel.
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

Docker images and a UI-driven setup (no `.env` needed) are **in progress** —
see **Phase 9** in [`docs/implementation-plan.md`](docs/implementation-plan.md).
Until then, run it from source as above.

One constraint worth knowing early: Spotify only allows a plain-`http` redirect
URI for `127.0.0.1`. Reaching the app from another device needs a real domain
with HTTPS in front (a reverse proxy or a tunnel).

## Status

MVP1 core loop (Phases 0–6) and Revision 1 (Phase 8: backlog-first UI, ambient
player, context panel, playlist import) are done. Phase 7 (polish, tests) and
Phase 9 (self-hosting) are the open tracks.

## License

[AGPL-3.0-only](LICENSE). If you run a modified version as a network service,
you must make your changes available.
