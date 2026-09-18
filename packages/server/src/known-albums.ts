import { readConfig } from "./store/config.js";
import { readAllReviews } from "./store/reviews.js";
import type { PlaylistAlbumStatus, Verdict } from "@gatefold/shared";

/**
 * Resolves whether an album is `"new"` or something you've already acted
 * on — same status shape 10.13 introduced for playlist import, now shared
 * by playlist import, the Similar Albums strip (12.2), and the backlog
 * suggester (12.3) rather than each computing it separately. `reviewed`
 * wins over `in_revisit` when an album qualifies for both (e.g. a
 * "revisit" verdict also sits in the revisit queue) — the verdict itself
 * is the more informative reason.
 */
export interface KnownAlbums {
  status(albumId: string): PlaylistAlbumStatus;
  verdict(albumId: string): Verdict | null;
}

export async function loadKnownAlbums(): Promise<KnownAlbums> {
  const [backlog, revisit, reviews] = await Promise.all([
    readConfig("backlog"),
    readConfig("revisit"),
    readAllReviews(),
  ]);

  const inBacklog = new Set(backlog.items.map((i) => i.albumId));
  const inRevisit = new Set(revisit.items.map((i) => i.albumId));
  const verdictByAlbum = new Map(reviews.map((r) => [r.albumId, r.verdict]));

  const verdict = (albumId: string): Verdict | null =>
    verdictByAlbum.get(albumId) ?? null;

  const status = (albumId: string): PlaylistAlbumStatus => {
    if (verdict(albumId)) return "reviewed";
    if (inRevisit.has(albumId)) return "in_revisit";
    if (inBacklog.has(albumId)) return "in_backlog";
    return "new";
  };

  return {
    status,
    verdict: (albumId) => (status(albumId) === "reviewed" ? verdict(albumId) : null),
  };
}
