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
import { loadKnownAlbums } from "../known-albums.js";
import { renderLinkTemplates } from "../links.js";
import { getLyrics } from "../lyrics/lrclib.js";
import { mapLimit } from "../mapLimit.js";
import { getPopularTrackIds } from "../popular-tracks.js";
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

/** Cards shown in the Similar Albums strip (Miller's Law) — the candidate
 *  pool is now bigger than this (Phase 12.2's multi-album-per-artist
 *  fetch), so this caps display, not fetch. */
const SIMILAR_DISPLAY_CAP = 10;

const toAlbumTrack = (t: RawAlbumTrack, popularIds: Set<string>): AlbumTrack => ({
  id: t.id,
  name: t.name,
  uri: t.uri,
  artists: (t.artists ?? []).map((a) => a.name),
  durationMs: t.duration_ms,
  trackNumber: t.track_number ?? null,
  discNumber: t.disc_number ?? null,
  explicit: Boolean(t.explicit),
  isPopular: popularIds.has(t.id),
});

async function buildDetail(
  raw: RawAlbum,
  tracks: RawAlbumTrack[],
): Promise<AlbumDetail> {
  const artist = raw.artists?.[0]?.name ?? "";
  const [backlog, popularIds] = await Promise.all([
    readConfig("backlog"),
    getPopularTrackIds(raw.id, artist, tracks),
  ]);
  const mapped = tracks.map((t) => toAlbumTrack(t, popularIds));
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

      // Backlog/Revisit/Reviews change constantly — resolved fresh here,
      // never baked into getSimilarAlbumIds's 30-day cache.
      const [rawAlbums, known] = await Promise.all([
        getAlbums(ids),
        loadKnownAlbums(),
      ]);

      const candidates = ids
        .map((i) => rawAlbums.get(i))
        .filter((a): a is RawAlbum => a !== undefined)
        .map((a) => ({
          album: toAlbumSummary(a),
          status: known.status(a.id),
          verdict: known.verdict(a.id),
        }));

      // "new" first so fresh recommendations aren't buried under ones
      // already actioned; still shown, not dropped (Phase 12.2).
      const albums = [
        ...candidates.filter((c) => c.status === "new"),
        ...candidates.filter((c) => c.status !== "new"),
      ].slice(0, SIMILAR_DISPLAY_CAP);

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
