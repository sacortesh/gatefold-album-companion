# Gatefold — Implementation Plan

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

### Responsive layout (assessed 2026-08-28, fixed 2026-09-04)
- [x] nav bar: 4 items + status dot overflow the header below ~360 px —
      let it wrap, or collapse to a compact/menu form on narrow screens.
      Fixed: `<nav>` in `Layout.tsx` claims a full row below `sm:`
      (`basis-full sm:basis-auto sm:flex-1`) instead of competing with the
      wordmark for whatever space is left, so it wraps 2 items/line instead
      of collapsing to 1.
- [x] backlog cards: cover + ▲▼ + "Play album" + "Remove" are all
      fixed-width `shrink-0` (~260 px) → the row breaks on a phone;
      restack the controls / move secondary actions into a menu.
      Fixed: `Card` in `BacklogPage.tsx` restructured to
      `flex-col ... sm:flex-row` — info block (cover+text) always stays
      horizontal; the reorder-arrows + action buttons wrap to their own row
      below on narrow screens instead of squeezing the title/artist text to
      zero width. Same pattern applied to `Row` in `RevisitPage.tsx`, which
      had the same bug (Open button overlapping a genre chip).
- [x] album tracklist: "play from here" ▶ is `group-hover` only →
      invisible on touch; give every row a real tap target.
      Fixed: `TrackRow` in `AlbumPage.tsx` now also shows the Play icon
      under `[@media(pointer:coarse)]:block` (Tailwind arbitrary variant —
      `pointer-coarse:`/`pointer-fine:` aren't core Tailwind 3.4 variants,
      confirmed by testing the JIT output), so touch devices get the icon
      by default instead of relying on a hover state they don't have.
- [x] audit remaining rows (recent, revisit, device picker) at 360 px for
      horizontal overflow — the page body must never scroll sideways.
      Verified live at ~450 px effective width (the narrowest this
      environment's `resize_window` reliably produced): Backlog, Recent,
      Revisit, Reviews, Settings, and an Album page (hero + tracklist +
      lyrics) all confirmed `scrollWidth === clientWidth`, no overlap.
      RecentPage's row was already fine as built — no fix needed there.

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

### 9.1 Runtime config store  ✅ done (2026-08-28)
- [x] `store/appConfig.ts` — read/write `data/app.json`
      (`spotifyClientId`, `discogsConsumerKey/Secret`, `publicUrl`);
      matching env vars override the file and lock the UI field;
      `redirectUri` + `webOrigin` derived; in-memory cache
- [x] `env.ts` trimmed to process-level (`PORT`, `HOST`, `NODE_ENV`,
      `WEB_ORIGIN`) + optional overrides; `spotifyConfigured` /
      `discogsConfigured` moved to `appConfig` (now async);
      `context/discogs.ts` takes creds as an arg from `context/index.ts`
- [x] `GET/PUT /api/settings/app` (`routes/settings.ts`) — response is
      secret-free (`spotifyClientId`, `publicUrl`, `redirectUri`,
      `discogsConfigured`, `envLocked`); PUT ignores env-locked fields
- [x] `data/app.json` gitignored; `SpotifySetup` card in Settings —
      client-ID field, redirect-URI display + copy, public-URL field
- [x] `apiKey` / `uiAuth` fields in `app.json` — done in 9.2

### 9.2 API key + optional UI auth  ✅ done (2026-08-29)
- [x] generate `apiKey` on first run (`appConfig.ts`); `preHandler` on
      `/api/*` requires `X-Api-Key` (or `?apikey=`) via `auth/apiKeyGuard.ts`,
      registered as a hook on a second `/api` encapsulation so
      `/api/health` stays open; SPA fetches the key from `GET /auth/session`
      (open, outside `/api`) after UI auth and sends it back on every call
- [x] optional forms auth for the UI (username + scrypt hash — `node:crypto`,
      no native-build dependency — in `app.json` via `auth/password.ts`);
      `LoginGate` renders a login form when enabled and unauthenticated;
      `POST /auth/ui-login`/`ui-logout` set/clear an `@fastify/cookie`
      signed session cookie; the cookie value is `sessionEpoch`, bumped on
      every UI-auth change or logout to invalidate outstanding sessions;
      `/callback` and `/api/health` stay open
- [x] "regenerate API key" + auth toggle + username/password form in
      Settings → Security (`SecuritySettings.tsx`)

### 9.3 Paths / volume restructure  ✅ done (2026-08-30)
- [x] `paths.ts` — `DATA_DIR` now reads `process.env.CONFIG_DIR`, default
      `./data` in dev; dotenv loading moved into `paths.ts` (was `env.ts`)
      so a `.env`-file `CONFIG_DIR` is picked up too, not just a real env
      var — `env.ts` imports `paths.js` for the side effect and no longer
      loads dotenv itself
- [x] all mutable state under one root (`/config` in the image): `config/`,
      `reviews/`, `cache/`, `.auth.json`, `app.json` — unchanged sub-layout,
      just re-rooted off `DATA_DIR`
- [x] no explicit "first-run seeding" needed — every config file already
      falls back to schema defaults when absent (`readConfig`), reviews
      list empty-safe (`readAllReviews`), review template has a hardcoded
      fallback (`DEFAULT_REVIEW_TEMPLATE`), app.json self-heals
      (`apiKey`/`cookieSecret` generated on first read). The only real
      gaps were two missing `mkdir` calls on the *write* paths —
      `store/config.ts#writeConfig` and `auth/tokenStore.ts#writeStored`
      would 500 on a truly empty volume before any read had happened to
      create the directory first. Both fixed.
- [x] verified against a volume that didn't exist at all (not even an
      empty dir): boots, `GET`/`PUT` on every config name, `/api/reviews`,
      `/api/review-template` all work and self-create their directories
- [x] `.env.example` documents `CONFIG_DIR`; stale "no API auth yet"
      comment on `HOST=0.0.0.0` corrected (9.2 added the API key)

### 9.4 Auth → PKCE  ✅ done (2026-08-28)
- [x] `auth/oauth.ts` — `code_verifier`/`code_challenge` (S256), no
      `client_secret`; `client_id` in the token bodies; verifier stored
      alongside the CSRF `state` (`issueAuthState` / `consumeAuthState`)
- [x] `SPOTIFY_CLIENT_SECRET` removed from `env.ts`, `.env`, `.env.example`;
      `AuthStatus` gained `redirectUri`
- Note: existing connections made under the old confidential flow won't
      refresh under PKCE — one reconnect click fixes it.

### 9.5 Container  ✅ done (2026-08-30)
- [x] multi-stage `Dockerfile` — `npm run build` for `shared`/`server`/`web`
      in the build stage; `shared`'s package.json is patched *inside the
      image only* (`main`/`types` → `dist/`, `exports` dropped) so the
      compiled server can resolve it under plain `node` — the committed
      package.json still points at `.ts` source, tsx/Vite dev is untouched;
      `npm prune --omit=dev` drops tsx/vite/typescript/etc. from the final
      layer; `tini` + `HEALTHCHECK` → `/api/health` (open, no API key
      needed) → `EXPOSE 8888`, `VOLUME /config`
- [x] non-root: `docker-entrypoint.sh` runs as root just long enough to
      `chown -R node:node /config` (a bind-mounted host dir doesn't inherit
      the image's build-time chown — this bit a first pass, caught by
      actually running the container, not just reading the Dockerfile),
      then `su-exec node` before exec'ing the app. Verified the real app
      process runs as uid 1000, not root.
- [x] `HOST=0.0.0.0` baked into the image as the container default
      (documented in `.env.example`); `CONFIG_DIR=/config` likewise
- [x] `docker-compose.yml` — verified for real: `docker compose up -d`,
      config round-trips, healthcheck reports `healthy`, config survives a
      `docker restart`
- [x] `.dockerignore`
- Built and ran the actual image locally (not just written/reviewed) to
      verify all of the above — caught the bind-mount ownership bug this
      way; would have shipped broken otherwise.

### 9.6 Settings UI
- [x] **Spotify** section — client ID, redirect-URI display + copy,
      connect/disconnect, status (`SpotifySetup.tsx`)
- [x] **Discogs** section — consumer key/secret, masked, "configured"
      status (`DiscogsSetup.tsx`, 2026-08-30)
- [x] **Security** section — API key copy/regenerate, UI auth toggle +
      username/password (`SecuritySettings.tsx`, 2026-08-29)
- [x] **About / Updates** section (version, latest, changelog link) —
      `AboutSettings.tsx`, built alongside 9.7's `/api/version`
- [ ] first-run wizard: if `spotifyClientId` unset → land on Settings
      with a short "getting started" panel

### 9.7 Release + update check  ✅ done (2026-09-03)
- [x] `GET /api/version` → `{ current, latest, updateAvailable, releaseUrl }`
      (`server/src/version.ts`, cached via `makeCache("meta")` ~6 h TTL incl.
      a failed/rate-limited GitHub lookup, so it isn't retried every
      request); `current` still reads root `package.json` like `/api/health`
      does. `AboutSettings.tsx` shows it in Settings; `UpdateBanner` in
      `Layout.tsx` links to Settings when `updateAvailable` is true.
- [x] `.github/workflows/release.yml` — on a `v*.*.*` tag: `docker buildx`
      amd64 + arm64 → push `ghcr.io/<repo>:{version,latest}`; `gh release
      create --generate-notes` for the changelog. Not yet run against a
      real tag (needs a version bump + tag push to verify end to end).

### 9.8 Docs  ✅ mostly done (2026-09-03)
- [x] `README.md` rewrite — self-hosting quick start (compose snippet),
      links to `docs/self-hosting.md`; also fixed a stale dev-setup step
      still asking for `SPOTIFY_CLIENT_SECRET` (removed in 9.4's PKCE move)
- [x] `docs/self-hosting.md` — Spotify app walkthrough (text steps, not
      screenshots — no way to capture real dashboard screenshots from
      here), Discogs key, the two redirect-URI tiers, reverse-proxy
      examples (Caddy / Cloudflare Tunnel / Traefik / nginx), backup,
      updating, a troubleshooting section
- [ ] **(you)** create the GitHub release / tag workflow secrets
      (`GHCR` uses `GITHUB_TOKEN`, nothing to provision) and enable
      packages

Also fixed while here: the repo was renamed to `gatefold-album-companion`
at some point but `package.json`'s `repository` field, `version.ts`'s
GitHub-releases lookup (9.7), and `context/http.ts`'s User-Agent still
said the old `sacortesh/album-companion` — the version-check would have
silently queried a repo that doesn't exist. All three now match the real
remote.

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

## Phase 10 — Field-trial hardening + Revision 2 (from the first real self-host)

Source: 2026-09-04, after the first real Docker install (not dev) and the
audit issues it produced on the repo (#1–#9). Spec only — not implemented
yet. Runs as its own track, same as Phase 8; nothing here blocks Phase 7.

### 10.1 — Triage of field-trial issues #1–#9 before the next tag

The self-host install ("this is the image, install it") struggled mainly
because of **#8**, not because a compose file was missing (`docker-compose.yml`
already ships as of this same day). #8 is the one that actively lies to the
user: it makes a *successful* Connect Spotify look like a failure.

| # | Title | Recommendation |
|---|---|---|
| 8 | Post-OAuth redirect goes to `127.0.0.1:5173` when `PUBLIC_URL` unset | ✅ **Done (2026-09-04).** `settingsUrl` in `auth.ts` now redirects relative in production when `publicUrl` is unset (absolute to `publicUrl` when it is set); `WEB_ORIGIN`'s `:5173` default only applies outside production, preserving the dev flow. Verified against the real built image: `curl .../callback?error=access_denied` → `location: /settings?auth=denied`, not `:5173`. |
| 6 | Prod web bundle ships a `.js.map` publicly | ✅ **Done (2026-09-04).** `vite.config.ts` `build.sourcemap: false`. Verified: `packages/web/dist` has zero `.map` files, in the local build and inside the built image. |
| 5 | No `SIGTERM` handler, exits 143 | ✅ **Done (2026-09-04).** `index.ts` closes Fastify on `SIGTERM`/`SIGINT` and exits 0. Verified against the built image: `docker kill --signal=TERM` → `docker wait` → exit `0`, with a "shutting down" log line. |
| 4 | Container fails under `--user` / `runAsUser` | ✅ **Done (2026-09-04).** `docker-entrypoint.sh` now branches on `id -u`: root does the chown + `su-exec` drop as before, already-unprivileged just `exec`s. Verified: `docker run --user 1000:1000 gatefold ... node -e '...'` starts and runs. |
| 2 | Base image OpenSSL 2 HIGH CVEs | ✅ **Done (2026-09-04).** `RUN apk upgrade --no-cache` added to the runtime stage. Verified: `libssl3`/`libcrypto3` now `3.5.8-r0` in the built image (was `3.5.7-r0`). |
| 1 | Bundled npm/yarn → 1 CRITICAL + 10 HIGH CVEs | Not done this pass. Not reachable at runtime, but it's the finding most likely to make someone bounce off the project before reading far enough to learn that. `npm prune --omit=dev` already runs (Dockerfile) — this needs an explicit `rm -rf` of the global npm/yarn install, not the workspace's own deps. |
| 3 | No OCI labels / SBOM on the image | Not done this pass — nice-to-have, not blocking. Belongs in the release workflow (`docker/metadata-action`), not the Dockerfile itself, since that's already the multi-arch build step. |
| 7 | Grab-bag: unconditional `chown -R`, dupe entrypoint script, `package.json main` pointing at unshipped `src/`, `@types/node` in runtime `node_modules`, `VOLUME /config` | **Partially done (2026-09-04).** Landed alongside #4/#2 since they're the same files: the unconditional `chown -R` is now `find /config \! -user node -exec chown ...` (only touches what needs it), and the base image's dead `/usr/local/bin/docker-entrypoint.sh` is removed. **Deliberately left alone:** `package.json` `main`/`start` — fixing it properly means also changing the root `build` script to build the server package, and risks breaking the documented local `npm run build && npm start` flow (which currently runs the server via `tsx` from source, not `dist/`); needs its own pass, not a drive-by. `VOLUME /config` — removing it trades "anonymous-volume clutter for `docker run` users who forget `-v`" for "silent data loss for that same group on `docker rm`" — net negative, not obviously worth it. `@types/node` in runtime `node_modules` — not re-checked this pass. |
| 9 | Document the LAN / no-public-domain path | Not done this pass — still worth doing, docs-only, no code risk, doesn't need to wait for a tag. The key fact (Spotify token is server-side and single-user; only the *one-time* Connect needs loopback/HTTPS, everyone else just hits `http://<host>:8888` forever) isn't stated anywhere today. Add as a third tier in `docs/self-hosting.md` alongside Local-only / Remote, per the issue's own writeup. |

**Why this framing:** issues #1–#8 all came out of *auditing* the exact
image the user just fought with, and #8 in particular explains the "quite a
trial" first-hand — Spotify login silently "worked" while the browser sat on
a connection-refused error. Fixing #8 + writing #9 addresses the actual
reported pain; the rest is opportunistic hardening while the image is
already being touched for #8.

**AC:** `docker run --user 1000:1000 ...` starts ✅; `docker kill --signal=TERM`
exits 0 ✅; a fresh `docker compose up -d` → Connect Spotify → browser lands
back on `/settings?auth=connected` on the *same* host:port, not `:5173` ✅
(verified via the `?error=` path against the real built image — the full
OAuth round-trip itself needs a real Spotify account to exercise end to end);
`docs/self-hosting.md` has a LAN-only tier — **not done** (issue #9, still
open); a Trivy scan shows 0 CRITICAL/HIGH — **not yet**: the OS-package CVEs
(#2) are fixed, but the bundled npm/yarn CVEs (#1) are still in the image,
so a full scan isn't clean yet.

### 10.2 — Instructions for agents

- [x] `INSTRUCTIONS_FOR_AGENTS.md` — task-oriented quickstart for a script
      or AI agent calling the API directly (auth header, error shape, a
      task→endpoint table, the `no_device` precondition on playback, config
      write shapes, rate-limit etiquette). Points at `/docs` (the real
      OpenAPI contract, already shipped per 2026-09-04's notes) rather than
      duplicating every field; linked from `README.md`.

### 10.3 — Navigation: album access shouldn't depend on noticing a link

Current state (audited against `web/src/{components,features}`): the
*only* way to reach `/album/:id` from most list views is clicking the cover
thumbnail or the title text — which reads as "here's the album name," not
as a navigation affordance, on rows that otherwise have real `<button>`
CTAs (Play, Remove) sitting right next to it. `RevisitPage` and
`ReviewsPage` already do this right (explicit "Open" button next to "Play")
— that's the pattern to copy everywhere else, not a new pattern to invent.

- [x] `BacklogPage.tsx` `Card` — add an explicit "View" button/link next to
      Play/Remove, same visual weight as those two.
- [x] `RecentPage.tsx` `Row` — **currently has no album link at all**, not
      even an implicit one (confirmed: no `<Link>` in the row). Add one —
      thumbnail and/or an explicit affordance to `/album/:id`. This is the
      "no CTA to go to the album that record belongs to" gap. Required adding
      `albumId` to the shared `TrackRef`/`recentRowSchema` DTO (previously
      only `albumName`, a string with no id to link to) and populating it
      server-side (`spotify/recent.ts`, `routes/triage.ts`).
- [x] `NowPlayingCard.tsx` (the sticky bottom bar) — already links the art
      and the album-name text to `/album/:id`; make it an explicit,
      obviously-clickable affordance (not just underline-on-hover text)
      since this bar is visible on every page while something plays and is
      the highest-frequency place someone would want to jump to the album.
      Landed as a hover overlay (dim + an open-external icon) on the art
      thumbnail rather than restyling the text link — keeps the meta line's
      density low per the theme's density-6 dial.

Same underlying fix in three places — worth doing as one pass since it's
the same affordance pattern each time.

### 10.4 — Merge "Now Playing" and "Recent"

`NowPlayingPage.tsx` already renders `<RecentPage />` inline below its hero
(added in Phase 8 Rev-2) — the two nav items are already ~90% the same
screen today, just reachable from two different tabs, which is exactly the
"makes no sense" complaint.

- [x] Collapse `navItems` in `Layout.tsx` to one entry (keep the `/recent`
      path since that's the more durable name for "what am I listening to
      / what did I just play"; redirect `/now-playing` → `/recent` rather
      than 404ing old links/bookmarks).
- [x] `NowPlayingPage.tsx` becomes the sole component behind that route (it
      already is the superset — hero transport when something's active,
      `RecentPage`'s list below); delete `RecentPage`'s standalone route,
      keep the component for embedding.

### 10.5 — Add-to-backlog from the album page: verify, don't rebuild

`AlbumPage.tsx` already has this (`a.inBacklog ? "Remove from backlog" :
"Add to backlog"`, wired to `useBacklog().add`/`.remove` — landed in Phase 8
Rev-2). **No new work** — just confirm it still works in a real browser
pass, since Phase 7's browser-verification pass never happened. Listed here
only so it isn't re-speced as new work by a future pass over this list.

### 10.6 — Surface genre in list views (Backlog / Revisit / Reviews)

The album page already shows genre (`AlbumDetail.genres`, Spotify's own
tags) but list rows use the lighter `AlbumSummary` DTO, which has none.

- Caveat worth designing around: Spotify's own per-album `genres` array is
  frequently empty in practice (Spotify mostly tags *artists*, not albums).
  The richer source is the context pipeline (`server/src/context/` —
  MusicBrainz + Discogs, already merged into `AlbumContext.facts.genres`
  and cached 30 days per album).
- [x] Add `genres: string[]` to `albumSummarySchema` (`shared/src/dto.ts`),
      populated **only from what's already cached** in the context store —
      don't trigger a fresh MusicBrainz/Discogs lookup just to render a
      list row (that's N network calls for one page load). If nothing's
      cached yet for an album, show no genre chip rather than blocking or
      fetching. Landed as `context/index.ts`'s `getCachedGenres()` — a pure
      cache peek (`cache.get`, no fetch), shared by `backlog.ts`'s `enrich()`
      and `verdict.ts`'s `/revisit` and `/reviews` handlers. Reviews don't
      carry an `AlbumSummary` at all (persisted as flat `artist`/`album`
      strings), so genres land there via a new `ReviewListItem` response
      type instead of touching the stored review-file schema.
- [x] `BacklogPage.tsx` `Card`, `RevisitPage.tsx` `Row`, `ReviewsPage.tsx`
      `Row` — render the genre chip(s) when present, same treatment as the
      existing meta line (year · tracks · duration). Landed as a shared
      `GenreChips` molecule (`Badge` atom, capped at 3 + a `+N` overflow —
      Miller's Law, so one heavily-tagged album doesn't blow out a row's
      height against its neighbors), used identically across all three.

### 10.7 — Album page background art

- [x] `AlbumPage.tsx` header — use the same `a.image` already fetched and
      rendered as the small cover (no new API dependency) as a blurred/
      dimmed full-bleed background behind the header block, à la Spotify's
      own web player. Note for the record: this does **not** need Discogs —
      the earlier assumption that it did was wrong; the cover art is
      already coming from Spotify's own album response. Landed as the
      `AlbumHero` organism during the visual redesign (`blur-2xl`, full-bleed,
      `aria-hidden` decorative background) — checkbox was never ticked here
      even though the work shipped under a different tracking doc (`DESIGN.md`).

### 10.8 — Device picker when playback has nowhere to go

The server already has the right shape for this: `playback.ts`'s
`playWithFallback` returns `409 { code: "no_device", message }` when
nothing is active and no `preferredDeviceId` is set. `ApiRequestError`
already carries `.code` (`web/src/api/client.ts`). Today every call site
that can trigger this (`AlbumPage`'s `playAlbum`/`playFrom`,
`useBacklog().playAlbum`, `RevisitPage`/`ReviewsPage`'s inline `play`
mutation) just renders `.message` as a line of red text — a dead end for
the user, who then has to know to go find Settings → Playback device
themselves.

- [x] Extract `DevicePicker`'s list (`features/settings/DevicePicker.tsx`)
      into something embeddable in a modal, not just the Settings page
      section. Landed as a shared `useDevices` hook + `DeviceList`
      presentational component (`features/settings/`), used by both the
      Settings page section and the new modal.
- [x] On any play mutation's `onError`, check
      `err instanceof ApiRequestError && err.code === "no_device"` and open
      that modal instead of (or in addition to) the text error. Picking a
      device there should transfer playback to it (existing
      `POST /api/playback/transfer`) and immediately retry the original
      play call. Landed as a `DevicePickerPromptProvider` context
      (`features/playback/DevicePickerPrompt.tsx`) mounted once in
      `Layout.tsx`; each call site's `onError` reads `variables` off the
      mutation to retry with the exact original args. Verified live against
      real Spotify devices (a 409 → transfer → retry → correct album playing).
- [x] Apply at all three call sites (Backlog, Album page, Revisit/Reviews)
      plus the ambient bottom bar's toggle/skip controls, which hit the
      same 409 path.
- [x] Added (2026-09-04): a "Play on this device →" deep link in the
      modal's empty-device state, using the `spotify:...` URI already
      computed for the failed play call (`spotify:album:...`/
      `spotify:track:...`) as an `<a href>` — the same protocol-handler
      trick Spotify's own embed widgets use to hand off to the native app
      (phone or desktop) instead of just telling the user to go find it.
      `requestDevice(retry, contextUri?)` threads that URI from each of
      the 5 call sites through `DevicePickerPromptProvider` into
      `DeviceList`'s new `deepLinkUri` prop; only rendered when known
      (only the modal has it — the Settings page's static `DevicePicker`
      section doesn't call `requestDevice`, so it's unaffected). Once the
      app launches and registers as a Connect device, the existing 10s
      device-list poll (`useDevices`) picks it up without a manual
      refresh — no new polling logic needed.

### 10.9 — Settings: link out to `/docs`

- [x] `AboutSettings.tsx` (or a new line in the Spotify section) — a link to
      `/docs` on the running instance (relative link, no config needed —
      it's the same origin). Small, but it's the discoverability half of
      `INSTRUCTIONS_FOR_AGENTS.md` / the OpenAPI work already shipped.
      Real bug found live: worked in production (one Fastify process serves
      everything) but silently served the SPA shell instead of Swagger UI
      under `npm run dev`, since Vite's dev proxy only forwarded `/api`,
      `/auth`, `/callback` — not `/docs`. Fixed in `vite.config.ts`.

### 10.10 — Hide the API key without a `type="password"` input

`SecuritySettings.tsx`'s `CopyField` renders the live API key in a plain
`readOnly` text input, always fully visible. The Discogs consumer key/secret
fields (`DiscogsSetup.tsx`) already show the *right* pattern for secrets in
this app — but that one works by never echoing the value back at all
(write-only fields). The API key is different: the UI legitimately needs to
*display* it (for copy/paste into a script), just not by default.

- [x] Add a show/hide toggle to the API-key `CopyField` that swaps the
      *displayed* string for a fixed-width mask (e.g. `••••••••`) client-side
      — the real value stays in the input's `value` for copy, it's just not
      rendered. Keep `type="text"` throughout; **do not** switch to
      `type="password"`, which is exactly what triggers the browser
      credential-manager prompts this request is trying to avoid. Landed as
      a side effect of the redesign's `CopyField` molecule (`masked` prop) —
      checkbox was never ticked here even though the work shipped.

### 10.11 — Encyclopaedia Metallum + Rate Your Music + Last.fm links — done

Neither Metal Archives nor RYM exposes a usable public lookup API with
stable ids we already have (unlike MusicBrainz/Discogs). Realistic scope: a
**search link**, not a deep link — `https://www.metal-archives.com/search?searchString=<artist>` /
RYM's search URL, URL-encoded from the album's artist + name. Good enough to
land a human one click from the right release page; anything deeper would
need scraping either site, which is out of scope. Feeds into 10.12 below as
one of the default link templates rather than a special case.

**Last.fm** is a genuine deep link, not a search fallback like the two
above — Last.fm album pages sit at a predictable
`https://www.last.fm/music/{artist}/{album}` path (spaces → underscores,
rest URL-encoded), so a correctly-templated URL lands directly on the
release page rather than a search results list. **Verify the exact path
encoding against the live site when implementing** — not confirmed in this
session, same discipline as the Song Meanings addendum below; don't
guess-and-ship a URL pattern that 404s on real artist/album names with
punctuation or non-Latin characters.

All three verified live via real browser navigation (not curl — Metal
Archives and RYM both sit behind a Cloudflare bot challenge that blocks
curl/WebFetch outright) against "Opeth" / "Blackwater Park":
`metal-archives.com/search?searchString={artist}&type=band_name` — an
exact-match search auto-redirects straight to the band's own page;
`rateyourmusic.com/search?searchterm={artist}+{album}&searchtype=l` —
`searchtype=l` (release) puts the right album at the top of real results;
`last.fm/music/{artist}/{album}` — confirmed a real release gives `200`
(spaces as `+`) while a fabricated album name reliably `404`s, so the
pattern is trustworthy, not just coincidentally working once.

### 10.12 — Settings: customize "About this album" links + a lyrics-search fallback — done

Today `AlbumContext.links` is entirely server-computed (whatever
MusicBrainz/Wikipedia/Discogs handed back) — nothing user-configurable, and
no way to add fixed external links like 10.11's or a "search for lyrics
elsewhere" fallback when `AlbumLyricsResponse` comes back empty for a track.

- [x] New config: `data/config/links.json` (extend `configSchemas` in
      `shared/src/config.ts` with a `links` entry). Shape: an ordered list
      of `{ id, label, enabled, urlTemplate }`, where `urlTemplate` supports
      `{artist}` / `{album}` placeholders (URL-encoded on substitution) —
      e.g. `https://rateyourmusic.com/search?searchterm={artist}+{album}`.
      Ship sensible defaults (RYM, Metal Archives, Last.fm, a Genius lyrics
      search) pre-populated but toggleable off, rather than starting empty.
  - `GET /api/album/:id/context` merges enabled templated links (rendered
    with the album's real artist/name) alongside the existing
    provider-derived ones in the response — client stays a dumb renderer of
    `AlbumContext.links`, no new client-side templating logic needed.
    Deliberately rendered in the route handler, *after* the 30-day context
    cache read, not folded into the cached blob — user edits in Settings
    would otherwise sit stale for up to 30 days, the same class of bug
    already hit twice in 10.14. Learned that lesson forward this time
    instead of patching it after the fact.
- [x] A second template class for **track-level** lyrics fallback (needs
      `{artist}`/`{track}`, e.g. a Genius search) — surfaced in
      `LyricsPanel.tsx` only when the current track's `TrackLyrics` has both
      `synced: null` and `plain: null`. Also covers the case where there's
      no `TrackLyrics` entry for the track at all (`undefined`), not just
      one with both fields explicitly null — same dead end from the user's
      point of view, same escape hatch. Excludes instrumental tracks
      (a lyrics search makes no sense there), handled naturally since that
      branch returns earlier.
- [x] Settings UI: a new section (e.g. under `AboutSettings.tsx` or its own
      `LinksSettings.tsx`) listing the configured templates with
      enable/disable toggles and editable label/URL-template fields, same
      form patterns as the rest of Settings. Mirrors `DiscogsSetup.tsx`'s
      local-draft-plus-dirty-flag-plus-one-Save-button pattern exactly.

Real bug found and fixed along the way: the first build of this pulled
`zod` (131KB) and the shared package's entire runtime schema graph into the
client bundle (+65KB gzipped, tripped the 500KB chunk-size warning) —
`LyricsPanel.tsx`'s `renderLinkTemplate` import was the first-ever *runtime*
(non-`type`) import from `@gatefold/shared` in the client, and without a
`sideEffects: false` in that package's `package.json`, Rollup couldn't prove
the rest of the barrel (`dto.ts`/`config.ts`/`review.ts`, all top-level
`z.object(...)` calls) was safe to drop. Added `"sideEffects": false`;
bundle landed at +2.87KB, proportional to what was actually added.

### 10.13 — Playlist import: dedupe against Revisit and past Reviews, not just the backlog

`GET /api/playlist/:id/albums` (`backlog.ts`) only checks the album against
`readConfig("backlog")` today — an album already **reviewed** (any verdict)
or currently sitting in the **Revisit** queue gets offered again as if
brand new, defeating the point: the user already made a call on it.

- [x] In that route, also load `readConfig("revisit")` and
      `readAllReviews()` (`store/reviews.ts` — already backs `GET
      /api/reviews`) alongside the existing backlog read, and compute a
      richer per-album status instead of a bare `inBacklog` boolean —
      e.g. `status: "new" | "in_backlog" | "in_revisit" | "reviewed"` plus
      (when `reviewed`) the verdict, so the UI can show *why* it's excluded
      ("passed" reads very differently from "kept" or "in backlog already").
      Priority when an album qualifies for more than one bucket (e.g. a
      "revisit" verdict also sits in the revisit queue): `reviewed` wins,
      since the verdict itself is the most informative reason.
- [x] `playlistAlbumSchema` (`shared/src/dto.ts`) — replace/extend
      `inBacklog: boolean` with the richer status; keep it additive if
      anything else consumes the old field. Nothing else did, so replaced
      cleanly rather than carrying both fields.
- [x] `PlaylistImport.tsx` — treat every non-`"new"` status the same way
      `inBacklog` is treated today (excluded from selection, dimmed row),
      but show the specific reason in the trailing label instead of always
      "in backlog." Verified live against a real playlist: "kept" and
      "marked revisit" render correctly alongside "in backlog."

### 10.14 — Album image gallery: back cover, liner notes, insert scans

Right now the app only ever shows one image per album (Spotify's front
cover, `AlbumDetail.image`). Discogs and the Cover Art Archive (see below)
both carry more — back cover, liner/booklet scans, disc art, sometimes a
full insert — which is exactly the "unfold the gatefold" material the app's
own name gestures at, and neither is wired in today.

Two complementary sources, both already reachable from existing code:

- **Discogs** — the release object `context/discogs.ts` already fetches
  (for credits/notes) carries an `images[]` array in the same response —
  no extra HTTP call, just an unused field. Caveat: Discogs only reliably
  distinguishes `primary` (front) vs `secondary` (everything else); it does
  **not** reliably label back-cover vs. insert vs. promo photo within
  `secondary` — same ambiguity Discogs' own web UI has (the screenshot's
  "More images" link is an undifferentiated grid, not individually
  captioned either). Don't invent categories the source data doesn't
  support — surface `secondary` images as an unlabeled "more images" set,
  matching Discogs' own presentation, rather than guessing at back/insert.
- **Cover Art Archive** (`coverartarchive.org` — from the question above) —
  *does* type its images reliably (`Front`/`Back`/`Booklet`/`Tray`/`Medium`/
  `Liner`/`Spine`/`Other`). `context/musicbrainz.ts` already resolves a
  release-group MBID for the facts panel; reuse it against
  `GET https://coverartarchive.org/release-group/<mbid>` (no auth, courtesy
  User-Agent only — same `context/http.ts` wrapper already used for MB
  calls). 404 (no art submitted) is a normal, common outcome, not an error.

Design:

- [x] New `context/coverartarchive.ts` module, same shape as `wikipedia.ts`/
      `discogs.ts` (independent, degrades to empty, doesn't fail the whole
      context lookup).
- [x] Extend `AlbumContext` (`shared/src/dto.ts`) with
      `images: { url, thumbnailUrl, type: "front"|"back"|"secondary", source: "discogs"|"coverartarchive" }[]`
      — merged in `context/index.ts` alongside summary/credits/facts/links,
      cached in the same 30-day per-album cache entry (no new cache). Real
      bug found and fixed during this: pre-existing 30-day cache entries
      written before `images` existed don't carry the field, and the
      response schema now requires it — Fastify's serializer 500'd on any
      cache hit until the read path was made to default `images` to `[]`
      for legacy entries.
- [x] Client: a thumbnail strip (not buried inside the collapsed "About
      this album" `<details>` — this is visual content, worth its own
      always-visible row near the header) that opens a simple lightbox
      (prev/next, no new dependency needed for something this small) on
      click. Render nothing at all when the only image found is the same
      front cover already shown as the header art — the point is the
      *extra* material, not a redundant second copy of the cover.
      Implemented as: hide the whole strip unless at least one non-front
      image exists (URL-level dedup against the Spotify header art isn't
      meaningful across three different image hosts). Verified live against
      a real Discogs+Cover Art Archive pull (11 images: front/back/insert
      scans/disc art), including click-to-open, prev/next click, arrow-key
      nav, and Escape-to-close.
- [x] Attribution links ("View on Discogs" / "View on Cover Art Archive"),
      same pattern as the existing `summarySource` link.

Explicitly not attempting: categorizing Discogs' `secondary` bucket by
content (see caveat above) — ship what the sources actually tell you.

### 10.12 addendum — Song Meanings as a default track-level link template — done

Same mechanism as 10.12's Genius lyrics-search fallback (track-level
template, `{artist}`/`{track}` placeholders) — add
[songmeanings.com](https://songmeanings.com) as a second default, since it's
a different thing than a lyrics search: song-meaning/interpretation
discussion, not the lyrics text itself. **Verify the exact search
query-string format against the live site when implementing** — not
confirmed here, don't guess-and-ship a URL pattern that 404s.

Verified live: `songmeanings.com/query/?query={artist}+{track}` (and
Genius's own pattern, `genius.com/search?q={artist}+{track}`) both
confirmed via real browser navigation against "Opeth" / "Bleak," then
end-to-end against a genuinely lyrics-less track (Karnivool's "Scarabs,"
found by scanning real backlog albums for a track LRCLIB has nothing for)
— both search links rendered and resolved correctly in the live app.

### 10.15 — Footer: license + credit line

`Layout.tsx` has a header (logo, health dot, nav) and the fixed bottom
player bar, but nothing at the bottom of normal page flow.

- [x] Add a `<footer>` in `Layout.tsx`, as a flex-column sibling after
      `<Outlet />` and before `<NowPlayingCard />` (so it's in normal
      document flow, not fixed — it can sit below the fold under the
      player bar, which is fine for a footer). Small, muted text
      (`text-xs text-neutral-600`), centered: current version (reuse the
      same `["version"]` query `AboutSettings`/`UpdateBanner` already fetch
      — no new request), `AGPL-3.0-only` linking to the `LICENSE` file, and
      "Made with ♥ by S. Cortés." Used `text-ink-muted` (the redesign's
      token) rather than the literal `text-neutral-600` above, which
      predates the theme system.

### 10.16 — Settings: thank the data providers

Beneath `AboutSettings.tsx` in `SettingsPage.tsx`, a short attribution
section — not just a nicety: MusicBrainz, Discogs, and LRCLIB's own API
terms all ask for attribution, and this is the one screen a self-hoster
will actually read once.

- [x] New `AttributionSettings.tsx`, rendered right after `AboutSettings`
      in `SettingsPage.tsx`. One line per source actually integrated today
      (plus Cover Art Archive once 10.14 lands), each linking out:
      **Spotify** (catalog + playback), **MusicBrainz** (release facts),
      **Wikipedia** (album summaries), **Discogs** (credits, notes, and
      once 10.14 lands, extra cover images), **LRCLIB** (lyrics), **Cover
      Art Archive** (cover scans — 10.14). Framed as a thank-you, not a
      bare link list — matches the warmer tone this ask is going for,
      distinct from the purely functional links elsewhere in Settings.
      10.14 had already landed by the time this was built, so Cover Art
      Archive's line ships from the start rather than needing a follow-up.
      Amended when 10.17 landed to add a 7th line (Last.fm).

### 10.17 — Similar albums (Last.fm) — done

Not originally spec'd here — added conversationally mid-session after the
user asked whether Last.fm has an API (it does, free, self-service) and
pointed at a sibling project (`project-sensmoi`) that already held a
`LASTFM_API_KEY` and an unbuilt design doc reaching the same conclusion:
Last.fm's similarity data is artist-level only (`artist.getSimilar`), no
album-level equivalent exists.

- [x] Settings: `LastfmSetup.tsx`, a single-field mirror of
      `DiscogsSetup.tsx` — presence of the key is the on/off switch (no
      separate enabled flag), explicitly requested ("make it disable via
      settings") — clear the field and Save to turn the feature off.
- [x] `server/src/similar-albums.ts` — for the album's artist:
      `artist.getSimilar` (top 8, Miller's Law) → each similar artist's
      `artist.gettopalbums` (limit 1) → resolved to a real Spotify album id
      via `/v1/search` (Last.fm's own artist/album images are near-
      universally a generic placeholder, confirmed live — not worth using).
      Cached 30 days per artist; deliberately knows nothing about Backlog/
      Revisit/Reviews so that fast-changing local state never bakes into
      the cache, same lesson as 10.12's link-template rendering. `GET
      /album/:id/similar` filters fresh against current Backlog/Revisit/
      Reviews at request time — verified live (adding a suggested album to
      the backlog made it disappear from the strip on next load).
      All response shapes (`artist.getsimilar`, `artist.gettopalbums`)
      verified against the live API with a real key before writing any
      parsing code, not guessed from memory.
- [x] Client: new `SimilarAlbums.tsx` organism — a horizontal strip of
      cards (cover + name + artist, `rounded-lg` per the shape lock),
      placed after the tracklist/lyrics grid, not competing with it for
      attention (DESIGN.md's own Pareto note: tracklist+lyrics+triage is
      the 20% that matters, discovery content is secondary). Renders
      nothing when Last.fm isn't configured or nothing survives the
      known-albums filter. Verified live against a real album (Karnivool's
      *Themata* → Dead Letter Circus, Cog, Rishloo, The Butterfly Effect,
      Leprous — genuinely similar bands, real Spotify cover art, real
      working links).

Real bug found and fixed along the way, unrelated to this feature but
surfaced while testing it: the Phase 10.12 lyrics-search fallback only
rendered on the empty-lyrics path, so a wrong-but-non-empty LRCLIB match
(a 20-second Karnivool interlude matched to an unrelated Don Henley song,
found live) had no escape hatch and no visible explanation. Fallback links
now render under any lyrics state except instrumental.

### 10.18 — Settings: clear cache — done

Also conversational, requested right after 10.17 landed: a self-hoster
hitting a stale/wrong cached lookup (the exact LRCLIB mismatch above is the
motivating case) had no way to force a refetch short of SSHing in and
deleting files under `data/cache/` by hand — which is exactly what this
session did manually, more than once, while testing 10.6/10.14/10.17.

- [x] `cache.ts` — `clearAllCaches()`, a single `rm -rf` of the whole
      `data/cache/` tree (Spotify albums, MusicBrainz/Wikipedia/Discogs/
      Cover-Art-Archive context, LRCLIB lyrics, Last.fm similar-artist
      resolution, the update-check). Doesn't touch `data/config/` or
      `data/reviews/` — those are saved user data, not a cache.
- [x] `POST /settings/cache/clear` — same operational-action shape as
      `/settings/api-key/regenerate`, no confirmation dialog for the same
      reason that one doesn't have one: fully reversible, nothing lost,
      worst case is a few slower page loads while things refetch.
- [x] Settings → About: a "Clear cache" button, with a plain-language
      explanation of what it does and doesn't touch. On success, also
      invalidates every client-side React Query cache (`queryClient.
      invalidateQueries()` with no filter) so whatever's currently on
      screen refetches immediately instead of waiting for a stale query to
      naturally re-trigger. Verified live: 352 cached files on disk before,
      1 after (the update-check cache, immediately regenerated because the
      Settings page's own version query refetched right after — expected,
      not a bug).

**AC for 10.3–10.16 collectively — satisfied:** every list of albums
anywhere in the app (Backlog, Recent, Revisit, Reviews, playlist import)
gets you to `/album/:id` in one obvious click; hitting Play with nothing
active always resolves to either playing audio or a device-picker, never a
dead-end error string; genre and background art appear on every album a
provider has data for; a back-cover/insert gallery appears whenever Discogs
or the Cover Art Archive actually has extra images for that release; every
page shows the license and a credit line; Settings fully explains and
controls what's visible in "About this album" and thanks every data
provider it actually uses; a playlist import never re-offers an album
already reviewed or queued for revisit. All of 10.3–10.16 is now checked;
this was the last outstanding item.

### 10.19 — Auto-follow lyrics toggle — scoped, not built

Requested conversationally (2026-09-05). Today's mechanism (`AlbumPage.tsx`):
`picked` (nullable, set only by clicking a track row) and
`selectedId = picked ?? (nowInAlbum ? nowId : tracks[0]?.id ?? null)` — so
lyrics already implicitly follow the now-playing track *until* the first
click on any row, at which point `picked` pins the view to that exact
track id permanently. There's no way back to live-tracking short of
re-clicking the current now-playing row, and that pin immediately goes
stale the moment the album advances to the next track (it's a fixed id,
not a "keep following" bit).

- [ ] Replace the implicit null-check with an explicit
      `autoFollow: boolean` state (`useState(true)`). Clicking a track row
      sets `autoFollow=false` and `picked=trackId`, same as today's click
      handler, just also flipping the new bit.
- [ ] `selectedId = autoFollow ? (nowInAlbum ? nowId : tracks[0]?.id ?? null) : (picked ?? tracks[0]?.id ?? null)`.
- [ ] A small toggle control next to the existing
      `<h2>Lyrics: {track.name}</h2>` heading (flex row, same
      header-plus-action pattern as `DevicePicker`'s "Playback device" +
      "Refresh") that sets `autoFollow=true` (and clears `picked`) when
      clicked while off. Wording: "Auto-follow" or similar, with a visibly
      different active/inactive state (reuse `Button`'s existing variants
      rather than inventing a new toggle atom).
- [ ] Reset `autoFollow=true` and `picked=null` in a `useEffect` keyed on
      the route's `id` param. Real gap found while scoping this, not
      invented by this feature: `AlbumPage` doesn't remount on `/album/:id`
      → `/album/:id2` navigation (same route element, different param), so
      today a `picked` track id from a previously-viewed album silently
      carries over into the next one. Worth fixing as part of this same
      change since it's the same state.

Not attempting: persisting the `autoFollow` preference itself anywhere
(Settings, localStorage) — defaulting to `true` every time a new album
loads matches today's existing behavior and needs no new storage.

### 10.20 — Mark popular tracks (Spotify's `popularity` field is gone; use Last.fm) — scoped, not built

Requested conversationally (2026-09-05), prompted by the user's own
experience on a sibling project (`project-sensmoi`) discovering Spotify's
audio-features (danceability/energy/acousticness/etc.) are no longer
accessible. Verified this session, and it's worse than that for
`popularity` specifically: Spotify's **February 2026** Web API migration
removed the `popularity` field from Track, Album, *and* Artist objects
outright for apps in Development Mode — only apps approved for Extended
Quota Mode (a commercial-distribution approval Spotify grants, irrelevant
to a self-hosted personal tool) keep it. Every Gatefold self-hoster
registers their own personal Spotify app (`docs/self-hosting.md`'s own
documented design), which is a Development Mode app by construction — so
this isn't a workaround-able gap or a "wait for Spotify to fix it," it's
permanently closed for an app shaped like this one.

Replacement: **Last.fm**, already integrated (Phase 10.17, same API key,
zero new Settings/config surface needed). `track.getInfo(artist, track)`
returns `playcount`/`listeners` — a real, if different, popularity signal
(community listening data, not Spotify's own algorithmic score).

- [ ] Server-side, per album: batch `track.getInfo` calls (one per track,
      ~12/album) only when Last.fm is configured (mirrors 10.17's
      `lastfmConfigured()` gate). Cached in the album's existing 30-day
      cache entry — this is enrichment on data already being fetched and
      cached, not a new cache namespace.
- [ ] Rank the album's own tracks by `playcount` (or `listeners` — decide
      at implementation time by comparing which correlates better with
      perceived "popular song" on a few real albums, don't guess) and mark
      the top **3** (proposed default — open to revisiting once real data
      is in front of us; matches `GenreChips`' existing "cap the visual
      noise" precedent rather than marking a percentage that could tag
      most of a short EP).
- [ ] Small badge on the marked tracks' rows in `TrackList`/`TrackRow` —
      reuse the existing `Badge` atom (a `neutral`-style variant, distinct
      from the `now-playing` badge already there), not a new component.
- [ ] Silent when unavailable, same discipline as `SimilarAlbums`/
      `AlbumGallery`: no badge at all when Last.fm isn't configured, and
      skip (don't guess-rank) any track Last.fm has no data for rather
      than treating a missing lookup as "least popular."

Explicitly not attempting: reconstructing the old audio-features
(danceability/energy/valence/etc.) from any other provider — checked
during this session's research, no free/self-hostable replacement API for
those specific derived audio-analysis metrics is known to exist; that's a
dead end, not a "later phase."

---

## Phase 11 — Languages

Own phase, not folded into Phase 10's catch-all (own decision, 2026-09-04):
this is a themed cluster — reading a lyric in a script you're learning,
knowing what language an album's lyrics are in, and eventually reading what
they mean — not a grab-bag of unrelated conversational asks the way Phase
10's items were. 11.1–11.3 share one piece of infrastructure (script
detection over lyrics text); 11.4–11.5 are a bigger step up in scope
(a real i18n framework, a paid translation API) and depend on each other
but not on 11.1–11.3.

Explicitly out of scope for this phase (own decision, discussed
2026-09-04): a tap-a-word dictionary lookup and vocabulary/flashcard
export (e.g. to Anki). Both are real language-learning features, but both
turn this from "a lyrics feature" into "a second app bolted onto this
one" — dictionary data sourcing (JMdict etc.) and a spaced-repetition
export format are each their own project, not an extension of Gatefold's
actual purpose (deliberate album *listening*).

### 11.1 — Lyrics romanization (Japanese/Korean/Russian) — scoped, not built

Requested conversationally (2026-09-04): the user is learning Japanese and
wants romaji shown alongside lyrics that aren't in a Latin-adjacent script —
same want covers Korean (Hangul) and Russian (Cyrillic). Prior art checked
and ruled out as reusable: `lyricstify` (github.com/lyricstify/lyricstify)
is a full standalone terminal Spotify client (NestJS/RxJS), not a library —
that's almost certainly why it was never "set up properly," it wants to
replace the Spotify client, not slot into one.

**This is transliteration (how it sounds), not translation (what it
means)** — that's 11.5, below.

Architecture decision: **server-side, cached inside the existing lyrics
cache entry**, not client-side. Reasoning: it's the same shape as the
existing `lyrics/lrclib.ts` pattern (fetch once, cache 30 days), and it
keeps a real dependency-weight concern (below) off the browser entirely.

- [ ] New `packages/server/src/lyrics/romanize.ts`:
      `detectScript(text: string): "cyrillic" | "hangul" | "japanese" | null`
      using Unicode property-escape regexes on the *whole* lyrics text once
      (not per line — real songs don't mix scripts mid-track, and per-line
      detection isn't worth the complexity): `/\p{Script=Cyrillic}/u`,
      `/\p{Script=Hangul}/u`, and for Japanese specifically require
      hiragana/katakana presence (`/\p{Script=Hiragana}|\p{Script=Katakana}/u`),
      not bare `\p{Script=Han}` — kanji-only text is ambiguous with Chinese,
      and this app has no reason to guess at Chinese. Returns `null`
      (skip entirely) for Latin-script lyrics, which is most tracks. Shared
      by 11.3's language tagging — don't duplicate this detector.
- [ ] `romanize(text, script): Promise<string>` dispatches to one of three
      libraries, decided this session:
      - **Japanese** — `kuroshiro` + `kuroshiro-analyzer-kuromoji`, romaji
        (Hepburn) mode. This is the one hard case: kanji readings are
        context-dependent, so it needs a real morphological analyzer +
        dictionary, not a lookup table. Caveat to verify at implementation
        time: upstream `kuroshiro` is unmaintained (~5 years); if it fails
        to install/run cleanly on the current Node version, fall back to
        the `miseya/kuroshiro` typed fork before writing custom glue.
        The `kuromoji` IPADIC dictionary is a real ~15MB asset — **import
        it lazily** (`await import(...)` inside the Japanese branch only)
        so server boot time/memory and the Docker image aren't affected for
        the large fraction of users who'll never hit a Japanese track.
      - **Korean** — `@romanize/korean`, Revised Romanization (the modern
        default standard, matches what most libraries default to). Purely
        algorithmic (Hangul syllables decompose deterministically per
        Unicode block math) — no dictionary, negligible weight.
      - **Russian/Cyrillic** — the general `transliteration` npm package
        (actively maintained, broad Unicode table coverage) rather than a
        Russian-only package — the dedicated ones found this session were
        ~11 years stale.
      No new Settings/API-key UI needed for any of the three — all three
      run fully local, no network call, unlike Last.fm/Discogs.
- [ ] Extend `TrackLyrics` (`shared/src/dto.ts`) with `script` (the
      detected value above, `null` for Latin) and either
      `romanizedSynced: string[] | null` (index-aligned 1:1 with `synced`
      lines — timing is identical, so only the text needs duplicating) or
      `romanizedPlain: string | null`, whichever of `synced`/`plain` the
      track actually has. Computed once in `getLyrics()` right after the
      LRCLIB fetch and stored in the *same* 30-day cache entry — it's fully
      derived from lyrics text already being cached, not independent data
      that needs its own cache namespace.
- [ ] `LyricsPanel.tsx`: a small toggle/cycle control, rendered only when
      `lyrics.script` is non-null — the large majority of tracks show no
      new UI at all. Own decision (2026-09-04): this control should cycle
      between original-only / +romanization / +translation (once 11.5
      exists) rather than stacking all three gloss lines by default —
      DESIGN.md's own Miller's-Law crowding concern applies directly to a
      lyrics panel that could otherwise show 3 lines per lyric. When a
      gloss is on, each `SyncedView` line gets a second, smaller
      `text-ink-muted text-xs` line underneath (original stays primary).
      `plain` mode renders the gloss blob as a second block below the
      original. Per the same "confidently wrong" precedent as the
      LRCLIB-mismatch fallback (Phase 10.12): label it something like
      "romanized automatically" rather than presenting it as authoritative,
      since kanji-reading disambiguation can still be wrong even with a
      real analyzer.

Open decisions to make at implementation time, not guessed here:
`kuroshiro` vs the `miseya` fork (try upstream first, fall back if it
doesn't install/run cleanly); whether the ~15MB kuromoji dictionary ships
in the Docker image or gets fetched on first use (affects image size,
documented as a real tradeoff above, not silently picked).

### 11.2 — Furigana toggle (Japanese) — scoped, not built

Near-free extension of 11.1: `kuroshiro` already supports rendering
readings *above* kanji (furigana mode) as an alternative to full romaji
conversion — a different, arguably better learning aid, since you keep
reading actual Japanese instead of Latin letters, just with pronunciation
help. Depends entirely on 11.1's Japanese pipeline existing first (same
`kuroshiro` instance, different output mode, no new dependency). Folds
into the same gloss-cycle control from 11.1 as a Japanese-only third
state, rather than a separate toggle.

### 11.3 — Language tagging + filtering — scoped, not built

Reuses 11.1's `detectScript()` (broadened to also recognize Latin, so
every track gets a definite tag, not just the non-Latin ones) to tag each
track/album with a detected lyrics language, stored alongside the lyrics
cache entry. Backlog/Revisit/Reviews get a filter chip (same molecule
pattern as the existing genre-filter UI) — turns the existing backlog
into a usable study queue ("show me only Japanese albums") without a
separate list to maintain. Depends on 11.1 landing first for the shared
detector; doesn't depend on 11.4/11.5.

### 11.4 — App localization (i18n) — scoped, not built

Requested conversationally (2026-09-04), alongside 11.5: lyrics
*translation* (meaning, not sound) only makes sense once the app has a
concept of "what language does this user want to read in" — otherwise
there's no answer to "translate lyrics into what?" Decided launch scope:
**English + Spanish** (the user's own reviews are already written in
Spanish — real signal, not a guess), with the i18n plumbing built so
additional languages are a translation-file addition, not a new feature.

- [ ] `react-i18next` (+ `i18next`) — the standard React choice: JSON
      resource files per locale, a `useTranslation()` hook, interpolation/
      pluralization handled for free.
- [ ] The real cost isn't the library, it's the extraction pass: every
      hardcoded string across the app (nav labels, buttons, empty states,
      error copy — a lot, given this codebase's existing copy density)
      needs to move into translation keys. This is a mechanical but
      genuinely large refactor touching most component files — size it
      as such, don't underestimate it as "add a library."
- [ ] One new Settings control (a language picker) — the chosen locale is
      **one shared preference**, persisted server-side alongside other
      settings (`appConfig`, same store as everything else in Settings),
      reused by both the UI language (this item) and lyrics-translation
      target (11.5) — deliberately not two separate pickers.
- [ ] Initial resource files: `en.json`, `es.json`.

### 11.5 — Lyrics translation — scoped, not built

Real translation (meaning), not 11.1's transliteration (sound) — a
bigger step up in scope than 11.1–11.3: needs a paid third-party MT API,
not a local library, so it gets the same Settings-card-plus-API-key
treatment as Discogs/Last.fm rather than being zero-config.

- [ ] Default to **DeepL** over Google Translate — better translation
      quality for European languages and a generous free tier (500k
      chars/month as of this research). Worth revisiting if Japanese/
      Korean translation quality turns out to matter more once 11.1 ships
      and non-Latin albums actually show up in testing.
- [ ] New Settings card, same shape as `DiscogsSetup.tsx`/`LastfmSetup.tsx`
      (API key field, `envLocked` support, a `TRANSLATE_API_KEY`-style env
      var).
- [ ] Translates lyrics text into whatever locale 11.4's language picker
      is set to — no separate "translate to" picker.
- [ ] Cached the same way lyrics/context already are: 30 days, keyed by
      track id + target locale (not just track id, since the same track's
      translation differs by target language — a genuinely new cache-key
      shape versus 11.1, which only ever produces one romanization per
      script).
- [ ] Folds into 11.1's gloss-cycle control in `LyricsPanel.tsx` as
      another cycle state, per that item's Miller's-Law reasoning — not a
      fourth always-visible line.

Depends on 11.4 (needs a locale to translate into) and benefits from
11.1 existing first (shares the gloss-cycle control), but the DeepL
integration itself is independent of either.

---

## Dependency graph

```
0 ─▶ 1 ─▶ 2 ─▶ 3 ─▶ 7
          └──▶ 4 ─▶ 5 ─▶ 6 ─▶ 7 ─▶ 8
                                   └──▶ 9 ─▶ 10 ─▶ 11
```

Phases 3 and 4 both only need Phase 2; everything funnels into 7. Phase 8
(Revision 1) builds on the finished MVP1 loop; its four Rev batches are
independent of each other and can land in any order (Rev-1 first is
easiest). Phase 9 (self-hosting) needs the config/auth refactor (9.1–9.4)
before the container work (9.5+) is worthwhile. Within Phase 11: 11.1 ─▶
11.2, 11.1 ─▶ 11.3, 11.4 ─▶ 11.5 (11.1 and 11.4 are independent starting
points).

## Not in this plan (later MVPs)

MVP2 — multi-button system + custom command buttons + button CRUD.
MVP3+ — FR-6b revisit-with-review-alongside, history/archive filters,
export, audio-feature charts, Stream Deck / MIDI bridge.
Parked — non-Spotify / manual albums: review + external context + YouTube
Music / Bandcamp search links, no playback. Deferred out of Phase 8 Rev-1.
