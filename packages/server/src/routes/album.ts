import type { FastifyInstance } from "fastify";
import type {
  AlbumDetail,
  AlbumLyricsResponse,
  AlbumTrack,
} from "@spotify-companion/shared";
import { getLyrics } from "../lyrics/lrclib.js";
import {
  getAlbum,
  getAlbumTracks,
  type RawAlbum,
  type RawAlbumTrack,
} from "../spotify/albums.js";
import { readConfig } from "../store/config.js";

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

const toAlbumTrack = (t: RawAlbumTrack): AlbumTrack => ({
  id: t.id,
  name: t.name,
  uri: t.uri,
  artists: (t.artists ?? []).map((a) => a.name),
  durationMs: t.duration_ms,
  trackNumber: t.track_number ?? null,
  discNumber: t.disc_number ?? null,
  explicit: Boolean(t.explicit),
});

async function buildDetail(
  raw: RawAlbum,
  tracks: RawAlbumTrack[],
): Promise<AlbumDetail> {
  const backlog = await readConfig("backlog");
  const mapped = tracks.map(toAlbumTrack);
  return {
    id: raw.id,
    name: raw.name,
    uri: raw.uri,
    artists: (raw.artists ?? []).map((a) => a.name),
    image: raw.images?.[0]?.url ?? null,
    year: raw.release_date?.slice(0, 4) ?? null,
    releaseDate: raw.release_date ?? null,
    label: raw.label ?? null,
    popularity: raw.popularity ?? null,
    totalTracks: raw.total_tracks,
    durationMs: mapped.reduce((s, t) => s + t.durationMs, 0),
    genres: raw.genres ?? [],
    copyrights: (raw.copyrights ?? []).map((c) => c.text),
    tracks: mapped,
    inBacklog: backlog.items.some((i) => i.albumId === raw.id),
  };
}

export async function albumRoutes(app: FastifyInstance): Promise<void> {
  app.get("/album/:id", async (req): Promise<AlbumDetail> => {
    const { id } = req.params as { id: string };
    const raw = await getAlbum(id);
    const tracks = await getAlbumTracks(raw);
    return buildDetail(raw, tracks);
  });

  app.get("/album/:id/lyrics", async (req): Promise<AlbumLyricsResponse> => {
    const { id } = req.params as { id: string };
    const raw = await getAlbum(id);
    const tracks = await getAlbumTracks(raw);
    const albumArtist = raw.artists?.[0]?.name ?? "";

    const entries = await mapLimit(tracks, 5, async (t) => {
      const lyrics = await getLyrics({
        trackId: t.id,
        artist: t.artists?.[0]?.name ?? albumArtist,
        track: t.name,
        album: raw.name,
        durationMs: t.duration_ms,
      });
      return [t.id, lyrics] as const;
    });

    return { lyrics: Object.fromEntries(entries) };
  });
}
