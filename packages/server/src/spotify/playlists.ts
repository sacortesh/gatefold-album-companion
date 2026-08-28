import type { PlaylistLite } from "@spotify-companion/shared";
import { spotifyRequest } from "./client.js";
import { getMe } from "./client.js";

interface RawPlaylist {
  id: string;
  name: string;
  collaborative: boolean;
  owner: { id: string; display_name?: string | null };
  tracks: { total: number };
  images?: Array<{ url: string; width: number | null }> | null;
}

const mapPlaylist = (p: RawPlaylist): PlaylistLite => ({
  id: p.id,
  name: p.name,
  trackCount: p.tracks.total,
  ownerName: p.owner.display_name ?? p.owner.id,
  image: p.images?.[0]?.url ?? null,
});

/** The user's playlists they can add tracks to (owned or collaborative). */
export async function getEditablePlaylists(): Promise<PlaylistLite[]> {
  const me = await getMe();
  const out: PlaylistLite[] = [];

  for (let offset = 0; ; offset += 50) {
    const page = await spotifyRequest<{
      items: RawPlaylist[];
      next: string | null;
    }>({ path: "/me/playlists", query: { limit: 50, offset } });

    for (const p of page.items) {
      if (p.owner.id === me.id || p.collaborative) out.push(mapPlaylist(p));
    }
    if (!page.next) break;
  }
  return out;
}

// --- playlist membership, cached by snapshot_id ---------------------

interface Snapshot {
  snapshotId: string;
  trackIds: Set<string>;
  fetchedAt: number;
}
const membershipCache = new Map<string, Snapshot>();

/**
 * TTL on top of the snapshot check — Spotify's `GET /playlists/{id}` snapshot_id
 * can lag an external edit by a few seconds, so don't trust a match forever.
 */
const MEMBERSHIP_TTL_MS = 30_000;

/** All track ids in a playlist. Cached until the snapshot changes (or the TTL). */
export async function getPlaylistTrackIds(
  playlistId: string,
): Promise<Set<string>> {
  const meta = await spotifyRequest<{
    snapshot_id: string;
  }>({ path: `/playlists/${playlistId}`, query: { fields: "snapshot_id" } });

  const cached = membershipCache.get(playlistId);
  if (
    cached &&
    cached.snapshotId === meta.snapshot_id &&
    Date.now() - cached.fetchedAt < MEMBERSHIP_TTL_MS
  ) {
    return cached.trackIds;
  }

  const trackIds = new Set<string>();
  for (let offset = 0; ; offset += 100) {
    const page = await spotifyRequest<{
      items: Array<{ track: { id: string | null } | null }>;
      next: string | null;
    }>({
      path: `/playlists/${playlistId}/tracks`,
      query: { limit: 100, offset, fields: "items(track(id)),next" },
    });
    for (const it of page.items) if (it.track?.id) trackIds.add(it.track.id);
    if (!page.next) break;
  }

  membershipCache.set(playlistId, {
    snapshotId: meta.snapshot_id,
    trackIds,
    fetchedAt: Date.now(),
  });
  return trackIds;
}

export async function addTrackToPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  const res = await spotifyRequest<{ snapshot_id: string }>({
    method: "POST",
    path: `/playlists/${playlistId}/tracks`,
    body: { uris: [`spotify:track:${trackId}`] },
  });

  const cached = membershipCache.get(playlistId);
  if (cached) {
    cached.trackIds.add(trackId);
    cached.snapshotId = res.snapshot_id;
    cached.fetchedAt = Date.now();
  }
}
