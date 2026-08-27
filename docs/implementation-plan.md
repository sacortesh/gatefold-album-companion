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

## Phase 2 — Now playing + playback control

Goal: see what's playing and drive it from the app.

- [ ] `server/spotify` helpers: `getPlayback`, `getDevices`, `play`,
      `pause`, `next`, `previous`, `seek`
- [ ] routes: `GET /api/playback`, `GET /api/devices`,
      `POST /api/playback/{play,pause,next,previous,seek}`
- [ ] `web/features/now-playing` — art, track/artist/album, progress bar,
      transport buttons, position-in-album
- [ ] `web/features/settings` — device picker → writes
      `settings.preferredDeviceId` via `PUT /api/config/settings`
- [ ] TanStack Query `refetchInterval` ~3 s on `/api/playback`;
      optimistic transport updates

**AC:** the now-playing panel tracks reality within a few seconds;
play/pause/next/prev/seek work against the selected device; picking a
device persists.

---

## Phase 3 — Like + Banger

Goal: the core triage loop, on the current track and on history rows.

- [ ] `server/spotify` helpers: `isTrackSaved(ids[])`, `saveTrack`,
      `removeSavedTrack`, `getMyPlaylists`, `playlistContains` (cache by
      `snapshot_id`), `addToPlaylist`
- [ ] routes: `POST/DELETE /api/like`, `POST /api/banger` (idempotent:
      membership check → add → auto-Like), `GET /api/playlists`
- [ ] `GET /api/recent` — `recently-played` (50) + current track,
      deduped; batch-resolve `liked` + `inBanger` per row
- [ ] `web/features/now-playing` — big **Like** toggle (key `L`),
      **Banger** button (key `b`)
- [ ] `web/features/recent` — recently-listened list; inline Like +
      Banger per row with "already Liked / already in <playlist>" state
- [ ] `web/features/settings` — banger-playlist picker → writes
      `buttons.json`
- [ ] mutations do optimistic updates + invalidate `/api/recent`

**AC:** Like the current track and a track from 3 songs ago; Banger a
track → it lands in the playlist *and* in Liked Songs; re-pressing does
nothing; state shown matches Spotify after a manual refresh.

---

## Phase 4 — Backlog

Goal: put albums in a queue and start them.

- [ ] `shared` — backlog schema (already stubbed in Phase 0; finalize)
- [ ] routes: `GET/POST/DELETE /api/backlog`; `GET /api/search?q=` (album
      search passthrough); `POST /api/playback/play` accepts an album
      context uri
- [ ] `server` — enrich backlog entries with album metadata on read
      (cover, artist, year, track count, length) via cached `getAlbum`
- [ ] `web/features/backlog` — album cards; add-by-search; remove;
      "Play album" (from the top); reorder (drag) — reorder is **(S)**
- [ ] "Play this album" also available from the now-playing / album view

**AC:** search an album → add to backlog → it shows with full metadata →
"Play album" starts it from track 1 on the active device → remove works.

---

## Phase 5 — Album experience view

Goal: the "complete listening" screen — tracklist, metadata, lyrics.

- [ ] `server/lyrics/` — LRCLIB client: `GET /api/get` by
      artist/track/album/duration, fallback to `/api/search`; on-disk
      cache in `data/cache/lyrics/`
- [ ] `GET /api/album/:id` — merge Spotify album + tracklist +
      per-track lyrics (synced / plain / none)
- [ ] `web/features/album` — full tracklist w/ durations + disc/track
      numbers; metadata block (release date, label, popularity,
      copyright); lyrics panel with synced view when available, plain
      fallback, and a clean "no lyrics" state
- [ ] click a track in the list → play from that track

**AC:** open any backlog album → see the full tracklist + metadata +
lyrics for most tracks, with graceful gaps; clicking a track plays it.

---

## Phase 6 — Album verdict + review

Goal: close the loop — verdict, notes, file written, backlog cleared.

- [ ] `shared` — review frontmatter schema, `verdict` enum
      (`keep|revisit|pass|delete`)
- [ ] `server/store` — review read/write (markdown + frontmatter),
      `<artist>-<album>` slug helper, `reviews/<year>/` foldering
- [ ] `POST /api/verdict` `{albumId, verdict, review}`:
      - Keep → `saveAlbum` · Revisit → append `revisit.json` ·
        Delete → `removeSavedAlbum` if saved · Pass → nothing
      - all → write the review file, remove the album from `backlog.json`
- [ ] routes: `GET /api/reviews`, `GET /api/review/:albumId`,
      `GET /api/revisit`
- [ ] `web/features/review` — verdict buttons + notes + rating (1–10) +
      tags; prompted when an album is marked done
- [ ] `web/features/revisit` — simple list of revisit albums linking to
      their prior review (the review-shown-alongside-playback flow,
      FR-6b, is MVP3)

**AC:** finish an album → pick each verdict in turn (on test albums) →
correct Spotify side-effect happens, `reviews/2026/*.md` is written with
valid frontmatter, the album leaves the backlog, Revisit shows up in its
list.

---

## Phase 7 — Polish & hardening

Goal: it survives real use and a fresh clone.

- [ ] error states: no active device, account not Premium (control
      disabled, triage still works), auth expired, 429 surfaced calmly
- [ ] empty states: empty backlog, nothing playing, no lyrics, not
      connected
- [ ] keyboard-shortcut help overlay (`?`)
- [ ] `README.md` — dashboard setup, `.env`, `npm run dev`, first-run auth
- [ ] Vitest: `spotify` wrapper retry/refresh, `store` round-trips,
      `verdict` side-effects, `/api/recent` state resolution
- [ ] verify `npm run build && npm start` clean on a fresh checkout

**AC:** a fresh clone + the README gets someone to a working app;
`npm test` green; unplugging the speaker / revoking the token both fail
gracefully.

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
