# Gatefold — Design Decisions

Tracked by the `avangarde-frontend-architect` skill, in **Overhaul** mode:
requirements, navigation, and content are preserved from the existing app;
theme and components are a deliberate visual redesign on top of them. See
`ARCHITECTURE.md` for the frontend/styling engineering decisions this feeds
into.

**Status**: the redesign below has been rolled out app-wide — every route
(Backlog, Now Playing, Recent, Album, Revisit, Reviews, Settings), the
shared chrome (`Layout`, `NowPlayingCard`), and the one modal (`VerdictDialog`)
all run on these tokens/components. Not part of this pass: no new
functionality was added (that's Phase 10 in `docs/implementation-plan.md`,
a separate track) — this was a visual-only pass over existing screens.

## Requirements

Reverse-engineered from the existing build, not re-derived from scratch
(Tesler's Law — the system should absorb this complexity, not force a redo):

- Single self-hosted user, deliberate front-to-back album listening on top
  of Spotify: backlog → listen with lyrics/context → triage (like/banger) →
  verdict + review → optionally revisit later.
- The album-detail screen (`AlbumPage`) is the most-invested, highest-traffic
  surface — it's the actual point of the app, not a secondary view.
- Persistent playback control (bottom transport dock) is used constantly
  across every other screen — must never be visually or functionally
  secondary to whatever page is active.
- Real day-to-day usage is documented in `docs/acceptance-tests.md` (a live,
  manually-ticked Gherkin checklist, not a template) — treat it as the
  functional source of truth; Phase 7 journeys should reflect it, not
  replace it.
- Pareto: the 20% that matters is the tracklist + lyrics + triage loop on
  `AlbumPage` and the persistent transport dock. Settings/security/setup
  screens are correctness-critical but not where design investment pays off.

## Navigation (preserved — not in scope for this overhaul)

- Single top bar: logo, health indicator, 6 flat nav links (Backlog · Now
  Playing · Recent · Revisit · Reviews · Settings). Phase 10.4 (already
  spec'd in `docs/implementation-plan.md`, separate from this skill) will
  merge Now Playing/Recent into one entry — a content change, not a visual
  one, so it doesn't block this overhaul.
- Persistent bottom playback dock, present on every route once something is
  playing. Jakob's Law: matches the desktop-player mental model every
  Spotify user already has — kept as-is structurally.
- No sidebar, no breadcrumb. Not revisited here — Overhaul mode holds IA
  fixed per the skill's own rule.

## Theme

Dials: variance **4-5**, motion **3**, density **6**

Justification: this is a dense, daily-use utility app (long tracklists,
backlog lists, review history) — not a landing page, so density stays high
rather than airing out for its own sake. Variance is moderate: mostly
consistent, list-driven layouts, with one deliberate bold moment (the album
hero) rather than uniform grid sameness or asymmetric chaos. Motion is low
and functional only (Doherty Threshold feedback, one hero reveal) — a
utility app used many times a day should not perform for the user on every
visit.

**Direction, confirmed with the user**: record-sleeve, warm — album artwork
treated as real hero material (ties directly into the already-planned
Phase 10.7 blurred-background-art and 10.14 image-gallery work), moving off
the generic near-black/acid-green combination the audit flagged as the
single most recognizable AI-default look (`references/taste-checklist.md`).
The accent moves off Spotify green entirely.

**Revised after first look**: the initial copper/brass accent (`#ef8448`)
read as another AI-generic tell to the user — specifically as "Claude
orange," from seeing it across other AI-built projects — despite scoring
well against the taste checklist's specific banned-terracotta hex. Taste
checklists catch known patterns; they don't catch "this reads as a specific
tool's brand color to someone who's seen a lot of AI output," which only a
human reaction surfaces. Replaced with **electric cyan** (`#00dde9`) per the
user's explicit request for "electric or neon" — keeps the warm dark
neutrals (not in question) but swaps the accent to a cool neon, which reads
as a record-store neon sign glowing in a dim room rather than a brass/copper
material. The user also flagged the existing glassmorphism (`backdrop-blur`
on the bottom dock and the hero's layered blur) as a highlight — preserved
as-is, not currently planned to expand further unless asked.

**Revised again**: with the accent now cyan, the user flagged that the
original warm-brown near-black background no longer fit — warm brown reads
earthy/vintage, cyan reads futuristic/electric, and the combination felt
mismatched rather than intentional. Shifted the whole neutral ramp (bg
through border, plus text) from a warm hue (`H 55`) to a cool "night sky"
hue (`H 258`), keeping the same lightness steps — deliberately more than a
negligible tint (`C 0.018-0.022`, not near-zero) so it reads as a chosen
navy-black, not indistinguishable from the taste checklist's flagged
generic `#0B0B0B` near-black default.

Family: cool near-black neutrals (night sky, not brass/vinyl-room warmth)
+ an electric-cyan accent — the accent now reads as a neon sign against a
dark room rather than a mismatched material pairing.

### Color

All hex values computed deterministically via a direct implementation of
Björn Ottosson's OKLab/OKLCH → linear-sRGB matrices (no `culori`/`coloraide`
available in this environment; the algorithm itself is the reference
implementation, so this is still a computed value, not an eyeballed one).

```
--color-bg:            #070b13   oklch(0.15 0.018 258)  — cool near-black, "night sky"
--color-surface:       #131922   oklch(0.21 0.020 258)  — card/panel bg
--color-surface-2:     #202731   oklch(0.27 0.022 258)  — raised/hover surface
--color-border:        #313844   oklch(0.34 0.022 258)  — dividers, input borders
--color-text:          #e5e8ed   oklch(0.93 0.008 258)  — primary text
--color-text-muted:    #9299a2   oklch(0.68 0.016 258)  — secondary/meta text
--color-primary:       #00dde9   oklch(0.80 0.170 200)  — electric-cyan accent: CTAs, links, "now playing"
--color-primary-ink:   #1c0d06   oklch(0.18 0.030 48)   — text on --color-primary
--color-accent-banger: #eda922   oklch(0.78 0.155 78)   — kept for the existing "Banger" feature, hue-separated from primary (200° vs 78°) so the two read as distinct, not a mismatch
--color-danger:        #e24947   oklch(0.62 0.190 25)   — errors/destructive, hue-separated from primary (200° vs 25°)
```

Contrast verified (WCAG AA, computed not eyeballed):
text/bg 16.0:1, text-muted/bg 6.9:1, primary/bg 11.7:1,
primary-ink/primary 11.3:1, accent-banger/bg 9.7:1, danger/bg 4.9:1 — every
pairing clears AA (4.5:1) with margin, most clear AAA.

Color consistency lock: `--color-primary` is the only accent used for
primary actions and the "now playing" state, everywhere. `accent-banger`
and `danger` are reserved exclusively for their one existing feature each
(unchanged from the current app's actual usage pattern — the audit found
this discipline already holds, just with different hues).

### Type

**Revised**: "Spectral" wasn't on the taste-checklist's two explicitly
banned display serifs (Fraunces, Instrument Serif), but the user flagged
it the same way as the earlier copper accent — not a mechanical-checklist
failure, a "I've seen this specific font in AI-generated output enough
times to recognize it" reaction, which the checklist itself documents as
its own known limitation. Rather than swap to another safe editorial
serif, the user proposed "Rubik Distressed" — a worn/eroded texture that
literally reads as a record sleeve stored too long, a much more specific
and load-bearing justification than any clean serif could carry. Real
constraint found while wiring it in: it ships as a single weight (400,
no italic) — verified against the actual @font-face metadata, not
assumed — which rules out using it as a universal replacement (DESIGN.md's
own type system needs 500/600 and an italic elsewhere). Landed as the
**one deliberate bold moment** already called out under Motion below: the
album-hero title and the brand wordmark only. Spectral stays for
everything it already did elsewhere (page h1s, the artist-line italic) —
its "seen it before" risk was specifically about it being the loudest,
most-repeated element; demoted to a secondary role, that risk mostly
goes away.

Three families now, each with a narrow, specific job:

```
Distressed: "Rubik Distressed" — single weight, no italic, latin-ext/
  cyrillic/hebrew coverage. Used *only* for the AlbumHero `<h1>` title and
  the `Layout` brand wordmark ("Gatefold") — the two most visible,
  least-repeated spots, matching the theme's own "one deliberate bold
  moment, everything else quiet" rule. Never paired with a weight utility
  (font-semibold etc.) — the font has one weight, synthetic-bold would
  fight the texture.
Display: "Spectral", serif — weights 500/600, used for page h1s (Backlog,
  Reviews, Revisit, Settings, Recent) and italic for artist/attribution
  lines. Justified here, not a premium-vibe reach: gatefold liner notes
  are a genuinely print/editorial artifact, which is the specific
  condition taste-checklist.md requires before reaching for serif.
Body: "Public Sans", sans — weights 400/500/600, used for everything else
  (tracklists, lists, forms, UI chrome). Chosen over Inter/Roboto/Arial/
  Space Grotesk specifically to avoid the declared-but-never-loaded Inter
  gap the audit found — this one ships as an actual @font-face, not an
  aspirational config entry.
Scale: base 16px, 1.2 (minor third) ratio — 12 / 13.3 / 16 / 19.2 / 23 /
  27.6 / 33.2px — calm progression appropriate to density 6; no dramatic
  hero-scale jump, since the density signal says this app earns its keep on
  legible small text (tracklists, meta lines), not display-scale drama.
Numerals: tabular-nums on every numeric column (durations, track counts,
  progress timestamps) — a real functional need already present in the
  current codebase (`NowPlayingCard`'s elapsed/total display), not the
  taste-checklist's banned "monospace-for-decorative-labels" tell.
```

### Layout

One-sentence concept: the album's own artwork becomes the room the rest of
the page sits in, not a 176px thumbnail beside a wall of text.

```
┌──────────────────────────────────────────────────────────┐
│  [blurred/darkened album art, full-bleed, behind header]  │
│    ┌────────┐                                             │
│    │ cover  │  Album Title (Spectral, 2 lines max)        │
│    │  art   │  Artist · Year · Duration                   │
│    └────────┘  [Play album]  [Finish album]  [+ Backlog]  │
├──────────────────────────────────────────────────────────┤
│  ▸ About this album (collapsible, unchanged pattern)      │
├───────────────────────────┬────────────────────────────────┤
│  Tracklist (left, 60%)    │  Lyrics (right, sticky, 40%)  │
│  # Title      Artist  3:24│                                │
│  ...                      │  ...                           │
└───────────────────────────┴────────────────────────────────┘
```
Alignment: left-aligned throughout (list-heavy content reads left-to-right;
no centered hero text — this isn't a marketing page).

### Motion

One deliberate moment: on entering `AlbumPage`, the blurred background art
fades/scales in from the cover thumbnail over ~400ms (a "needle drop" —
justified by *this* subject specifically, not a generic entrance
animation). Everything else (hover states, list items, triage buttons)
stays instant or CSS-transition-only at the ≤150ms utility range — no
scroll-triggered reveals, no staggered list entrances. `prefers-reduced-motion`
disables the hero fade entirely (art appears at final state immediately).

## Components

Shape-consistency lock: **all-soft**, `rounded-md` (6px) for buttons/inputs/
pills, `rounded-lg` (10px) for cards/panels/the album-hero art frame — a
documented two-tier rule (matches what the audit found already-dominant in
the existing code, so this is a lock-in, not a new system), no `rounded-xl`/
`rounded-full` except progress bars and true circular controls (play button,
avatar-style thumbnails).

Card discipline: cards (bordered `--color-surface` panels) are used only
where they signal real grouping with no other cue available (settings
panels, the review-summary box) — list rows (tracklist, backlog, recent,
revisit, reviews) stay border/divider-separated, not individually carded,
matching the existing app's actual pattern and avoiding the "SaaS-card kit"
tell.

### Atoms
- Button — variants: `primary` (copper fill), `secondary` (bordered), `ghost` (text-only), `danger`; states: default/hover/focus-visible/disabled/loading. Replaces ~8 files' worth of hand-typed `rounded-md border ...` strings (audit finding).
- Input — states: default/focus/error/disabled. Text-type only, including the API-key field (masked via a show/hide toggle, never `type="password"` — Phase 10.10, already spec'd separately).
- Badge — variants: `neutral` (genre chips, explicit tag), `now-playing` (copper), `error`.
- Icon — wraps the existing inline SVGs (Play/Pause/Skip/etc.), enumerated once so `aria-hidden`/`aria-label` discipline (Vercel guideline: icon-only buttons require `aria-label`) is applied in one place instead of per call site.
- ProgressBar — thin (`h-0.5`–`h-1`) track + copper fill, used identically by the bottom dock and the album-hero transport.

### Molecules
- TriageButton — replaces `LikeButton`/`BangerButton` as one variant-driven component (`kind: "like" | "banger"`, `active`, `pending`, `size: "sm" | "lg"`) instead of two near-duplicate components each carrying their own boolean set — the taste checklist's component-level gate flags exactly this kind of near-duplicate pair.
- CopyField — the field already duplicated verbatim between `SecuritySettings` and `SpotifySetup` (audit finding), now a single shared molecule (label + monospace value + copy button + optional show/hide).
- MetaLine — the `·`-joined metadata line (year · tracks · duration · label), one component instead of ad hoc string-joining per screen; capped at one `·`-joined line per Vercel/taste-checklist copy discipline.
- SearchField — existing `AlbumSearch` input, unchanged in behavior, restyled onto the Input atom.
- DeviceList — added Phase 10.8: the device rows (radio + "Play here"), extracted out of `DevicePicker` so the Settings-page section and the new `DevicePickerPrompt` modal render the identical list off one `useDevices` hook instead of two hand-rolled copies.
- GenreChips — added Phase 10.6: genre `Badge`s for a list row, capped at 3 + a `+N` overflow chip (Miller's Law — one heavily-tagged album shouldn't blow out a row's height against its neighbors). One component shared by Backlog/Revisit/Reviews rather than three ad hoc renderings; renders nothing when the album has no cached genres yet, matching every other optional list-row field's empty-state discipline.
- TemplateRow — added Phase 10.11/10.12 (`LinksSettings.tsx`): one row of enable-checkbox + label `Input` + URL-template `Input`, repeated for each of the 5 default link templates (3 album-level, 2 track-level). Mirrors `DiscogsSetup`'s local-draft/dirty-flag/single-Save-button pattern rather than a per-row save — Law of Similarity, this Settings page already has one save convention, a second would be a new pattern to learn for no real gain at 5 items (well under Miller's Law's ~7).

### Organisms
- AppHeader — logo, health indicator, primary nav (6 → 5 after Phase 10.4) — appears on: all pages. Taste-checklist flags navs over 80px tall / not on one line at desktop: the current two-row layout (logo row, then a separate nav-pill row) likely exceeds that — collapse to one row at desktop width as part of the restyle, wrap to a second row only below the existing documented ~360px overflow breakpoint.
- PlaybackDock — the persistent bottom transport bar — appears on: all pages, whenever something is playing.
- AlbumHero — **new organism**, the core of this overhaul: full-bleed blurred album art background, cover-art frame, title (Spectral display), MetaLine, action row (Button atoms). Implements the Phase 2 album-detail node with a real visual identity for the first time.
- AlbumGallery — added Phase 10.14: back-cover/liner/insert scans from Discogs + Cover Art Archive, as a horizontally-scrolling thumbnail strip (own always-visible row below the hero, not buried in the collapsed "About this album" panel — Law of Proximity: visual content belongs near the other visual content, not filed under prose) that opens a third `Dialog`-based modal (a lightbox: prev/next + arrow-key nav + `Escape`, same primitive as VerdictDialog/DevicePickerPrompt — Jakob's Law, no bespoke overlay). Renders nothing when no non-front image exists, so it's silent on the majority of albums rather than showing an empty or redundant row. Sized `90vw`/`75vh` (not the shared `max-w-lg` default — scans need real screen real estate to be legible), each image captioned with what it is and its source (Cover Art Archive's own type when it has one — Booklet/Spine/etc. — else a generic fallback, never inventing a category Discogs' undifferentiated bucket doesn't support), with an in-dialog position counter and a `motion-safe`-gated loading spinner while the (sometimes several-hundred-KB) scan downloads.
- AlbumContextPanel — the collapsible "About this album" `<details>` (summary/credits/notes/facts/links from Wikipedia + MusicBrainz + Discogs). Personnel names link out to their own Discogs artist page when Discogs supplies an id, so "who produced this" becomes a real jumping-off point to that person's other work, not a dead label. No compound-component pattern needed (single `<details>`, no shared-context tabs/accordion structure).
- TrackList — the tracklist column: track rows (number/title/artist/duration/TriageButton × 2), no longer a `TrackRow` with 6 booleans — split into an explicit `variant: "default" | "now-playing" | "selected"` plus separate `liked`/`inBanger` state props (2, not folded into a variant, since they're independently toggleable states, not mutually exclusive display modes).
- LyricsPanel — unchanged structurally (already well-scoped: 4 props, 2 boolean, under the proliferation threshold), restyled onto the new type scale. Phase 10.19 (scoped in `docs/implementation-plan.md`, not yet built): a romanization toggle for non-Latin-script lyrics (Japanese/Korean/Russian) — a muted second line under each original line, shown only when the source script isn't already Latin-adjacent.
- BacklogList / RecentList / RevisitList / ReviewsList — the four list-page organisms, unified onto one internal `ListRow` molecule (currently four separately hand-rolled `Row`/`Card` locals per the audit) so the four pages stop drifting from each other visually.
- SettingsPanel — the settings-card shape (`AboutSettings`, `DiscogsSetup`, `SecuritySettings`, `SpotifySetup`, `BangerPlaylistPicker`) — this is where a real card border *is* justified (Card discipline above), since each is a genuinely separate configuration unit.
- VerdictDialog — the one true modal organism; migrated onto shadcn/ui's `Dialog` primitive (see `ARCHITECTURE.md`) for built-in focus-trap, `Escape`-to-close, and `aria-*` wiring instead of hand-built overlay/backdrop-click logic. PlaylistImport is an inline `<details>` disclosure, not a modal.
- DevicePickerPrompt — **second true modal organism**, added in Phase 10.8 (implementation-plan.md): same `Dialog` primitive as VerdictDialog, opened by a `DevicePickerPromptProvider` context mounted once in `Layout` so any play mutation across the app can trigger it on a `no_device` 409. Corrects this doc's earlier note that DevicePicker was inline-only — the Settings-page section still is (unchanged, still not a modal), but its underlying device list is now also reachable through this second, modal call site via a shared `useDevices` hook + `DeviceList` molecule.
- SimilarAlbums — added Phase 10.17: a horizontal strip of album-recommendation cards (cover + name + artist, `rounded-lg` per the shape lock), sourced from Last.fm and resolved to real Spotify albums server-side. Placed after the tracklist/lyrics grid on `AlbumPage` — deliberately last, not competing with the tracklist/lyrics/triage loop for attention (the Pareto note under Requirements). Renders nothing when the integration isn't configured or there's nothing left after filtering against Backlog/Revisit/Reviews — same silent-when-empty discipline as AlbumGallery.

### Compound families
- none identified — the app has no tabs/accordion-with-multiple-panels/menu structure that needs a shared-context compound component.

### Templates → Pages
- ListTemplate (AppHeader + PlaybackDock + list organism) → BacklogPage, RecentPage, RevisitPage, ReviewsPage.
- AlbumTemplate (AppHeader + PlaybackDock + AlbumHero + AlbumGallery + TrackList/LyricsPanel two-column body + SimilarAlbums) → AlbumPage.
- SettingsTemplate (AppHeader + PlaybackDock + stacked SettingsPanels) → SettingsPage.
- NowPlayingTemplate (AppHeader + PlaybackDock + large transport + embedded RecentList) → NowPlayingPage (pending its Phase 10.4 merge into Recent — a content change tracked separately, not blocked by this).
