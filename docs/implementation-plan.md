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

## Dependency graph

```
0 ─▶ 1 ─▶ 2 ─▶ 3 ─▶ 7
          └──▶ 4 ─▶ 5 ─▶ 6 ─▶ 7
```

Phases 3 and 4 both only need Phase 2; everything funnels into 7.

## Not in this plan (later MVPs)

MVP2 — multi-button system + custom command buttons + button CRUD.
MVP3+ — FR-6b revisit-with-review-alongside, history/archive filters,
export, audio-feature charts, Stream Deck / MIDI bridge.
