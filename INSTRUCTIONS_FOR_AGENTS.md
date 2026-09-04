# Instructions for AI agents

Gatefold is a single-account, self-hosted companion app on top of Spotify. If
you're an AI agent (a script, a Claude/GPT tool call, an MCP server, a cron
job) rather than a human clicking through the UI, this file is your
quickstart. It does not replace the real contract — treat it as a curated
entry point, and treat **`GET /docs`** on the running instance (Swagger UI,
generated from the actual Zod schemas) as the source of truth for every field
and status code.

## Who this is for

Anything that wants to read or change a person's album backlog, trigger
playback, or read/write reviews without a human driving the browser — e.g.
"add these five albums to my backlog," "what's currently playing," "mark
this album Keep with a rating."

This is a **single-user** app. There is one Spotify account, one backlog, one
set of reviews. There's no concept of "which user" in any request — whoever
holds the API key has full read/write access to everything.

## Base URL and auth

Every request needs the API key from **Settings → Security** in the running
app, sent as a header:

```
X-Api-Key: <the key>
```

`GET /api/health` is the only route that doesn't need it (used for container
health checks). Everything else under `/api/*` returns `401 unauthorized` if
the header is missing or wrong.

If the instance also has UI sign-in enabled (a second, optional layer gating
the browser app itself — separate from the API key), that only affects
browser sessions via a cookie; it does not change how you call the API. You
still just need the API key.

```bash
BASE="http://127.0.0.1:8888"   # or whatever PUBLIC_URL points at
KEY="paste-from-settings-security"

curl -s "$BASE/api/health"                                   # no key needed
curl -s -H "X-Api-Key: $KEY" "$BASE/api/backlog"
```

A bad or missing key: `401 {"error":{"code":"unauthorized","message":"..."}}`.
A Spotify-not-connected state also surfaces as a plain `401`, but with a
different `code` (`not_connected`) — don't treat every 401 as "the API key is
wrong."

## Error shape

Every failure is:

```json
{ "error": { "code": "some_code", "message": "human-readable reason" } }
```

`code` is the stable, machine-checkable part; `message` is for logs/humans.
A validation failure on a bad request body returns `400` with a field-level
message built from the route's Zod schema — read `message`, it names the
field.

## What you can actually do — task-oriented map

| Task | Method + path | Notes |
|---|---|---|
| Search Spotify's catalog for an album | `GET /api/search?q=...` | Returns `AlbumSummary[]` |
| Add an album to the backlog | `POST /api/backlog` `{ "album": "<id, spotify: URI, or open.spotify.com URL>" }` | Any of the three forms is resolved server-side |
| Add many at once | `POST /api/backlog/bulk` `{ "albums": [...] }` | One atomic write — use this instead of looping single adds |
| List the backlog | `GET /api/backlog` | |
| Remove from the backlog | `DELETE /api/backlog/:albumId` | |
| Reorder the backlog | `PUT /api/backlog` `{ "albumIds": [...] }` | Full replacement order |
| Pull every full-album out of a playlist | `GET /api/playlist/:id/albums` | For "import this playlist as albums" style requests |
| Read one album's full detail (tracklist, genres, label) | `GET /api/album/:id` | |
| Read an album's write-up (Wikipedia summary, Discogs credits/notes, MusicBrainz facts, external links) | `GET /api/album/:id/context` | Cached ~30 days server-side; may be partially empty if Discogs isn't configured |
| Read synced/plain lyrics for every track on an album | `GET /api/album/:id/lyrics` | Keyed by track id; `null` fields mean not found |
| See what's playing right now | `GET /api/playback` | |
| List available Spotify Connect devices | `GET /api/devices` | Do this before `play` if you're not sure anything is active — see below |
| Start/resume playback | `POST /api/playback/play` `{ "contextUri": "spotify:album:<id>", "shuffle": false, "repeat": "off" }` | Omit `contextUri`/`uris` to just resume |
| Pause / skip | `POST /api/playback/pause`, `/next`, `/previous` | |
| Like a track | `POST /api/like` `{ "trackId": "..." }` | Adds to the user's Liked Songs |
| "Banger" a track | `POST /api/banger` `{ "trackId": "..." }` | Adds to the configured playlist + auto-likes; `409` if no playlist is configured yet (see `PUT /api/config/buttons`) |
| Finish an album with a verdict | `POST /api/verdict` `{ "albumId", "verdict": "keep"\|"revisit"\|"pass"\|"delete", "rating"?, "tags"?, "notes"? }` | Writes a Markdown review file; `keep` saves the album to the Spotify library, `delete` removes it |
| List every past review | `GET /api/reviews` | |
| List the revisit queue | `GET /api/revisit` | Albums marked `revisit` |
| Read/write app config (device preference, banger playlist, etc.) | `GET`/`PUT` `/api/config/:name` | `name` ∈ `settings`, `buttons`, `backlog`, `revisit` — see `packages/shared/src/config.ts` for exact shapes |

Full request/response schemas, every status code, and try-it-out are all in
`/docs` on the running instance — that's generated straight from the same
Zod schemas the server validates against, so it can't drift from reality the
way a hand-written doc can.

## Playback has a device precondition

Spotify playback commands need an **active device** (something with Spotify
open — desktop app, phone, a Connect speaker). If nothing is active, `play`
first tries the device pinned in Settings → Playback device
(`preferredDeviceId` in the `settings` config); if that's also unset, you get
back:

```json
{ "error": { "code": "no_device", "message": "No active Spotify device..." } }
```

That's not a bug to retry past — it means there's genuinely nowhere to play
audio. Call `GET /api/devices` and either tell the caller which devices exist
so a human can open one, or (if you know which one you want) call
`POST /api/playback/transfer` `{ "deviceId": "...", "play": true }` yourself
before retrying `play`.

## Rate limits and etiquette

There's no rate limiting in front of the API key itself, but every Spotify-
backed route ultimately calls Spotify's own API, which does rate-limit (429s
propagate through as-is). Concretely:

- Don't poll `/api/playback` faster than every few seconds for a background
  job — the web UI itself polls at 6s and extrapolates position client-side
  in between. There's no push/websocket channel.
- Prefer `/api/backlog/bulk` over N calls to `/api/backlog` when adding more
  than one album — it's one read-modify-write, not N racing ones.
- Album context (`/album/:id/context`) and lyrics are cached server-side —
  repeated calls for the same album are cheap after the first.

## Config values worth knowing

`GET /api/config/settings` → `{ preferredDeviceId }` — the fallback playback
device (see above).

`GET /api/config/buttons` → `{ banger: { label, playlistId, autoLike,
shortcut } }` — `playlistId` must be a real Spotify playlist id (not URI) or
`/api/banger` 409s.

Both are writable via `PUT /api/config/:name` with the full object (partial
updates aren't merged — read first, then write the whole thing back with your
change applied).

## Things not to do

- Don't try to work around the API key by hitting the SPA's own routes —
  everything under `/api/*` is guarded the same way regardless of how you got
  there.
- Don't assume multi-tenancy. There is one backlog, one set of reviews, one
  Spotify account. If you're building something that fans this out to
  multiple people, that's a different app, not a usage pattern of this one.
- Don't force shuffle/repeat unless the caller actually asked for it —
  Gatefold's whole premise is deliberate, front-to-back album listening, and
  the UI itself always passes `shuffle: false, repeat: "off"` when starting
  an album for that reason.
