# Contributing to Gatefold

Gatefold is a small, single-maintainer, self-hosted project — not a
foundation-governed one. That shapes everything below: PRs are genuinely
welcome, but scope and direction are curated by the maintainer, and there's
no promise of fast turnaround. If you want a feature and aren't sure it fits,
open an issue first rather than a PR — a five-minute conversation beats a
declined pull request.

Worth saying plainly: a lot of this codebase has been built through AI
pair-programming sessions (see the project's own pitch script if you're
curious). That's not a secret and it's not a bar to contributing — human or
AI-assisted PRs are both fine, as long as *you* understand and can defend
what you're submitting. "The agent wrote it" is never a substitute for
having read the diff.

## Before you start

- Check [`docs/implementation-plan.md`](docs/implementation-plan.md) first —
  it tracks what's done, in progress, and speced-but-not-built (currently
  Phase 7 and Phase 10 are the open tracks). If what you want to build is
  already speced there, follow that spec rather than re-deriving the design;
  if it conflicts with something already in flight, say so in your issue/PR
  so work doesn't collide.
- For anything bigger than a small fix — a new endpoint, a new config shape,
  a new external integration — open an issue describing the approach before
  writing code. Bug fixes and small, obviously-correct improvements can just
  be a PR.

## Dev setup

```bash
git clone <your fork>
cd gatefold-album-companion
npm install
cp .env.example .env   # fill in SPOTIFY_CLIENT_ID at minimum
npm run dev            # server on :8888, Vite on :5173
```

Full first-run walkthrough (Spotify app, redirect URI, Discogs key) is in
the [README](README.md#run-it-development).

### Layout

npm workspaces monorepo:

| package | what |
|---|---|
| `packages/shared` | Zod schemas + shared types — the single source of truth for every API shape |
| `packages/server` | Fastify API — Spotify OAuth/token handling, config + review file I/O, external provider lookups (MusicBrainz/Wikipedia/Discogs/LRCLIB) |
| `packages/web` | React + Vite SPA (TanStack Query, React Router) |

The backend is the only filesystem writer and the only holder of Spotify
tokens; the browser never sees a token. Keep that boundary — don't add a
client-side path that touches `data/` or a Spotify credential directly.

## Making a change

What actually gates a merge today:

```bash
npm run typecheck   # tsc across all three workspaces
npm run build        # must build clean
npm test              # vitest
```

Be honest with yourself about `npm test`'s current state: there are no test
files in the repo yet (`vitest run --passWithNoTests` passes trivially).
Adding real Vitest coverage for whatever you touch is genuinely welcome and
appreciated, not just tolerated — but it isn't enforced today, so don't take
a green `npm test` as proof a change works. There's also an `npm run lint`
script (`eslint .`) with no committed ESLint config yet and no CI step for
it — don't rely on it catching anything right now.

For anything with a UI surface, **run it in a real browser** before opening
the PR — this project has been burned before by changes that typechecked and
built clean but were never actually clicked through (see Phase 7 in the
implementation plan). [`docs/acceptance-tests.md`](docs/acceptance-tests.md)
has a manual scenario suite; run the scenarios relevant to what you touched.

If you change or add an API route: the Zod schema in
`packages/shared/src/dto.ts` (or `config.ts`/`review.ts`) is the contract —
routes should validate against it via `fastify-type-provider-zod`
(`body`/`params`/`querystring`/`response` on the route schema), not a manual
`schema.parse()` call in the handler. The OpenAPI docs at `/docs` and
[`INSTRUCTIONS_FOR_AGENTS.md`](INSTRUCTIONS_FOR_AGENTS.md) are both generated
from / describe that same contract — a shape change there is a real, visible
break for anyone (human or agent) calling the API directly, not just an
internal refactor. Call that out in the PR description.

## Code style

There's no linter enforcing this yet, so it's convention, observed from the
existing code rather than written down anywhere else until now:

- No comments explaining *what* code does — names should already say that.
  A comment earns its place only for a non-obvious *why* (a workaround, a
  constraint from an external API, a subtlety that would surprise a reader).
- Small, focused diffs. A bug fix doesn't need a drive-by refactor bundled
  in; a new feature doesn't need speculative abstraction for cases that
  don't exist yet.
- Match the Tailwind utility-class style already in `packages/web` rather
  than introducing a new styling approach (CSS modules, styled-components,
  etc.) for one component.
- New runtime dependencies are a real conversation, not a given — this is a
  single Docker image meant to stay small and easy to audit (see the Docker
  image hardening items in Phase 10.1 of the implementation plan for why
  that's currently taken seriously).

## Commit messages

The history is mostly [Conventional Commits](https://www.conventionalcommits.org/)
style — `type(scope): summary`, e.g. `fix(auth): ...`, `feat(api): ...`,
`chore(release): ...`. Not rigidly enforced, but it's the pattern to match;
`git log --oneline` is the best reference.

## Docs

If your change affects self-hosting (Docker, env vars, redirect URIs),
update [`docs/self-hosting.md`](docs/self-hosting.md) and the README's
self-hosting section — don't let those drift from what the code actually
does. If your change closes an item that's tracked with a checkbox in
`docs/implementation-plan.md`, check it off in the same PR.

## Reporting a security issue

Please don't open a public issue for a vulnerability. Use GitHub's private
vulnerability reporting (repo → **Security** tab → **Report a vulnerability**)
if it's enabled on this repo, so it can be assessed before details are
public.

## License

Gatefold is [AGPL-3.0-only](LICENSE). By submitting a contribution, you
agree it's licensed under the same terms as the rest of the project — the
standard "inbound = outbound" assumption for a project without a separate
CLA. If you run a modified version of Gatefold as a network service, the
AGPL requires you to make your changes available; that's the one boundary
that actually matters here.

## Releases

Versioning and publishing (the tag, the Docker image push to GHCR, the
GitHub release) are handled by the maintainer as a separate step — you don't
need to bump versions or touch release workflow files in a feature PR.
