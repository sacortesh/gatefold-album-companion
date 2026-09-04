import { readFile } from "node:fs/promises";
import path from "node:path";
import type { VersionResponse } from "@gatefold/shared";
import { makeCache } from "./cache.js";
import { ROOT } from "./paths.js";

const REPO = "sacortesh/gatefold-album-companion";
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const USER_AGENT = `gatefold (+https://github.com/${REPO})`;

const cache = makeCache("meta");
const CACHE_KEY = "latest-release";
// GitHub's unauthenticated rate limit is 60 req/hour/IP — this app is
// single-user and self-hosted, so even zero caching would stay nowhere
// near that. 30 minutes is just enough cushion to survive a burst of
// page loads/devices without ever risking the limit, while keeping a
// freshly-shipped release from reading as stale for hours.
const TTL_MS = 30 * 60_000;

interface GhRelease {
  tag_name: string;
  html_url: string;
}

interface LatestRelease {
  version: string;
  url: string;
}

export async function readCurrentVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(
      await readFile(path.join(ROOT, "package.json"), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function fetchLatestRelease(): Promise<LatestRelease | null> {
  const cached = await cache.get<{ release: LatestRelease | null }>(
    CACHE_KEY,
    TTL_MS,
  );
  if (cached) return cached.release;

  let release: LatestRelease | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(RELEASES_URL, {
        headers: { "user-agent": USER_AGENT, accept: "application/vnd.github+json" },
        signal: ctrl.signal,
      });
      if (res.ok) {
        const body = (await res.json()) as GhRelease;
        release = { version: body.tag_name.replace(/^v/, ""), url: body.html_url };
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn(
      "[version] GitHub releases check failed:",
      err instanceof Error ? err.message : err,
    );
  }

  // Cache a failed lookup too (release: null) so a down/rate-limited API
  // doesn't get hit on every request within the TTL.
  await cache.set(CACHE_KEY, { release });
  return release;
}

/** True when `a` is a newer semver than `b` (plain numeric compare, no pre-release handling). */
function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export async function getVersionInfo(): Promise<VersionResponse> {
  const [current, release] = await Promise.all([
    readCurrentVersion(),
    fetchLatestRelease(),
  ]);

  return {
    current,
    latest: release?.version ?? null,
    updateAvailable: release ? isNewer(release.version, current) : false,
    releaseUrl: release?.url ?? null,
  };
}
