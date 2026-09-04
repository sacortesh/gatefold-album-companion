import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CACHE_DIR } from "./paths.js";

interface Entry<T> {
  at: number;
  data: T;
}

/** A namespaced on-disk JSON cache under `data/cache/<namespace>/`. */
export function makeCache(namespace: string) {
  const dir = path.join(CACHE_DIR, namespace);
  const fileFor = (key: string) =>
    path.join(dir, `${createHash("sha1").update(key).digest("hex")}.json`);

  return {
    async get<T>(key: string, ttlMs: number): Promise<T | null> {
      try {
        const entry = JSON.parse(
          await readFile(fileFor(key), "utf8"),
        ) as Entry<T>;
        return Date.now() - entry.at <= ttlMs ? entry.data : null;
      } catch {
        return null;
      }
    },
    async set<T>(key: string, data: T): Promise<void> {
      await mkdir(dir, { recursive: true });
      const entry: Entry<T> = { at: Date.now(), data };
      await writeFile(fileFor(key), JSON.stringify(entry), "utf8");
    },
  };
}

/** Wipes every namespace under `data/cache/` — Spotify album lookups,
 *  MusicBrainz/Wikipedia/Discogs/Cover-Art-Archive context, LRCLIB lyrics
 *  (including cached misses, e.g. a wrong match that's since been fixed
 *  upstream), Last.fm similar-artist resolutions, and the update-check.
 *  Nothing here is user data (reviews/backlog/revisit are separate config
 *  files) — everything just gets refetched lazily on next access. */
export async function clearAllCaches(): Promise<void> {
  await rm(CACHE_DIR, { recursive: true, force: true });
}
