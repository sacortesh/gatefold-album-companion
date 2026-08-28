# Implementation Plan — MVP1

Status: **proposal** — pairs with `functional-spec.md` v0.6 and
`architecture.md`
Date: 2026-08-27

Eight phases. Each one ends in something you can open and use. Build in
order — every phase depends on the ones before it.

Legend: `[ ]` task · **(you)** = a step only the user can do ·
**AC** = acceptance criteria (phase is done when these pass).

---

## Phase 0 — Scaffold  ✅ done (2026-08-27)

Goal: `npm run dev` opens an empty app shell wired front-to-back.

- [x] npm workspaces root: `package.json` (with `workspaces` field),
      `tsconfig.base.json`, `.gitignore`, `.env.example`
- [x] `packages/shared` — Zod schemas + inferred types for
      `settings.json`, `buttons.json`, `backlog.json`, `revisit.json`,
      review frontmatter, and the API DTOs (`src/{config,review,dto}.ts`)
- [x] `packages/server` — Fastify skeleton, binds `127.0.0.1:8888`,
      `GET /api/health`, `@fastify/static` for the built SPA, uniform
      `{error:{code,message}}` errors + SPA fallback
- [x] `packages/web` — Vite + React 19 + TS, Tailwind 3, React Router 7
      shell (`/`, `/backlog`, `/album/:id`, `/revisit`, `/settings`),
      TanStack Query provider, typed `api/` client, health dot in nav
- [x] root scripts: `dev` (concurrently: `tsx watch` server + `vite`),
      `build`, `start`; Vite proxy `/api` + `/auth` → `:8888`
- [x] seed `data/config/*.json`

**AC:** ✅ `npm run dev` serves the shell at `:5173`; routes resolve
(incl. deep-link SPA fallback); `/api/health` proxies through to `:8888`.
✅ `npm run build && npm start` serves SPA + API on `:8888`.
✅ `npm run typecheck` clean; `npm audit` 0 vulnerabilities.

Notes / deviations from the plan:
- **npm workspaces**, not pnpm (not installable in this env).
- Versions ran ahead of the doc: Vite 8, `@vitejs/plugin-react` 5,
  vitest 4, `@fastify/static` 10 (security). React 19, Tailwind 3, Zod 3,
  TanStack Query 5, React Router 7 as planned.
- Server runs via `tsx` in dev *and* prod (no separate compile step);
  only the web app has a build.
- `npm start` sets `NODE_ENV=production` inline (Linux/macOS shell form).

---

## Phase 1 — Spotify auth  🟡 code done, awaiting one manual connect

Goal: connect a Spotify account; the connection survives a restart.

- [x] **(you)** register an app; redirect URI `http://127.0.0.1:8888/callback`;
      client id + secret in `.env` — done 2026-08-27
- [x] `server/auth/` — `GET /auth/login` (authorize URL + CSRF `state`,
      10 scopes), `GET /callback` (code→token exchange, all failure paths
      redirect to `/settings?auth=…`), refresh-token persistence to
      `data/.auth.json` (`oauth.ts` + `tokenStore.ts`)
- [x] `server/spotify/` — `client.ts` authed fetch wrapper: bearer
      inject, refresh+retry once on 401, `Retry-After` on 429,
      concurrency semaphore (4); `cache.ts` on-disk GET cache scaffold
- [x] `GET /api/auth/status` → `{ connected, scopes, expiresAt, user,
      configured }` (probes `/me`); `DELETE /api/auth` to disconnect;
      `POST /api/auth/debug` (dev only) to expire / corrupt the token
- [x] `web/features/settings/SettingsPage` — connection status, user
      name, scope count, token expiry, Connect / Disconnect, `?auth=`
      banner, dev token-refresh test buttons

**AC:** ✅ `/auth/login` 302s to Spotify with the right client id + scopes
+ redirect URI (verified via curl + Vite proxy). ✅ bad-state / denied /
error callbacks land on `/settings?auth=…`. ✅ typecheck + build clean.
⏳ **needs the user once:** open `/settings` → Connect → approve → confirm
"Connected as …", restart server (still connected), hit the dev "Expire" /
"Corrupt" buttons and confirm status recovers.

---

## Phase 2 — Now playing + playback control  ✅ done (2026-08-27)

Goal: see what's playing and drive it from the app.

- [x] `spotify/player.ts`: `getPlayback`, `getDevices`, `play`, `pause`,
      `next`, `previous`, `seek`, `transferPlayback` (+ raw→DTO mapping,
      mid-size album art picker)
- [x] routes: `GET /api/playback`, `GET /api/devices`,
      `POST /api/playback/{play,pause,next,previous,seek,transfer}`;
      play falls back to the preferred device when nothing is active
- [x] `GET|PUT /api/config/:name` generic config route + `store/config.ts`
      (Zod-validated read/write)
- [x] `web/features/now-playing` — album art, title/artists/album,
      "track N of M" when the context is that album, click-to-seek
      progress bar with local extrapolation, prev/play-pause/next,
      device line, control-error toast
- [x] `web/features/settings/DevicePicker` — radio list → saves
      `settings.preferredDeviceId`; "Play here" transfers
- [x] `usePlayback` hook: `refetchInterval` 3 s, optimistic
      play/pause/seek, refetch-after-600 ms reconcile

**AC:** ✅ verified live against the user's account — `/api/playback`
reflects the real track/device/progress; pause / play / next / previous /
seek / transfer all return `{ok:true}` and take effect; `preferredDeviceId`
persists to `data/config/settings.json`; bad config name → 404.
(One JSON-parse bug fixed: player-control 2xx replies carry a short opaque
body, not JSON.)
⏳ browser eyeball on the UI still worthwhile but not blocking.

---

## Phase 3 — Like + Banger  ✅ done (2026-08-27)

Goal: the core triage loop, on the current track and on history rows.

- [x] `spotify/library.ts` — `areTracksSaved` (batched /contains),
      `isTrackSaved`, `saveTrack`, `removeSavedTrack`
- [x] `spotify/playlists.ts` — `getEditablePlaylists` (owned +
      collaborative, paginated), `getPlaylistTrackIds` (cached by
      `snapshot_id` + 30 s TTL), `addTrackToPlaylist` (optimistic cache
      bump)
- [x] `spotify/recent.ts` — `getRecentlyPlayed`, raw→`TrackRef`
- [x] routes: `POST/DELETE /api/like`, `POST /api/banger` (idempotent:
      membership check → add → auto-Like), `GET /api/playlists`,
      `GET /api/recent` (current track + recently-played 50, deduped,
      `liked`/`inBanger` batch-resolved)
- [x] `web/features/recent` — `useRecent` hook (15 s poll, optimistic
      like/banger + rollback), `RecentPage` list, `TriageControls`
      (Like ♥ / Banger) shared sm/lg
- [x] `web/features/now-playing` — big Like + Banger on the current
      track, `L` / `B` hotkeys, recently-listened list below
- [x] `web/features/settings/BangerPlaylistPicker` — dropdown of editable
      playlists → writes `buttons.json`, invalidates recent

**AC:** ✅ verified live — Like a recent track (`liked` flips, then
un-Like), Banger a track → `{addedToPlaylist:true, liked:true}`, it shows
in the playlist + Liked Songs, re-press → `addedToPlaylist:false`. Test
data cleaned up afterward (account left as found).
Fix along the way: membership cache now has a 30 s TTL on top of the
snapshot check — Spotify's playlist `snapshot_id` lags external edits.

---

## Phase 4 — Backlog  ✅ done (2026-08-28)

Goal: put albums in a queue and start them.

- [x] `spotify/albums.ts` — `getAlbum`/`getAlbums` (7-day on-disk cache,
      `/albums?ids=` batching), `searchAlbums`, `toAlbumSummary`
      (year, track count, summed duration), `parseAlbumId` (id / URI /
      URL)
- [x] routes: `GET /api/backlog` (enriched, priority-sorted),
      `POST /api/backlog` (id or link, dedup, real 404 kept distinct
      from transient errors), `DELETE /api/backlog/:albumId`,
      `PUT /api/backlog` (reorder), `GET /api/search?q=`
- [x] play-album reuses Phase 2 `POST /api/playback/play {contextUri}`
      (device fallback included)
- [x] `web/features/backlog` — `useBacklog` (optimistic remove/reorder),
      `AlbumSearch` (debounced, paste-a-link shortcut), `BacklogPage`
      cards with cover→`/album/:id`, meta line, Play / ▲▼ / Remove
- [ ] "Play this album" from now-playing/album view — deferred to Phase 5
      (album view)

**AC:** ✅ verified live — search "deafheaven sunbather" → add by id and by
link → cards show year · N tracks · duration → reorder + remove work →
"Play album" with no active device falls back to the preferred device and
starts at **track 1** ("Dream House"). Test backlog cleared afterward.
Fix: routes no longer mask transient Spotify errors as "album not found"
(only a real 404 does).

---

## Phase 5 — Album experience view  ✅ done (2026-08-28)

Goal: the "complete listening" screen — tracklist, metadata, lyrics.

- [x] `cache.ts` — namespaced on-disk cache (`makeCache`), replacing
      `spotify/cache.ts`; `data/cache/{spotify,lyrics}/`
- [x] `lyrics/lrclib.ts` — LRCLIB `get` by artist/track/album/duration,
      `search` fallback, LRC parser (multi-timestamp), 30-day cache
      incl. misses, instrumental handling
- [x] `spotify/albums.ts` — `getAlbumTracks` (paginates > 50), richer
      `RawAlbum` (label, popularity, genres, copyrights)
- [x] routes: `GET /api/album/:id` (metadata + full tracklist +
      `inBacklog`), `GET /api/album/:id/lyrics` (all tracks, concurrency
      5), `GET /api/track-states?ids=` (per-track liked/inBanger)
- [x] shared `useTriage` extracted; `useRecent` + `useAlbumTriage` both
      use it
- [x] `web/features/album/AlbumPage` — header (cover, meta, label,
      genres, Play album, backlog toggle), tracklist (# / hover-▶ / name
      / E / now / duration / Like / Banger, click = select), sticky
      `LyricsPanel` (synced w/ live highlight + autoscroll when it's the
      now-playing track, plain fallback, instrumental / none states),
      copyright footer
- [x] click a track → play from there (`offset.uri`); "View album" link
      on Now Playing

**AC:** ✅ verified live — Sunbather album loads with full metadata +
tracklist; lyrics resolve in ~1.5 s (mix of synced / plain / instrumental,
good LRCLIB coverage); Daft Punk RAM all-synced; play-from-track jumps to
track 5; `track-states` reflects the user's real Liked Songs.

---

## Phase 6 — Album verdict + review  ✅ done (2026-08-28)

Goal: close the loop — verdict, notes, file written, backlog cleared.

- [x] `shared/review.ts` — `reviewSchema`, `verdictResponseSchema`,
      `reviewsResponseSchema` (verdict enum + frontmatter were there)
- [x] `store/reviews.ts` — gray-matter read/write, `slug()` +
      `<artist>-<album>.md` under `reviews/<year>/`, `readAllReviews`,
      `findReview`; drops `undefined` optionals before YAML dump
- [x] `spotify/library.ts` — `isAlbumSaved`, `saveAlbum`,
      `removeSavedAlbum`
- [x] `POST /api/verdict` — keep→saveAlbum, delete→removeSavedAlbum (if
      saved), revisit→`revisit.json`, all→write review + drop from
      backlog; re-review keeps `listenedOn`, bumps `revisitedOn` only
      when it was in Revisit
- [x] `GET /api/reviews`, `GET /api/review/:albumId` (404 if none),
      `GET /api/revisit` (enriched w/ album summary + review)
- [x] `web/features/review` — `VerdictDialog` (4 verdict cards, 1–10
      rating, tags, notes), `useAlbumReview` / `useSubmitVerdict`;
      AlbumPage gets a "Finish album / Update review" button + a
      prior-review banner
- [x] `web/features/revisit/RevisitPage` — cards (cover, prior verdict +
      rating + notes, revisit count), Play / Open

**AC:** ✅ verified live — all four verdicts: PASS (review + backlog clear,
no side-effect), KEEP (album saved), REVISIT (`revisit.json` + shows in
`/api/revisit`), DELETE (album removed from Library, confirmed via
`/me/albums/contains`). Review files written with valid frontmatter;
`GET /api/review/:id` 404s when absent. All test data cleaned up.
Fix: js-yaml can't dump `undefined` → strip absent optionals in
`writeReview`.

---

## Phase 7 — Polish & hardening

Goal: it survives real use and a fresh clone.

### Correctness / UX
- [ ] error states: no active device, account not Premium (control
      disabled, triage still works), auth expired, 429 surfaced calmly
- [ ] empty states: empty backlog, nothing playing, no lyrics, not
      connected
- [ ] keyboard-shortcut help overlay (`?`)

### Responsive layout (assessed 2026-08-28)
- [ ] nav bar: 4 items + status dot overflow the header below ~360 px —
      let it wrap, or collapse to a compact/menu form on narrow screens
- [ ] backlog cards: cover + ▲▼ + "Play album" + "Remove" are all
      fixed-width `shrink-0` (~260 px) → the row breaks on a phone;
      restack the controls / move secondary actions into a menu
- [ ] album tracklist: "play from here" ▶ is `group-hover` only →
      invisible on touch; give every row a real tap target
- [ ] audit remaining rows (recent, revisit, device picker) at 360 px for
      horizontal overflow — the page body must never scroll sideways

### Performance on low-end / mobile
- [ ] images: server returns Spotify's 640 px image (`images[0]`) for
      every thumbnail — pick the smallest for `image` fields in
      `recent.ts` / `albums.ts` / `playlists.ts` (keep a bigger one only
      for the now-playing art); add `loading="lazy"` + explicit
      width/height to all `<img>`
- [ ] isolate the 500 ms progress ticker (`usePlayback` → `useTicker`)
      into a leaf component so it doesn't re-render the whole Now Playing
      tree (which embeds the Recent list) twice a second — or drive the
      bar with a CSS transition / rAF
- [ ] pause polling when the tab is hidden (`visibilitychange` →
      `refetchInterval` off) — `/playback` 3 s, `/recent` 15 s, health
      30 s all run in the background today
- [ ] consider a lighter bundle (361 KB raw / ~110 KB gzip): route-level
      code-splitting so first paint isn't the whole app

### Ship
- [ ] `README.md` — dashboard setup, `.env`, `npm run dev`, first-run auth
- [ ] Vitest: `spotify` wrapper retry/refresh, `store` round-trips,
      `verdict` side-effects, `/api/recent` state resolution
- [ ] verify `npm run build && npm start` clean on a fresh checkout

**AC:** a fresh clone + the README gets someone to a working app;
`npm test` green; unplugging the speaker / revoking the token both fail
gracefully; no horizontal scroll at 360 px on any page.

### Deferred — LAN / mobile access (own decision, not Phase 7)
The server binds `127.0.0.1` only, so a separate phone can't reach it, and
"loopback-only" is currently the entire security model. Serving it to
another device on the wifi (`HOST=0.0.0.0` + LAN IP + matching redirect
URI) needs real auth on `/api/*` first — anyone on the network could
otherwise control playback and edit the library. Revisit when mobile use
is actually wanted.

---

## Phase 8 — Revision 1 (from the first real listening sessions)

Source: hands-on review notes, 2026-08-28. Runs as its own track — none of
it blocks Phase 7. Fold new scenarios into `docs/acceptance-tests.md` as
each item lands.

### Rev-1 — quick wins  ✅ done (2026-08-28)

- [x] lyrics panel heading: `"<title> — lyrics"` → `"Lyrics: <title>"`
      (`web/features/album/AlbumPage.tsx`)
- [x] shuffle **and** repeat forced off when an album starts — added
      `shuffle?`/`repeat?` to `PlayOptions` + `playRequestSchema`;
      `setShuffle`/`setRepeat` run *before* the play PUT in
      `server/spotify/player.ts` (so a shuffled context can't start on a
      random track); wired from `AlbumPage` play + `useBacklog` play only.
      The no-device path still falls through to `playWithFallback`.
- [x] add-to-backlog from the album panel: `useBacklog` add/remove now
      invalidate `["album", id]`; `AlbumPage` renders add/remove errors +
      pending labels
- [x] verdict dialog tags: relabelled "Genre, mood, how it made you feel
      — optional" + click-to-add suggestion chips
- [x] verdict dialog: "Insert review template" button (shown only when
      notes are empty); `GET /api/review-template` reads
      `data/config/review-template.md` with a built-in fallback
      (`store/reviews.ts` `readReviewTemplate`)

### Rev-2 — Backlog-first IA + global player card  ✅ done (2026-08-28)

- [x] landing route (`/`) renders `BacklogPage`; nav reordered
      (Backlog · Now Playing · Recent · Revisit · Settings); `/recent` is
      its own route now; `/backlog` kept as an alias. Now Playing page
      unchanged, just demoted from the index.
- [x] `NowPlayingCard` — global **sticky bottom bar** in `Layout.tsx`:
      small art / track / artist·album / ♥ / Banger / ▶⏸ / ⏭ / thin
      progress bar (display-only). Hidden when nothing is playing or not
      connected. `main` got `pb-28` to clear it. `P` toggles play/pause
      from anywhere (generic `useHotkeys` in `features/triage/`).
- [x] live liked-state everywhere — `useTriage.invalidateSoon` now also
      invalidates `["recent"]` and `["track-states"]` (prefix) after every
      Like/Banger; `useAlbumTriage` gained `refetchInterval: 20s` +
      `refetchOnWindowFocus`. Fixes the stale album-view Like button.
- [x] album detail page: when this album is the active context the header
      shows ⏮ / Pause·Resume / ⏭ (via `usePlayback().controls`) instead of
      "Play album"
- [x] `L` / `B` hotkeys on the album page — `useTriageHotkeys` extracted
      to `features/triage/`; targets the now-playing track when it's on
      the album, else the selected row; a hint line shows the target

### Rev-3 — "About this album" context panel  ✅ done (2026-08-28)

- [x] `server/src/context/` — `musicbrainz.ts` (release-group lookup →
      first-release-date, secondary types, authoritative Wikipedia-relation
      title; retries on transient TLS resets), `wikipedia.ts` (REST search
      + summary; strips "Pt. I"/edition suffixes for the query, rejects a
      candidate whose title carries specifics the album lacks — e.g. "Part
      II"), `discogs.ts` (key/secret auth, scores releases to skip
      promos/singles/comps, credits grouped by person), `http.ts`
      (User-Agent, timeout, retry, `safe()` wrapper), `index.ts`
      (orchestrator, merges links, 30-day cache, skips caching a fully
      empty result)
- [x] `GET /api/album/:id/context` → `AlbumContext` DTO; every provider is
      independent and degrades to null
- [x] `AlbumContextPanel` — `<details>` "About this album" on `AlbumPage`
      (below the header): Wikipedia prose + "Read on Wikipedia", a facts
      grid (first released / label / genre / format), grouped personnel,
      Discogs release notes, external links, and a nudge when Discogs
      creds are absent
- [x] Discogs consumer key/secret in `.env` + `.env.example`;
      `DISCOGS_CONSUMER_KEY` / `_SECRET` in `env.ts` + `discogsConfigured`

Note: MusicBrainz + Wikipedia are partly blocked from this sandbox's
egress (TLS resets) so `firstReleased` shows null here; verified working
for Wikipedia + Discogs against real albums (Avantasia, Gojira). Both
light up fully on a normal network.

### Rev-4 — playlist as a backlog source  ✅ done (2026-08-28)

- [x] `spotify/playlists.ts` `getPlaylistAlbums` — paginates the playlist,
      keeps only `album_type === "album"` tracks, dedupes by name+artist
      (Spotify carries one album under several ids), counts tracks per
      album, preserves order; `parsePlaylistId` (id / URI / URL)
- [x] `GET /api/playlist/:id/albums` → `PlaylistAlbumsResponse`
      (`playlistName` + `{album, trackCount, inBacklog}[]`); friendly 404
      for private/missing playlists
- [x] `POST /api/backlog/bulk` `{albums: string[]}` — one atomic
      read-modify-write (looping the single-add route would race on the
      config file)
- [x] `PlaylistImport` — a `<details>` under `AlbumSearch` on the backlog
      page: paste link → "Read" → checklist (art / name / artist / track
      count, already-in-backlog rows disabled) with "Select all new" →
      "Add N to backlog"

Note: Spotify now 404s editorial/algorithmic playlists via the API —
this works on user-owned and public user playlists (verified against the
account's own playlists).

### Explicitly out of scope for Rev-1

- Non-Spotify / manual albums (review + context + external search links,
  no playback) — parked; revisit later.

**AC:** shuffle never leaks into an album listen; the album-view Like
button matches Spotify's real state within a poll; `L`/`B` work on the
album page; opening the app lands on the Backlog with the bottom player
bar present; the album page shows sourced context incl. Discogs credits;
a friend's playlist link can seed the backlog.

---

## Phase 9 — Self-hosting / distribution

Status: **proposal** (scoped 2026-08-28)

Goal: ship the app the way Sonarr / Radarr ship — one container per person,
a `/config` volume, all setup done in the UI, "pull the image to update."
Each self-hoster brings their own Spotify app + Discogs key; no shared
backend, no multi-tenancy.

### Design decisions (settle before building)

- **Config lives in the volume, not `.env`.** Secrets and app settings
  move into a mutable file under `/config`; env vars stay as an override
  (compose-file users). `env.ts`'s boot-time `spotifyConfigured` /
  `discogsConfigured` become runtime reads.
- **The Spotify OAuth redirect URI is the one hard edge** (no Sonarr
  equivalent). Spotify allows plain `http` only for `127.0.0.1`; any other
  host needs HTTPS. So there are two documented tiers:
  - *Local only* — browse from the same box, redirect
    `http://127.0.0.1:8888/callback`, no TLS.
  - *Remote* — real domain + reverse proxy (Caddy / Cloudflare Tunnel /
    Traefik), that URL registered in the Spotify dashboard.
  The Settings UI shows the exact redirect URI to paste, plus connection
  status.
- **Auth → PKCE.** Drop the client secret entirely so provisioning is
  just a client ID. (Authorization Code + PKCE; Spotify supports it for
  the Web API.)
- **Updates = pull, not in-app.** No in-container self-updater (Sonarr
  disables its own under Docker). Semver tags on GHCR + a "new version"
  banner that checks the GitHub releases API + docs for
  `docker compose pull && up -d` / Watchtower.

### 9.1 Runtime config store
- [ ] `store/appConfig.ts` — read/write `/config/app.json`
      (`spotifyClientId`, `apiKey`, `uiAuth`, `discogsKey/Secret`,
      `publicUrl`); env vars override file values; defaults on first run
- [ ] rework `env.ts` → split process-level (`PORT`, `HOST`, `CONFIG_DIR`)
      from app config; `auth/oauth.ts` + `context/discogs.ts` read the
      store, not `env`
- [ ] `GET/PUT /api/settings/app` (secrets write-only: browser gets
      `{ spotifyClientId, discogsConfigured, redirectUri, … }`, never the
      secret back)

### 9.2 API key + optional UI auth
- [ ] generate `apiKey` on first run; `preHandler` on `/api/*` requires
      `X-Api-Key` (or `?apikey=`); SPA fetches it from a bootstrap route
      after UI auth
- [ ] optional forms auth for the UI (username + argon2/bcrypt hash in
      `app.json`); login page; signed session cookie; `/callback` and
      health stay open
- [ ] "regenerate API key" + auth toggle in Settings

### 9.3 Paths / volume restructure
- [ ] all mutable state under one `CONFIG_DIR` (`/config` in the image):
      `config/`, `reviews/`, `cache/`, `.auth.json`, `app.json`
- [ ] first-run seeding: empty volume → write default `config/*.json` +
      `review-template.md` (currently seeded from the repo's `data/`)
- [ ] `paths.ts` keyed off `CONFIG_DIR` env (default `./data` in dev)

### 9.4 Auth → PKCE
- [ ] `auth/oauth.ts` — code_verifier/challenge, no `client_secret`;
      token exchange + refresh via PKCE
- [ ] drop `SPOTIFY_CLIENT_SECRET` from everywhere; docs + `.env.example`

### 9.5 Container
- [ ] multi-stage `Dockerfile` — build web, compile server with `tsc`
      (drop `tsx` + dev deps from the runtime image), non-root user,
      `tini`, `HEALTHCHECK` → `/api/health`, `EXPOSE 8888`, `VOLUME /config`
- [ ] `HOST=0.0.0.0` supported (already configurable) + documented
- [ ] `docker-compose.yml` (image, `./config:/config`, port, env)
- [ ] `.dockerignore`

### 9.6 Settings UI
- [ ] Settings sections: **Spotify** (client ID, redirect-URI display +
      copy, connect/disconnect, status), **Discogs** (consumer key/secret,
      masked), **Security** (API key, UI auth), **About / Updates**
      (version, latest, changelog link)
- [ ] first-run wizard: if `spotifyClientId` unset → land on Settings
      with a short "getting started" panel

### 9.7 Release + update check
- [ ] `GET /api/version` → `{ current, latest?, updateAvailable }`
      (latest cached from `api.github.com/repos/<repo>/releases/latest`,
      ~6 h TTL); banner in `Layout`
- [ ] GH Actions: on `v*` tag → `docker buildx` amd64 + arm64 → push
      `ghcr.io/<repo>:{version,latest}`; attach a changelog to the release

### 9.8 Docs
- [ ] `README.md` rewrite — self-hosting quick start (compose snippet)
- [ ] `docs/self-hosting.md` — Spotify app walkthrough (screenshots),
      Discogs key, the two redirect-URI tiers, reverse-proxy examples
      (Caddy / Cloudflare Tunnel / Traefik / nginx), volume backup,
      updating
- [ ] **(you)** create the GitHub release / tag workflow secrets
      (`GHCR` uses `GITHUB_TOKEN`, nothing to provision) and enable
      packages

**AC:** `docker compose up` on a clean host → open the UI → (optional)
set a UI password → paste a Spotify client ID → see the redirect URI to
register → connect → the full app works with `/config` as the only
persistent state; `/api/*` rejects calls without the key; a new tagged
release produces a multi-arch image and the running app shows an
"update available" banner.

### Not in Phase 9
- Multi-user / accounts / hosted signup (needs Spotify Extended Quota
  Mode — a separate decision, likely never for a hobby project).
- Auto-updating the container from inside itself.

---

## Dependency graph

```
0 ─▶ 1 ─▶ 2 ─▶ 3 ─▶ 7
          └──▶ 4 ─▶ 5 ─▶ 6 ─▶ 7 ─▶ 8
                                   └──▶ 9
```

Phases 3 and 4 both only need Phase 2; everything funnels into 7. Phase 8
(Revision 1) builds on the finished MVP1 loop; its four Rev batches are
independent of each other and can land in any order (Rev-1 first is
easiest). Phase 9 (self-hosting) needs the config/auth refactor (9.1–9.4)
before the container work (9.5+) is worthwhile.

## Not in this plan (later MVPs)

MVP2 — multi-button system + custom command buttons + button CRUD.
MVP3+ — FR-6b revisit-with-review-alongside, history/archive filters,
export, audio-feature charts, Stream Deck / MIDI bridge.
Parked — non-Spotify / manual albums: review + external context + YouTube
Music / Bandcamp search links, no playback. Deferred out of Phase 8 Rev-1.
