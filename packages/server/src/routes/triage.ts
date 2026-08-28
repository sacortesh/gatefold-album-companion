import type { FastifyInstance } from "fastify";
import {
  trackIdRequestSchema,
  type BangerResponse,
  type PlaylistsResponse,
  type RecentResponse,
  type TrackRef,
  type TrackStatesResponse,
} from "@spotify-companion/shared";
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
  app.get("/recent", async (): Promise<RecentResponse> => {
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
  });

  app.post("/like", async (req) => {
    const { trackId } = trackIdRequestSchema.parse(req.body);
    await saveTrack(trackId);
    return { ok: true as const };
  });

  app.delete("/like", async (req) => {
    const { trackId } = trackIdRequestSchema.parse(req.body);
    await removeSavedTrack(trackId);
    return { ok: true as const };
  });

  app.post("/banger", async (req): Promise<BangerResponse> => {
    const { trackId } = trackIdRequestSchema.parse(req.body);
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
  });

  app.get("/playlists", async (): Promise<PlaylistsResponse> => ({
    playlists: await getEditablePlaylists(),
  }));

  app.get("/track-states", async (req): Promise<TrackStatesResponse> => {
    const ids = String((req.query as { ids?: string }).ids ?? "")
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
  });
}
