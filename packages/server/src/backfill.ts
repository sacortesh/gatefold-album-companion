import { getAlbumContext, type AlbumContextInput } from "./context/index.js";
import { mapLimit } from "./mapLimit.js";
import { getAlbums } from "./spotify/albums.js";
import { readConfig } from "./store/config.js";
import { readAllReviews } from "./store/reviews.js";

const CONCURRENCY = 3;

/** Every distinct (artist, album) the app currently references across
 *  Backlog, Revisit, and Reviews — deduped, so an album appearing in more
 *  than one list (e.g. reviewed *and* still queued for revisit) isn't
 *  fetched twice. Reviews already carry artist/album as plain strings;
 *  Backlog/Revisit only carry a Spotify album id, so those need one
 *  `getAlbums` batch lookup first (cheap — same 7-day album cache already
 *  warmed by normal list views). */
async function collectContextInputs(): Promise<AlbumContextInput[]> {
  const [backlog, revisit, reviews] = await Promise.all([
    readConfig("backlog"),
    readConfig("revisit"),
    readAllReviews(),
  ]);

  const ids = [
    ...new Set([
      ...backlog.items.map((i) => i.albumId),
      ...revisit.items.map((i) => i.albumId),
    ]),
  ];
  const albums = ids.length ? await getAlbums(ids) : new Map();

  const fromIds: AlbumContextInput[] = ids
    .map((id) => albums.get(id))
    .filter((raw): raw is NonNullable<typeof raw> => Boolean(raw))
    .map((raw) => ({
      artist: raw.artists?.[0]?.name ?? "",
      album: raw.name,
      year: raw.release_date?.slice(0, 4) ?? null,
    }));

  const fromReviews: AlbumContextInput[] = reviews.map((r) => ({
    artist: r.artist,
    album: r.album,
    year: null,
  }));

  const seen = new Set<string>();
  return [...fromIds, ...fromReviews].filter((input) => {
    const key = `${input.artist}::${input.album}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** One-time catch-up for albums added before Phase 10.22 started warming
 *  genres/context on backlog add: kicks off a concurrency-capped fetch for
 *  every album Backlog/Revisit/Reviews currently references and returns
 *  the queued count immediately — the fetches themselves continue
 *  unawaited in the background, same as a fresh add does. Safe to run
 *  repeatedly: `getAlbumContext` no-ops on anything already cached, and
 *  retries anything that previously found nothing (e.g. Discogs wasn't
 *  configured yet at the time). */
export async function backfillGenres(): Promise<number> {
  const inputs = await collectContextInputs();
  void mapLimit(inputs, CONCURRENCY, (input) =>
    getAlbumContext(input).catch(() => {}),
  );
  return inputs.length;
}
