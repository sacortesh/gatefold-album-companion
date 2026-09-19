import { makeCache } from "../cache.js";
import type { Script } from "./romanize.js";

const cache = makeCache("album-language");
const TTL_MS = 30 * 24 * 3600_000;

/** Cache-only peek for list rows (Backlog/Revisit/Reviews, Phase 11.3) —
 *  mirrors `getCachedGenres`'s discipline: never triggers a fresh lyrics
 *  fetch, just returns `[]` until the album's lyrics have actually been
 *  fetched once (opening its page, or playing a track from it). */
export async function getCachedLanguages(albumId: string): Promise<Script[]> {
  return (await cache.get<Script[]>(albumId, TTL_MS)) ?? [];
}

/** Written by the `/album/:id/lyrics` route once it has fetched every
 *  track's lyrics — the distinct non-null scripts found across the album. */
export async function setCachedLanguages(
  albumId: string,
  scripts: Script[],
): Promise<void> {
  await cache.set(albumId, scripts);
}
