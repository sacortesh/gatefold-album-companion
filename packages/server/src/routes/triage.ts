import type { FastifyInstance } from "fastify";
import {
  bangerResponseSchema,
  okSchema,
  playlistsResponseSchema,
  recentResponseSchema,
  trackIdRequestSchema,
  trackStatesQuerySchema,
  trackStatesResponseSchema,
  type BangerResponse,
  type PlaylistsResponse,
  type RecentResponse,
  type TrackRef,
  type TrackStatesResponse,
} from "@gatefold/shared";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { AppError } from "../errors.js";
import {
  areTracksSaved,
  isTrackSaved,
  removeSavedTrack,
  saveTrack,
} from "../spotify/library.js";
import { getPlayback } from "../spotify/player.js";
import {
  addTrackToPlaylist,
  getEditablePlaylists,
  getPlaylistTrackIds,
  removeTrackFromPlaylist,
} from "../spotify/playlists.js";
import { getRecentlyPlayed } from "../spotify/recent.js";
import { readConfig } from "../store/config.js";

const emptySet = (): Set<string> => new Set<string>();

/** NowPlayingTrack (Phase 2 DTO) → TrackRef (Phase 3 DTO). */
function nowPlayingToRef(t: NonNullable<
  Awaited<ReturnType<typeof getPlayback>>["track"]
>): TrackRef {
  return {
    id: t.id,
    name: t.name,
    uri: t.uri,
    artists: t.artists,
    albumName: t.album.name,
    image: t.album.image,
    durationMs: t.durationMs,
  };
}

export async function triageRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/recent",
    { schema: { response: { 200: recentResponseSchema } } },
    async (): Promise<RecentResponse> => {
      const buttons = await readConfig("buttons");
      const bangerPlaylistId = buttons.banger.playlistId || null;

      const [playback, recent] = await Promise.all([
        getPlayback(),
        getRecentlyPlayed(50),
      ]);

      const ordered: Array<{
        track: TrackRef;
        playedAt: string | null;
        isCurrent: boolean;
      }> = [];
      const seen = new Set<string>();

      if (playback.track) {
        ordered.push({
          track: nowPlayingToRef(playback.track),
          playedAt: null,
          isCurrent: true,
        });
        seen.add(playback.track.id);
      }
      for (const p of recent) {
        if (seen.has(p.track.id)) continue;
        seen.add(p.track.id);
        ordered.push({ track: p.track, playedAt: p.playedAt, isCurrent: false });
      }

      const ids = ordered.map((o) => o.track.id);
      const [savedMap, bangerIds] = await Promise.all([
        ids.length
          ? areTracksSaved(ids)
          : Promise.resolve({} as Record<string, boolean>),
        bangerPlaylistId
          ? getPlaylistTrackIds(bangerPlaylistId).catch(emptySet)
          : Promise.resolve(emptySet()),
      ]);

      return {
        rows: ordered.map((o) => ({
          ...o,
          liked: savedMap[o.track.id] ?? false,
          inBanger: bangerIds.has(o.track.id),
        })),
        bangerPlaylistId,
        bangerLabel: buttons.banger.label,
        bangerAutoLike: buttons.banger.autoLike,
      };
    },
  );

  typed.post(
    "/like",
    { schema: { body: trackIdRequestSchema, response: { 200: okSchema } } },
    async (req) => {
      await saveTrack(req.body.trackId);
      return { ok: true as const };
    },
  );

  typed.delete(
    "/like",
    { schema: { body: trackIdRequestSchema, response: { 200: okSchema } } },
    async (req) => {
      await removeSavedTrack(req.body.trackId);
      return { ok: true as const };
    },
  );

  typed.post(
    "/banger",
    {
      schema: {
        body: trackIdRequestSchema,
        response: { 200: bangerResponseSchema },
      },
    },
    async (req): Promise<BangerResponse> => {
      const { trackId } = req.body;
      const buttons = await readConfig("buttons");
      const playlistId = buttons.banger.playlistId;
      if (!playlistId) {
        throw new AppError(
          "no_banger_playlist",
          "No Banger playlist set — choose one in Settings.",
          409,
        );
      }

      const existing = await getPlaylistTrackIds(playlistId).catch(
        (err: unknown) => {
          if (err instanceof AppError && err.statusCode === 404) {
            throw new AppError(
              "banger_playlist_error",
              "The Banger playlist no longer exists — pick another in Settings.",
              409,
            );
          }
          throw err;
        },
      );

      let addedToPlaylist = false;
      if (!existing.has(trackId)) {
        await addTrackToPlaylist(playlistId, trackId);
        addedToPlaylist = true;
      }

      let liked = false;
      if (buttons.banger.autoLike) {
        if (!(await isTrackSaved(trackId))) await saveTrack(trackId);
        liked = true;
      }

      return { ok: true, addedToPlaylist, liked };
    },
  );

  typed.delete(
    "/banger",
    { schema: { body: trackIdRequestSchema, response: { 200: okSchema } } },
    async (req) => {
      const { trackId } = req.body;
      const buttons = await readConfig("buttons");
      const playlistId = buttons.banger.playlistId;
      if (!playlistId) {
        throw new AppError(
          "no_banger_playlist",
          "No Banger playlist set — choose one in Settings.",
          409,
        );
      }

      await removeTrackFromPlaylist(playlistId, trackId).catch(
        (err: unknown) => {
          if (err instanceof AppError && err.statusCode === 404) {
            throw new AppError(
              "banger_playlist_error",
              "The Banger playlist no longer exists — pick another in Settings.",
              409,
            );
          }
          throw err;
        },
      );

      // Deliberately doesn't touch the Like — un-bangering a track is about
      // the playlist membership, not about undoing a Like the user may
      // still want, even if autoLike added it as a side effect originally.
      return { ok: true as const };
    },
  );

  typed.get(
    "/playlists",
    { schema: { response: { 200: playlistsResponseSchema } } },
    async (): Promise<PlaylistsResponse> => ({
      playlists: await getEditablePlaylists(),
    }),
  );

  typed.get(
    "/track-states",
    {
      schema: {
        querystring: trackStatesQuerySchema,
        response: { 200: trackStatesResponseSchema },
      },
    },
    async (req): Promise<TrackStatesResponse> => {
      const ids = (req.query.ids ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100);

      const buttons = await readConfig("buttons");
      const bangerPlaylistId = buttons.banger.playlistId || null;

      const [saved, bangerIds] = await Promise.all([
        ids.length
          ? areTracksSaved(ids)
          : Promise.resolve({} as Record<string, boolean>),
        bangerPlaylistId
          ? getPlaylistTrackIds(bangerPlaylistId).catch(emptySet)
          : Promise.resolve(emptySet()),
      ]);

      return {
        bangerPlaylistId,
        bangerLabel: buttons.banger.label,
        bangerAutoLike: buttons.banger.autoLike,
        states: Object.fromEntries(
          ids.map((id) => [
            id,
            { liked: saved[id] ?? false, inBanger: bangerIds.has(id) },
          ]),
        ),
      };
    },
  );
}
