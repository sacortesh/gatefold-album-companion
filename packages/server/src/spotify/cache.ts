import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CACHE_DIR } from "../paths.js";

/**
 * Tiny on-disk cache for immutable-ish Spotify GETs (albums, tracks, playlist
 * snapshots). Scaffold for Phases 3–5; unused in Phase 1.
 */
const DIR = path.join(CACHE_DIR, "spotify");

interface Entry<T> {
  at: number;
  data: T;
}

const keyToFile = (key: string): string =>
  path.join(DIR, `${createHash("sha1").update(key).digest("hex")}.json`);

export async function getCached<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const entry = JSON.parse(await readFile(keyToFile(key), "utf8")) as Entry<T>;
    return Date.now() - entry.at <= ttlMs ? entry.data : null;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, data: T): Promise<void> {
  await mkdir(DIR, { recursive: true });
  const entry: Entry<T> = { at: Date.now(), data };
  await writeFile(keyToFile(key), JSON.stringify(entry), "utf8");
}
