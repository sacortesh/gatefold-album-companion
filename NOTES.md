# Gatefold — Notes

(This file started as notes for a different idea — a focus playlist / download
tool — and pivoted; see "Pivot" below for the real project.)

Session date: 2026-08-27

## Goal

Build a playlist for working / focusing. Mood: cyberpunk / Watch Dogs, but
kinda lo-fi. Also a metal fan.

## Genre question — "does this have a name?"

No single clean genre name. It sits at the intersection of several. Closest
umbrella tags people actually use: **"cyberpunk lo-fi"** or **"darksynth"**.

### The Watch Dogs / cyberpunk side
- **Darksynth / dark synthwave** — Perturbator, Carpenter Brut, GosT,
  Dan Terminus. Analog synths, driving but not frantic, dystopian.
  Perturbator especially bridges into metal.
- **Midtempo bass / "cyberpunk"** (Spotify mood tag) — Rezz, 1788-L,
  Kill SCRIPT. Heavy, slow, menacing.
- Actual Watch Dogs scores lean glitchy/electronic — Brian Reitzell (WD1),
  Hudson Mohawke (WD2), Stephen Barton (Legion).

### The lo-fi side
- **Lo-fi hip hop / chillhop** for background texture, but the darker end —
  "dark lo-fi", "cyberpunk lofi" (a real playlist niche). Pure chillhop is
  too cozy for this mood.

### The metal side that fits the mood
- **Industrial metal** — Nine Inch Nails, 3TEETH, Health, Author & Punisher,
  Street Sects. Cleanest bridge to darksynth: mechanical, dystopian.
- **Djent / instrumental prog** for focus — Cloudkicker, Animals as Leaders,
  Sithu Aye. Complex, no vocals competing for attention.
- **Blackgaze / post-metal** — Deafheaven, Russian Circles. Atmosphere over
  aggression.

### Tension to manage
Metal with vocals + blast beats wrecks focus. For a *working* playlist,
weight toward instrumental darksynth + industrial + djent. Use heavier
vocal metal sparingly as "momentum" tracks.

## Tool question — download Spotify playlists from YouTube Music

**spotDL** is the tool.

- Give it a Spotify playlist URL. It pulls track list + metadata from
  Spotify's API, searches YouTube Music per track, downloads audio via
  yt-dlp, transcodes with ffmpeg, tags files (title, artist, album art,
  synced lyrics). Result: local mirror of the playlist.

```bash
pipx install spotdl
spotdl download "https://open.spotify.com/playlist/XXXX"
```

Environment already has `pipx`, `ffmpeg`, `python3`. `spotdl` bundles
`yt-dlp`. First run walks through Spotify API credentials.

### Alternatives
- **yt-dlp** directly — paste a YouTube Music playlist URL, no Spotify,
  no metadata matching. More manual.
- **soundiiz / TuneMyMusic** — web services for *transferring* playlists
  between platforms, not downloading audio.

### Caveat
Downloading copyrighted tracks this way is against YouTube's and Spotify's
ToS regardless of jurisdiction. Fine for personal archival / owned /
CC-licensed material.

## Open next steps

- [ ] Draft an actual tracklist with the structure above
- [ ] Install spotDL + set up an output folder here

---

## Pivot — the actual project

The real goal is not the download tool. It's a **companion app on top of
Spotify for deliberate album listening**: work a backlog of albums,
triage tracks/albums into curated playlists via a few big configurable
buttons, see whole-album lyrics + metadata, then review + note each album
and clear it from the backlog.

- Functional spec: [docs/functional-spec.md](docs/functional-spec.md) (v0.6, MVP1 scoped)
- Architecture: [docs/architecture.md](docs/architecture.md) (proposal)
- Implementation plan: [docs/implementation-plan.md](docs/implementation-plan.md) (8 phases, MVP1)
- Acceptance tests: [docs/acceptance-tests.md](docs/acceptance-tests.md) (manual BDD suite for validating the UI + journeys)

**Build status:** Phases 0–6 ✅ + Phase 8 Revision 1 (Rev-1..4) ✅ — the
full MVP1 core loop plus: backlog-first landing, sticky bottom player
card, shuffle-off on album play, live like-state, review-notes template,
"About this album" context panel (MusicBrainz + Wikipedia + Discogs), and
importing albums from a playlist. Typecheck + build green, not yet
browser-verified. git `main`, pushed to
`github.com/sacortesh/album-companion`. Remaining tracks: Phase 7 (polish
+ tests) and **Phase 9 — self-hosting / distribution** (Docker image,
UI-configured secrets, PKCE auth, `/config` volume, update banner;
Sonarr/Radarr shape). See implementation-plan.md.

Run: `npm install && npm run dev` → app on :5173, API on :8888.
Flow: add albums to the Backlog → open one → listen, Like/Banger tracks,
read synced lyrics → "Finish album" → Keep / Revisit / Pass / Delete +
notes → it clears from the backlog and writes `data/reviews/<year>/*.md`.
Revisit page lists the "come back to it" albums.
Phase 9 (self-hosting) in progress: repo hygiene (README, AGPL LICENSE,
CI), 9.1 runtime config store + 9.4 PKCE auth done — Spotify client id +
Discogs keys settable in Settings (data/app.json), no client secret.
9.2 API key + optional UI auth done (2026-08-29) — `apiKey` required on
every `/api/*` call except `/api/health`; optional username/password
sign-in gates the SPA via a signed session cookie. 9.6 Settings UI is
functionally done (Spotify/Discogs/Security sections all built) modulo
the About/Updates section, which needs 9.7's version-check endpoint
first. Also since: a Reviews page (browse every past verdict, not just
the Revisit queue), Lucide icons replacing the old Unicode-glyph
grab-bag (Banger got a real 🤘 hand-metal icon), a real favicon/navbar
mark from clean vector art, and two reliability fixes surfaced by
testing — spotifyRequest() now has a 15s timeout + caps 429 backoff at
5s instead of sleeping on Spotify's literal Retry-After (hit a 39min
one), and the ambient Now Playing bar's polling was too aggressive
(2s/15s continuous on every page) so it's now load-on-open +
manual-refresh for Recent/track-states, playback poll relaxed to 6s.
2026-08-29: found real personal backlog data (74 albums) and a real
Spotify client ID committed since Phase 0 — untracked going forward
(data/config/*.json + data/reviews/ now gitignored; review-template.md
stays tracked as the one genuine shipped default), still on disk
locally. 9.3 /config volume restructure done (2026-08-30) — DATA_DIR now reads
CONFIG_DIR env (default ./data), verified against a volume that didn't
exist at all (reads + writes, all self-create their dirs). 9.5 Container
done same day — Dockerfile, docker-compose.yml, .dockerignore, all
actually built and run (not just written): `docker compose up -d` on a
clean volume, config round-trips through the API, restart survives.
Caught a real bug this way — a bind-mounted host /config dir doesn't
inherit the image's baked-in chown, so the non-root `node` user couldn't
write; fixed with a root-then-drop-privileges entrypoint script
(docker-entrypoint.sh), same pattern Sonarr/LinuxServer.io images use.
`docker compose` itself wasn't installed in this dev environment either
(brew install docker-compose + a cliPluginsExtraDirs entry in
~/.docker/config.json) — now available for future testing.
Next: 9.6's remaining piece (About/Updates section) needs 9.7's
GET /api/version first; otherwise 9.7 (release + update check) and 9.8
(docs) are what's left before Phase 9 is fully closed out.

Stack: npm workspaces monorepo — `packages/{shared,server,web}`. `data/`
is local-only now (gitignored), not committed. React + Vite + TanStack
Query frontend; Fastify backend that holds the Spotify tokens and
reads/writes config + review files. LRCLIB for lyrics. No app-side
listening log — "recently listened" = Spotify's recently-played (50) +
current track.

Song actions: **Like** (big button, save to Liked Songs) + **Banger**
(add to configured playlist, auto-Likes). Album verdict: Keep / Revisit /
Pass / Delete.
