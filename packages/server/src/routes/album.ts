import type { FastifyInstance } from "fastify";
import {
  albumContextSchema,
  albumDetailSchema,
  albumLyricsResponseSchema,
  idParamSchema,
  similarAlbumsResponseSchema,
  type AlbumContext,
  type AlbumDetail,
  type AlbumLyricsResponse,
  type AlbumTrack,
  type SimilarAlbumsResponse,
} from "@gatefold/shared";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { getAlbumContext } from "../context/index.js";
import { renderLinkTemplates } from "../links.js";
import { getLyrics } from "../lyrics/lrclib.js";
import { getSimilarAlbumIds } from "../similar-albums.js";
import {
  getAlbum,
  getAlbums,
  getAlbumTracks,
  toAlbumSummary,
  type RawAlbum,
  type RawAlbumTrack,
} from "../spotify/albums.js";
import { readConfig } from "../store/config.js";
import { readAllReviews } from "../store/reviews.js";

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
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/album/:id",
    { schema: { params: idParamSchema, response: { 200: albumDetailSchema } } },
    async (req): Promise<AlbumDetail> => {
      const { id } = req.params;
      const raw = await getAlbum(id);
      const tracks = await getAlbumTracks(raw);
      return buildDetail(raw, tracks);
    },
  );

  typed.get(
    "/album/:id/context",
    { schema: { params: idParamSchema, response: { 200: albumContextSchema } } },
    async (req): Promise<AlbumContext> => {
      const { id } = req.params;
      const raw = await getAlbum(id);
      const artist = raw.artists?.[0]?.name ?? "";
      const album = raw.name;

      // Templated links are user config, not provider data — rendered
      // fresh on every request rather than folded into the 30-day context
      // cache, so an edit in Settings shows up immediately instead of
      // waiting out a stale cache entry.
      const [context, links] = await Promise.all([
        getAlbumContext({
          artist,
          album,
          year: raw.release_date?.slice(0, 4) ?? null,
        }),
        readConfig("links"),
      ]);

      const templatedLinks = renderLinkTemplates(links.album, { artist, album });
      return {
        ...context,
        links: [...context.links, ...templatedLinks].filter(
          (l, i, all) => all.findIndex((x) => x.label === l.label) === i,
        ),
      };
    },
  );

  typed.get(
    "/album/:id/similar",
    {
      schema: {
        params: idParamSchema,
        response: { 200: similarAlbumsResponseSchema },
      },
    },
    async (req): Promise<SimilarAlbumsResponse> => {
      const { id } = req.params;
      const raw = await getAlbum(id);
      const artist = raw.artists?.[0]?.name ?? "";

      const ids = (await getSimilarAlbumIds(artist)).filter((i) => i !== id);
      if (ids.length === 0) return { albums: [] };

      // Backlog/Revisit/Reviews change constantly — filtered fresh here,
      // never baked into getSimilarAlbumIds's 30-day cache.
      const [rawAlbums, backlog, revisit, reviews] = await Promise.all([
        getAlbums(ids),
        readConfig("backlog"),
        readConfig("revisit"),
        readAllReviews(),
      ]);
      const known = new Set([
        ...backlog.items.map((i) => i.albumId),
        ...revisit.items.map((i) => i.albumId),
        ...reviews.map((r) => r.albumId),
      ]);

      const albums = ids
        .map((i) => rawAlbums.get(i))
        .filter((a): a is RawAlbum => a !== undefined && !known.has(a.id))
        .map(toAlbumSummary);

      return { albums };
    },
  );

  typed.get(
    "/album/:id/lyrics",
    {
      schema: {
        params: idParamSchema,
        response: { 200: albumLyricsResponseSchema },
      },
    },
    async (req): Promise<AlbumLyricsResponse> => {
      const { id } = req.params;
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
    },
  );
}
