# Gatefold — Functional Spec

Status: **v0.6 draft — MVP1 scoped; no app-side listening log (use Spotify's 50)**
Date: 2026-08-27
Owner: sacortesh@gmail.com

---

## 1. Vision / problem

Spotify's native app is weak for **deliberate, album-at-a-time listening**.
This project is a companion app on top of Spotify that supports a full
listening workflow:

- work through a **backlog** of albums
- during a session, **triage** music into curated playlists with a few
  big configurable buttons
- engage with **full album context** — lyrics, metadata, credits
- capture a **review + notes** per album afterward and clear it from the
  backlog

It is a "deep listening console", not a replacement music player.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Backlog** | Ordered set of albums the user intends to listen to |
| **Session** | A sitting where the user plays one or more albums with the app open |
| **Like** | Save the current (or a history-row) track to Liked Songs. The one big fixed button |
| **Banger** | Route a track to a configured playlist. MVP1 = one button / one playlist; generalises later |
| **Verdict** | The single album-level decision at session end: Keep / Revisit / Pass / Delete |
| **Now playing** | Currently playing track + its album context |
| **Recently listened** | Spotify's `recently-played` (last 50) + the current track. Not recorded by the app |
| **Album review** | Post-listen record: verdict, rating, notes, tags, date |

---

## 2b. Conceptual model — albums vs songs

You cannot "listen to an album" — you listen to **songs**, grouped by
album. The album is the *unit of curation and review*; the song is the
*unit of playback and of triage-to-playlist*. The two levels have
different actions:

**Song level** — as songs play, the user pulls out the gold. Two actions:

- **Like** — the one big, always-present button. Saves the song to the
  Spotify Library ("Liked Songs"). Name is a deliberate placeholder;
  no clash with album *Keep* (that's *save album*, this is *save track*).
- **Banger** — routes the song to a user-configured playlist. In MVP1
  there is exactly **one** banger button → **one** playlist. The button
  *system* generalises later (N buttons, each with its own playlist
  target(s), optional "also Like", and custom backend commands).

Both actions apply to the **current** song *and* to any row in the
listening history — so when a track has already rolled over to the next
one, the user can still Like / flag the previous track.

**Album level** — when the album is done, one verdict:

| Verdict | Meaning | Actions |
|---|---|---|
| **Keep** | Worth owning | Save album to Spotify Library ("+"); write review; remove from backlog |
| **Revisit** | Undecided / needs another pass | Add to a Revisit list; keep the initial review; remove from backlog; re-listenable from the app with the prior review shown alongside |
| **Pass** (default) | Not for me | Short review (optional); remove from backlog; nothing saved |
| **Delete** | Actively don't want it near my library | Pass + also remove from saved albums / unfollow if present |

The point of the whole app: **consciously curate the gold, let everything
else Pass.** Pass/Delete is the resting state; Keep and Revisit are the
deliberate exceptions.

---

## 3. User journey (from brainstorm, expanded)

| # | User's words | Feature area |
|---|---|---|
| 1 | "I have a playlist with a backlog of albums to listen to" | FR-2 Backlog |
| 2 | "I sit down to listen, connect to a Spotify client, find the experience lacking" | FR-1 Connection, FR-3 Playback |
| 3 | "Big button to see songs I've listened to recently, and like them — also the current song" | FR-4 Recently listened, FR-5 Song actions |
| 4 | "Several like buttons to triage — if I like it, it goes to a special set of playlists" | FR-5 Track triage, FR-10 Config |
| 5 | "See lyrics of the whole album and other metadata — a complete album listening experience" | FR-7 Album experience |
| 6 | "After listening, remove the album from the listening playlist, review it, add notes" | FR-6 Album verdict, FR-8 Review, FR-2 Backlog |

---

## 4. Functional requirements

Priority: **M** must / **S** should / **C** could (v1 scope).

### FR-1 — Spotify connection & auth  (M)
- OAuth 2.0 **Authorization Code** flow using a registered app's
  **client ID + client secret**. Token exchange + refresh happen in the
  thin local backend (D-7) so the secret never ships to the browser.
- Refresh token persisted locally (git-ignored); silent access-token
  refresh.
- Scopes: `user-read-playback-state`, `user-modify-playback-state`,
  `user-read-currently-playing`, `user-read-recently-played`,
  `playlist-read-private`, `playlist-modify-private`,
  `playlist-modify-public`, `user-library-read`, `user-library-modify`,
  `user-read-private`.
- Setup doc: register app in the Spotify dashboard, set redirect URI
  (`http://127.0.0.1:8888/callback`), put ID + secret in a local `.env`.
- Show connection status + active playback device.

### FR-2 — Backlog management  (M)
- View the backlog as a list of **albums** with cover, artist, year,
  length, track count, date added.
- Pick an album to start a listening session.
- Mark an album **done** → removes it from the backlog (and optionally
  routes it, see FR-6).
- Add albums to the backlog (search, or from a "to-listen" Spotify
  playlist / saved albums).
- Reorder / prioritize. (S)
- Backlog representation — see Decision D-5.

### FR-3 — Playback / now-playing  (M)
- Now-playing panel: track, artist, album, art, progress, queue position
  within the album.
- Transport controls: play/pause, next/prev, seek, volume. (depends on D-1)
- "Play this album from the top" from the backlog.
- Device picker (Spotify Connect targets). (S)

### FR-4 — Recently listened  (M)
- "Recently listened" view = Spotify's **`recently-played` (last 50
  tracks)** + the currently-playing track on top. **No app-side
  recording** — the 50-track window is accepted as enough.
- Each row shows **Like** and **Banger** inline, with "already routed"
  state derived live (track saved? in the banger playlist?) — this is the
  primary way to catch the previous track after it rolled over.
- Consequences accepted: no listening history beyond the last 50 tracks,
  no per-track completion %, no cross-session stats. If any of that is
  wanted later, add app-side recording then.

### FR-5 — Song actions: Like + Banger  (M)

**Like** (fixed, big button):
- Saves the target track to Liked Songs (`PUT /me/tracks`).
- Target = current track by default; or any listening-history row.
- Toggle: shows saved state, can un-Like.
- Keyboard shortcut (e.g. `L` or `space`-adjacent — TBD).

**Banger** (configurable; MVP1 = one button, one playlist):
- Adds the target track to the configured playlist
  (`POST /playlists/{id}/tracks`) **and auto-Likes it** (`autoLike: true`
  in MVP1 — Banger is a superset of Like).
- Idempotent — checks membership first; row shows "already in <playlist>".
- Target = current track or any history row.
- Config in `config/buttons.json`:
  `{ label, playlistId, autoLike: true, shortcut }`. Playlist is
  user-configurable via Settings; placeholder during build is
  `open.spotify.com/playlist/2HV7vgCtRds2I5veOv4j72`.

**Both:**
- Undo last action. (S)
- Post-MVP1: `config/buttons.json` becomes an array; each entry may
  target multiple playlists and/or fire a **custom backend command**
  (arbitrary Spotify call defined in config) — see D-7.

### FR-6 — Album verdict  (M)
- At session end (or any time), give the album one verdict:
  **Keep / Revisit / Pass / Delete** (see §2b for exact actions).
- **Keep** → `PUT /me/albums` (save to Library).
- **Revisit** → append to `config/revisit.json` with a pointer to the
  review; still removed from the active backlog.
- **Pass** → default; just remove from backlog.
- **Delete** → Pass + `DELETE /me/albums` if it was saved.
- Every verdict removes the album from `config/backlog.json` and opens
  the review prompt (FR-8).
- Verdict buttons are fixed (not user-configurable in v1), unlike the
  song buttons.

### FR-6b — Revisit flow  (S)
- A Revisit list view, separate from the backlog.
- Playing a Revisit album shows the **prior review + rating** alongside
  now-playing.
- Finishing a Revisit re-opens the review: amend in place or append a
  dated second pass; then Keep / Pass / Delete / stay-in-Revisit.

### FR-7 — Album experience view  (S, core to the vision)
- Full tracklist with durations, disc/track numbers.
- **Lyrics for the whole album**, per track, time-synced if available —
  see Decision D-4 (not in the Spotify API).
- Metadata: release date, label, genres, popularity, copyright line.
- Credits (songwriters, producers, performers) where a provider supplies
  them — limited; not in the Spotify Web API. (C)
- Audio features per track (energy, tempo, valence) as a mini chart. (C)

### FR-8 — Post-listen review & notes  (S)
- Per album: free-text notes, star/numeric rating, tags, "listened on"
  date, verdict (from FR-6).
- Notes editable later.
- Prompted automatically when an album is marked done.

### FR-9 — History / archive  (S)
- Browse past reviews; filter by rating, tag, verdict, date, artist.
- "On this day" / listening stats. (C)
- Export reviews (markdown / JSON). (S)

### FR-10 — Configuration  (M)
- MVP1: set the one Banger playlist (pick from the user's playlists) +
  its "also Like" flag → `config/buttons.json`.
- Preferred playback device.
- Auth management (re-login, logout).
- Post-MVP1: full button CRUD, custom command buttons.
- (LRCLIB needs no key; no lyrics settings in v1.)

---

## 5. External constraints — Spotify API reality check

| Area | Reality | Implication |
|---|---|---|
| Playback **control** | Requires Spotify **Premium**. Either the app becomes a playback device (Web Playback SDK, browser only) or it controls another device (Connect API). | Drives Decision D-1 + D-2. |
| Recently played | Last **50 tracks** only, no deep history, excludes the currently-playing track, ~30s-played threshold. | Accepted as-is (FR-4). "Recently listened" = this endpoint + current track. No app-side recording. |
| **Lyrics** | **Not in the official Web API** (Spotify licenses from Musixmatch, not exposed). | Need a third-party provider — Decision D-4. |
| Credits | Songwriter/producer credits **not** in the Web API. | Richer credits need Musixmatch / Genius / Discogs, or drop the feature. |
| Albums vs playlists | Albums can be **saved to Library** but not added to playlists; playlists hold **tracks**. | "Backlog of albums" is app-modeled; see D-5. |
| Rate limits | Rolling ~30s window, 429 with Retry-After. | Batch calls, cache album/track metadata locally. |
| Auth | Authorization Code flow; **client secret must stay server-side**; refresh tokens; scopes requested up front. | Needs the thin local backend (D-7) for token exchange; registered Spotify app + redirect URI. |
| Writing review files | A browser can't write to the repo filesystem. | Same thin backend reads/writes `reviews/`, `config/*.json`, the JSONL log. |

---

## 6. Decisions

| ID | Decision | Resolution | Notes |
|---|---|---|---|
| **D-1** | Playback model | **Hybrid — observe + optional control** | App reads Spotify Connect state (now playing, device) and can send play/pause/next/seek to the chosen device. User keeps using normal Spotify clients; the app is a console on top. Premium needed only for the control actions; observation + triage + notes work without it. |
| **D-2** | Form factor / platform | **Local web app** | Runs in a browser tab (localhost / self-hosted). Big touch-friendly on-screen triage buttons; works well on a tablet or second screen. Keyboard shortcuts for triage (D-6). |
| **D-3** | Persistence & scope | **Plain files in a git repo** | Reviews as markdown (`reviews/<year>/<artist>-<album>.md`), config as JSON (`config/buttons.json`, `config/backlog.json`), listening log as append-only JSONL. Portable, diffable, syncs via `git push`, doubles as a listening journal. No backend, no DB. |
| **D-4** | Lyrics provider | **LRCLIB** | Free, no API key, no quota. Synced (LRC) + plain lyrics. Graceful "no lyrics available" fallback when a track is missing. Revisit Musixmatch later only if coverage is a real problem. |
| **D-5** | Backlog representation | **App-managed file of album URIs** (follows from D-3) | `config/backlog.json` = ordered list of album URIs + date-added + priority. Each entry has a "play album" action via the Connect API (D-1). Not a Spotify playlist. |
| **D-6** | Triage input | **Keyboard shortcuts + on-screen buttons in v1** | Keys `1`–`6` map to the configured triage buttons. Stream Deck / MIDI as a post-v1 extension that just fires the same actions. |
| **D-7** | Tech stack | **React SPA + thin local backend** | Frontend: React (Vite), **no Next.js**. Backend: a minimal Node service (Express/Fastify/Hono) that (a) does the Spotify token exchange + refresh (holds the client secret), (b) exposes named action endpoints (`/like`, `/banger`, `/verdict`, playback control) that wrap Spotify calls, (c) exposes a **generic command passthrough** so future custom buttons can issue arbitrary Spotify requests from config, (d) reads/writes the repo files (`reviews/`, `config/*.json`, `log/*.jsonl`). Both run locally; one `npm run dev`. Reviews live **in this repo** for now. |

---

## 7. Out of scope (v1)

- Social / sharing features.
- Non-Spotify sources (local files, other streaming services).
- Multi-user accounts.
- Mobile-native apps.
- Recommendation engine / auto-filling the backlog.

---

## 8. MVP roadmap

### MVP1 — the core loop
1. Auth + connect (Authorization Code via backend); now-playing panel;
   device picker; play / pause / next / prev / seek on the selected
   Connect device.
2. App-managed backlog (`config/backlog.json`); "play album" per entry.
3. Recently-listened view = Spotify `recently-played` (50) + current track.
4. **Like** big button (save current track to Liked Songs) + inline Like
   on every recently-listened row.
5. **One** Banger button → one configured playlist (auto-Likes); also on
   recently-listened rows; set the playlist in config.
6. Album verdict (Keep / Revisit / Pass / Delete) → Library save /
   `revisit.json` / backlog removal + review prompt → `reviews/<year>/…md`.
7. Album view: tracklist + Spotify metadata + LRCLIB lyrics.

### MVP2 — expand the button system
- `config/buttons.json` becomes an array; N song buttons, each with its
  own playlist target(s), optional "also Like", own shortcut.
- Custom command buttons (arbitrary Spotify call from config) via the
  backend's generic passthrough.
- Button CRUD UI.

### MVP3+ — the experience layer
- Revisit flow with prior review shown alongside (FR-6b).
- History / archive views + filters, review export.
- Audio-feature mini charts, richer credits.
- Stream Deck / MIDI bridge (fires the same backend endpoints).

---

## 9. Still open

- **Review file frontmatter** — see the draft in `architecture.md` §6;
  confirm rating scale (proposing 1–10) and tag conventions.
- **Fastify vs Hono** for the server — leaning Fastify (`architecture.md`
  §12).
- Styling lib (Tailwind proposed).

Resolved since v0.4:
- Banger playlist is user-configurable (placeholder
  `2HV7vgCtRds2I5veOv4j72`); Banger **auto-Likes** (`autoLike: true`).
- Full architecture + repo layout: **`docs/architecture.md`** — pnpm
  monorepo, `packages/{shared,server,web}` + `data/` as the DB, Fastify +
  SSE, React + Vite + TanStack Query.
