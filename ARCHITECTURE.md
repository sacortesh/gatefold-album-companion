# Gatefold — Architecture Decisions

Tracked by the `avangarde-frontend-architect` skill. Companion to
`DESIGN.md` (product/UX decisions) — this file is the engineering record:
what the frontend is built with and why, kept separate so a dev picking
this up can read it without the design rationale attached.

## Frontend Architecture

### Framework
React 19, Vite, React Router (`createBrowserRouter`), TanStack React Query —
unchanged from the existing app. Not revisited by this overhaul; it's a
sound, appropriately lean stack for the app's actual size (audit: no
Redux/Zustand needed, the one cross-cutting abstraction that exists —
`useTriage`, a generic optimistic like/banger mutation hook reused across
album/recent — is a genuine architecture win worth keeping exactly as-is).

### File layout
Feature/domain structure already matches the skill's recommended shape:

```
src/
  components/     # shared atoms/molecules — GAINS a ui/ subfolder for
                   # shadcn/ui primitives (Button, Input, Dialog, etc.),
                   # kept separate from Gatefold-specific shared components
                   # (Layout, PlaybackDock) so `npx shadcn add` never
                   # collides with hand-written files
  features/<name>/ # organisms + hooks, unchanged
  routes/          # App.tsx's router config — unchanged
  lib/             # unchanged
```

Only change from today: `components/ui/` as the shadcn/ui landing zone.
Everything else (`features/*`, `lib/*`, `api/client.ts`) keeps its current
shape — this overhaul touches visual presentation and shared primitives,
not the data/routing architecture.

### State management
Unchanged: no context/store for app state. Server state via React Query
(one shared `QueryClient`, `retry: 1`, `staleTime: 5000`,
`refetchOnWindowFocus: false`). Auth/API-key state stays a module-level
singleton in `api/client.ts`, set by `LoginGate` — small enough that
promoting it to context would be unwarranted complexity (Occam's Razor).

### Data fetching
Unchanged: React Query hooks per feature (`useBacklog`, `useRecent`,
`usePlayback`, etc.), fetched at the page/feature level, not scattered
across organisms. `usePlayback`'s 6s poll + 500ms client-side extrapolation
ticker stays as-is — it's the mechanism `PlaybackDock`'s new progress-bar
atom will consume, not something this overhaul needs to touch.

### Rendering strategy
No SSR/RSC (Vite SPA) — not applicable. The one new rendering concern this
overhaul introduces: `AlbumHero`'s blurred-background image should decode
off the critical path (`loading="eager"` only for the small foreground
cover-art frame, the full-bleed blurred version can lazy-decode since it's
decorative) — see Vercel guideline: below-fold images lazy, above-fold
critical images prioritized; the blurred background is above-fold but
decorative, so `decoding="async"` rather than blocking priority.

### Testing hook points
No automated e2e exists yet (only the manual `docs/acceptance-tests.md`
checklist — see `DESIGN.md`'s Requirements section). Every new interactive
element from the Phase 4 inventory (Button, TriageButton, Dialog triggers)
gets accessible roles/labels by construction (shadcn/ui primitives ship
this), which is what a future Phase 7 automated pass would need — not
adding `data-testid`s speculatively ahead of that work actually happening.

## Styling

### Approach
**Tailwind (kept) + shadcn/ui** for the component atoms, not a full
official design system swap. Reasoning against the `references/06-styling.md`
design-system map: Gatefold doesn't match any of the named enterprise
systems (Fluent/Material/Carbon/Primer/govuk) — it's a personal,
opinionated product, not an enterprise or public-sector one — so
`@radix-ui/themes` or shadcn/ui are the fits. shadcn/ui wins over
`@radix-ui/themes` specifically because the whole point of this overhaul is
a bespoke record-sleeve visual identity (`DESIGN.md`'s Theme section) —
shadcn ships the component *code* into the repo to be recolored freely,
where `@radix-ui/themes` ships a pre-themed package meant to be consumed
mostly as-is. Tailwind itself stays because the existing app is 100%
Tailwind already (audit) and the team (solo) already knows it — no reason
to introduce a second styling paradigm for a visual refresh, not a
framework change.

### Token mapping
Every `DESIGN.md` `## Theme` color/type/radius value maps into
`tailwind.config.js`'s `theme.extend`, not as ad hoc hex in `className`
strings:

```js
theme: {
  extend: {
    colors: {
      bg: "#070b13", surface: "#131922", "surface-2": "#202731",
      border: "#313844", ink: "#e5e8ed", "ink-muted": "#9299a2",
      primary: { DEFAULT: "#00dde9", ink: "#1c0d06" },
      banger: "#eda922", danger: "#e24947",
    },
    fontFamily: {
      display: ["Spectral", "serif"],
      sans: ["Public Sans", "system-ui", "sans-serif"],
    },
    borderRadius: { DEFAULT: "6px", lg: "10px" },
  },
}
```

`shadcn/ui`'s own CSS-variable convention (`--background`, `--primary`,
etc. in `index.css`) gets pointed at these same hex values at install time,
so there is exactly one source of truth (this table), not two — shadcn's
variables and the Tailwind config both resolve to the same committed hex.

### Maintainability rules
- No `@apply` soup — repeated utility combinations become atoms (Phase 4),
  per `references/06-styling.md`.
- No arbitrary-value Tailwind (`w-[137px]`-style) reused more than once
  without becoming a token; one-off layout tweaks are fine, repeated ones
  aren't.
- `hover:`/`focus-visible:`/`dark:` variants stay attached to the element
  they affect, not scattered.
- Fonts (`Spectral`, `Public Sans`) are self-hosted via `@fontsource` (no
  runtime Google Fonts request, keeps this a fully self-hosted app
  consistent with Gatefold's own self-hosting principle) and preloaded per
  the Vercel guideline (`<link rel="preload" as="font">`, `font-display:
  swap`) — this also closes the audit's "declared-but-never-loaded Inter"
  gap for good, by construction (the font ships in the bundle, it can't
  silently not-load).
- Accessibility floor (non-negotiable, per `DESIGN.md` and the Vercel
  guidelines fetched for this pass): visible `focus-visible` rings on every
  interactive element (never `outline-none` without a replacement),
  icon-only buttons get `aria-label`, `prefers-reduced-motion` disables the
  one hero-fade animation, modals (Dialog-based per the Phase 4 inventory)
  get focus-trap + `Escape`-to-close from shadcn/Radix by construction
  rather than hand-rolled.
