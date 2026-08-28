import type { AlbumSummary } from "@spotify-companion/shared";
import { getCached, setCached } from "./cache.js";
import { spotifyRequest } from "./client.js";

interface RawAlbum {
  id: string;
  name: string;
  uri: string;
  album_type?: string;
  release_date?: string;
  total_tracks: number;
  images?: Array<{ url: string; width: number | null }>;
  artists?: Array<{ name: string }>;
  tracks?: { items?: Array<{ duration_ms: number }>; total?: number };
}

const ALBUM_TTL_MS = 7 * 24 * 3600_000; // albums are effectively immutable

const yearOf = (releaseDate?: string): string | null =>
  releaseDate ? releaseDate.slice(0, 4) : null;

const durationOf = (raw: RawAlbum): number | null => {
  const items = raw.tracks?.items;
  if (!items?.length) return null;
  return items.reduce((sum, t) => sum + t.duration_ms, 0);
};

export function toAlbumSummary(raw: RawAlbum): AlbumSummary {
  return {
    id: raw.id,
    name: raw.name,
    uri: raw.uri,
    artists: (raw.artists ?? []).map((a) => a.name),
    image: raw.images?.[0]?.url ?? null,
    year: yearOf(raw.release_date),
    totalTracks: raw.total_tracks,
    durationMs: durationOf(raw),
  };
}

export async function getAlbum(id: string): Promise<RawAlbum> {
  const key = `album:${id}`;
  const cached = await getCached<RawAlbum>(key, ALBUM_TTL_MS);
  if (cached) return cached;
  const raw = await spotifyRequest<RawAlbum>({ path: `/albums/${id}` });
  await setCached(key, raw);
  return raw;
}

/** Batch fetch, using the per-album cache and `/albums?ids=` (20 max) for misses. */
export async function getAlbums(ids: string[]): Promise<Map<string, RawAlbum>> {
  const out = new Map<string, RawAlbum>();
  const missing: string[] = [];

  for (const id of ids) {
    const cached = await getCached<RawAlbum>(`album:${id}`, ALBUM_TTL_MS);
    if (cached) out.set(id, cached);
    else missing.push(id);
  }

  for (let i = 0; i < missing.length; i += 20) {
    const group = missing.slice(i, i + 20);
    const res = await spotifyRequest<{ albums: Array<RawAlbum | null> }>({
      path: "/albums",
      query: { ids: group.join(",") },
    });
    for (const raw of res.albums) {
      if (!raw) continue;
      out.set(raw.id, raw);
      await setCached(`album:${raw.id}`, raw);
    }
  }

  return out;
}

export async function searchAlbums(
  q: string,
  limit = 20,
): Promise<AlbumSummary[]> {
  const res = await spotifyRequest<{ albums?: { items: RawAlbum[] } }>({
    path: "/search",
    query: { q, type: "album", limit },
  });
  return (res.albums?.items ?? []).map(toAlbumSummary);
}

/** Accepts a bare id, `spotify:album:ID`, or an open.spotify.com/album/ID URL. */
export function parseAlbumId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
  const uri = trimmed.match(/spotify:album:([A-Za-z0-9]{22})/);
  if (uri) return uri[1] ?? null;
  const url = trimmed.match(/open\.spotify\.com\/album\/([A-Za-z0-9]{22})/);
  if (url) return url[1] ?? null;
  return null;
}
