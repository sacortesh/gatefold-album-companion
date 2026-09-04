---
name: release
description: Walks through cutting a new Gatefold release — bump the version across the workspace, commit, tag, push, and confirm the GitHub Actions release workflow builds and publishes the Docker image + GitHub release. Use this whenever the user wants to "cut a release," "tag a new version," "ship vX.Y.Z," "publish a release," "bump the version and release," or otherwise wants to get a new version of this app out to ghcr.io. Also trigger if the user asks to check on a release that's already running (workflow status, whether the image published, whether GHCR packages are public) — this skill knows the whole pipeline, not just the tagging step.
---

# Cutting a Gatefold release

This project ships as a Docker image. A release is a git tag matching
`v*.*.*` pushed to `origin` — that alone triggers
`.github/workflows/release.yml`, which builds a multi-arch image, pushes
it to `ghcr.io/sacortesh/gatefold-album-companion:{version,latest}`, and
creates a GitHub release with auto-generated notes. There's no separate
"publish" step to remember; the tag *is* the trigger.

The one thing that makes this more than `git tag && git push` is that the
app's own update-check (`GET /api/version`) reads the version out of root
`package.json` and compares it against the latest GitHub release tag. If
those two drift apart, the in-app "update available" banner either never
fires or fires wrongly. So the version bump has to land in package.json
*before* the tag that names it.

Treat pushing the tag as the point of no return for this workflow: it's a
public action (a real GHCR image, a real GitHub release, both visible to
anyone with repo access) and once GitHub Actions picks it up you can't
un-trigger the run, only clean up after it. Everything before that push
is easily reversible; walk through it, but pause for an explicit go-ahead
right before the push step.

## 0. Preflight

Before touching any version numbers:

```bash
git status --short          # must be clean — no uncommitted work
git log --oneline -1        # confirm you're where you think you are
git tag -l                  # see what's already been released
npm run typecheck && npm run build   # must be green
```

If `git status` isn't clean, stop and ask the user what to do with the
outstanding changes rather than bundling them into the release commit
unasked.

## 1. Pick the version

Read the current version straight from the source of truth:

```bash
node -e "console.log(require('./package.json').version)"
```

All four `package.json` files (root + `packages/{shared,server,web}`)
are kept in lockstep in this repo, even though only the root one is
functionally read by `/api/health` and `/api/version` — ask the user
which kind of bump this is (patch / minor / major, semver) rather than
guessing, unless they already said the version explicitly (e.g. "release
v0.2.0"). Skim `git log --oneline <last-tag>..HEAD` (or the whole log, if
there's no tag yet) and `NOTES.md`'s most recent entries to help them
decide — new features imply at least a minor bump, pure fixes imply a
patch.

## 2. Bump every package.json + the lockfile together

```bash
npm version <newversion> --no-git-tag-version --workspaces --include-workspace-root
```

`--no-git-tag-version` matters — it stops npm from creating its own
commit/tag, since this workflow makes those explicitly in step 4.
`<newversion>` is the bare number, e.g. `0.2.0` (no leading `v` — npm
adds that itself in messages, but the file gets the bare number, which
is what `/api/version`'s comparison expects).

**Careful: `npm version ... --dry-run` is not an actual dry run** — in
testing this skill, `--dry-run` still wrote the bump to every
`package.json` and `package-lock.json`. If you want to preview without
committing to it, just read the command's stated intent instead of
running it, or run it for real and `git diff`/revert if it's wrong
(step 2 hasn't touched git yet, so `git checkout -- package.json
packages/*/package.json package-lock.json` cleanly undoes it).

Confirm the bump landed everywhere and nothing else moved:

```bash
git diff --stat
grep '"version"' package.json packages/*/package.json
```

## 3. Re-verify

```bash
npm run typecheck && npm run build
```

A version bump touches four JSON files and a lockfile — this should
never fail, but catching it now is free and confirming green is cheap
insurance before creating a public tag.

## 4. Commit and tag

```bash
git add package.json package-lock.json packages/shared/package.json \
        packages/server/package.json packages/web/package.json
git commit -m "chore(release): v<newversion>"
git tag -a "v<newversion>" -m "v<newversion>"
```

Use an annotated tag (`-a`) — it carries a message and an author, which
reads better in `git log` and in the GitHub release's tag view than a
lightweight tag would.

## 5. Push — confirm first

This is the point of no return: pushing the tag fires the GitHub Actions
workflow, which builds and publishes a public Docker image and creates a
public GitHub release. **Show the user the tag name and the commit it
points at, and get an explicit go-ahead before running the push.**

```bash
git push origin main
git push origin "v<newversion>"
```

(Two separate pushes on purpose — if the workflow needs to be re-run or
something's off, a pushed commit without a matching tag is inert, but a
pushed tag starts the pipeline immediately. Push main first so the tag's
commit is already on the remote.)

## 6. Watch the run

```bash
gh run list --workflow=release.yml -L 1
gh run watch                      # follow the in-progress run
```

If it fails, `gh run view --log-failed` shows why. Common first-release
failure: GHCR package visibility (see below) or the workflow not having
run at all yet if `packages: write` permission isn't enabled for Actions
on the repo — check **Settings → Actions → General → Workflow
permissions** if `docker/login-action` or the push step itself 403s.

## 7. Confirm the release actually shipped

```bash
gh release view "v<newversion>"
# The workflow strips the leading "v" before tagging the image
# (GITHUB_REF_NAME#v in release.yml's merge job) — the git tag is
# "v<newversion>" but the image tag is the bare "<newversion>". Pulling
# with the "v" prefix 404s even on a totally healthy release; don't
# mistake that for a GHCR-visibility problem (see below).
docker pull ghcr.io/sacortesh/gatefold-album-companion:<newversion>
```

**GHCR packages are private by default**, even on a public repo — that's
a GitHub default, not something the workflow controls. If the `docker
pull` above 401s for someone else (or for you, logged out), the package
needs its visibility flipped once: on GitHub, go to the package page
(`github.com/sacortesh?tab=packages`, or the link `gh release view`
prints), **Package settings → Change visibility → Public**. This is a
one-time setup step, not something that repeats per release.

## If something's wrong after pushing

Don't reach for `git tag -d` / force-push / deleting the GitHub release
as a reflex — walk through what's actually broken with the user first
(a bad build vs. a bad version number vs. a genuinely bad commit are
different problems), and only take the corresponding destructive step
once they've said what they want:

- **Wrong version number, build otherwise fine**: cut a new correct tag
  going forward; don't retroactively rewrite a public one.
- **Build itself is broken**: fix on `main`, then cut a new patch release
  — same reasoning, a shipped tag already may have been pulled by
  someone.
- **Tag was truly a mistake** (e.g. pushed before review) and nothing has
  consumed it yet: confirm with the user, then `git push --delete origin
  v<newversion>` + `git tag -d v<newversion>` + `gh release delete
  v<newversion>` + delete the now-orphaned package version from the GHCR
  package page. All four, or the tag/release/image drift out of sync
  with each other.
