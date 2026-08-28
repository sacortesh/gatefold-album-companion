import type { AlbumSummary, PlaylistLite } from "@spotify-companion/shared";
import { spotifyRequest } from "./client.js";
import { getMe } from "./client.js";

/** Accepts a bare id, `spotify:playlist:ID`, or an open.spotify.com/playlist/ID URL. */
export function parsePlaylistId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9]{22}$/.test(s)) return s;
  return (
    s.match(/spotify:playlist:([A-Za-z0-9]{22})/)?.[1] ??
    s.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})/)?.[1] ??
    null
  );
}

interface RawSimpleAlbum {
  id: string | null;
  name: string;
  uri: string;
  album_type?: string;
  release_date?: string;
  total_tracks?: number;
  images?: Array<{ url: string; width: number | null }>;
  artists?: Array<{ name: string }>;
}

export interface PlaylistAlbumsResult {
  name: string;
  albums: Array<{ album: AlbumSummary; trackCount: number }>;
}

const smallestImage = (
  images?: Array<{ url: string; width: number | null }>,
): string | null => {
  if (!images?.length) return null;
  return [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0]?.url ?? null;
};

/**
 * Distinct **albums** (not singles / compilations) behind a playlist's tracks,
 * with a count of how many tracks each contributes. Insertion order preserved.
 */
export async function getPlaylistAlbums(
  playlistId: string,
): Promise<PlaylistAlbumsResult> {
  const meta = await spotifyRequest<{ name: string }>({
    path: `/playlists/${playlistId}`,
    query: { fields: "name" },
  });

  const order: string[] = [];
  // Keyed by name+artist, not id — Spotify carries the same album under several
  // ids (remasters, regional variants) and we don't want to list it twice.
  const byKey = new Map<string, { album: AlbumSummary; trackCount: number }>();
  const keyOf = (a: RawSimpleAlbum) =>
    `${a.name}|${(a.artists ?? []).map((x) => x.name).join(",")}`
      .toLowerCase()
      .trim();

  for (let offset = 0; ; offset += 100) {
    const page = await spotifyRequest<{
      items: Array<{
        is_local?: boolean;
        track: { album?: RawSimpleAlbum | null } | null;
      }>;
      next: string | null;
    }>({
      path: `/playlists/${playlistId}/tracks`,
      query: {
        limit: 100,
        offset,
        fields:
          "next,items(is_local,track(album(id,name,uri,album_type,release_date,total_tracks,images,artists(name))))",
      },
    });

    for (const it of page.items) {
      const raw = it.track?.album;
      if (it.is_local || !raw?.id || raw.album_type !== "album") continue;
      const key = keyOf(raw);
      const existing = byKey.get(key);
      if (existing) {
        existing.trackCount += 1;
        continue;
      }
      order.push(key);
      byKey.set(key, {
        trackCount: 1,
        album: {
          id: raw.id,
          name: raw.name,
          uri: raw.uri,
          artists: (raw.artists ?? []).map((a) => a.name),
          image: smallestImage(raw.images),
          year: raw.release_date?.slice(0, 4) ?? null,
          totalTracks: raw.total_tracks ?? 0,
          durationMs: null,
        },
      });
    }
    if (!page.next) break;
  }

  return { name: meta.name, albums: order.map((key) => byKey.get(key)!) };
}

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
