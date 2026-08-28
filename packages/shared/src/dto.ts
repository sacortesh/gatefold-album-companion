import { z } from "zod";

/** `GET /api/health` */
export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("spotify-companion"),
  version: z.string(),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Uniform error body for every `/api/*` failure. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** `GET /api/auth/status` */
export const authStatusSchema = z.object({
  /** True when a usable refresh token is on disk and the last token call worked. */
  connected: z.boolean(),
  /** Granted scopes, empty when disconnected. */
  scopes: z.array(z.string()),
  /** ISO timestamp the in-memory access token expires, or null. */
  expiresAt: z.string().nullable(),
  /** Present when connected and the `/me` probe succeeded. */
  user: z
    .object({
      id: z.string(),
      displayName: z.string().nullable(),
    })
    .nullable(),
  /** True only when Spotify client id/secret are configured in `.env`. */
  configured: z.boolean(),
});
export type AuthStatus = z.infer<typeof authStatusSchema>;

// --- Phase 2: playback ------------------------------------------------

export const deviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  isActive: z.boolean(),
  isRestricted: z.boolean(),
  volumePercent: z.number().nullable(),
});
export type Device = z.infer<typeof deviceSchema>;

export const devicesResponseSchema = z.object({
  devices: z.array(deviceSchema),
});
export type DevicesResponse = z.infer<typeof devicesResponseSchema>;

export const nowPlayingTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  durationMs: z.number(),
  artists: z.array(z.string()),
  album: z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    totalTracks: z.number().nullable(),
  }),
  trackNumber: z.number().nullable(),
  discNumber: z.number().nullable(),
});
export type NowPlayingTrack = z.infer<typeof nowPlayingTrackSchema>;

export const repeatModeSchema = z.enum(["off", "track", "context"]);

export const playbackStateSchema = z.object({
  isPlaying: z.boolean(),
  device: deviceSchema.nullable(),
  track: nowPlayingTrackSchema.nullable(),
  progressMs: z.number(),
  /** Playing context, e.g. `spotify:album:…` or `spotify:playlist:…`. */
  contextUri: z.string().nullable(),
  contextType: z.string().nullable(),
  shuffle: z.boolean(),
  repeat: repeatModeSchema,
  /** Server timestamp of this snapshot — the client extrapolates progress from it. */
  fetchedAt: z.string(),
});
export type PlaybackState = z.infer<typeof playbackStateSchema>;

export const playRequestSchema = z.object({
  contextUri: z.string().optional(),
  uris: z.array(z.string()).optional(),
  offset: z
    .object({ position: z.number().optional(), uri: z.string().optional() })
    .optional(),
  positionMs: z.number().optional(),
  deviceId: z.string().optional(),
});
export type PlayRequest = z.infer<typeof playRequestSchema>;

export const seekRequestSchema = z.object({
  positionMs: z.number().int().min(0),
  deviceId: z.string().optional(),
});
export type SeekRequest = z.infer<typeof seekRequestSchema>;

export const transferRequestSchema = z.object({
  deviceId: z.string().min(1),
  play: z.boolean().optional(),
});
export type TransferRequest = z.infer<typeof transferRequestSchema>;

export const okSchema = z.object({ ok: z.literal(true) });
export type Ok = z.infer<typeof okSchema>;

// --- Phase 3: Like + Banger -----------------------------------------

/** Lightweight track reference used by the recently-listened list. */
export const trackRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  artists: z.array(z.string()),
  albumName: z.string(),
  image: z.string().nullable(),
  durationMs: z.number(),
});
export type TrackRef = z.infer<typeof trackRefSchema>;

export const recentRowSchema = z.object({
  track: trackRefSchema,
  /** ISO timestamp from Spotify; null for the currently-playing row. */
  playedAt: z.string().nullable(),
  isCurrent: z.boolean(),
  liked: z.boolean(),
  inBanger: z.boolean(),
});
export type RecentRow = z.infer<typeof recentRowSchema>;

export const recentResponseSchema = z.object({
  rows: z.array(recentRowSchema),
  bangerPlaylistId: z.string().nullable(),
  bangerLabel: z.string(),
  bangerAutoLike: z.boolean(),
});
export type RecentResponse = z.infer<typeof recentResponseSchema>;

export const trackIdRequestSchema = z.object({ trackId: z.string().min(1) });
export type TrackIdRequest = z.infer<typeof trackIdRequestSchema>;

export const bangerResponseSchema = z.object({
  ok: z.literal(true),
  addedToPlaylist: z.boolean(),
  liked: z.boolean(),
});
export type BangerResponse = z.infer<typeof bangerResponseSchema>;

export const playlistLiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  trackCount: z.number(),
  ownerName: z.string(),
  image: z.string().nullable(),
});
export type PlaylistLite = z.infer<typeof playlistLiteSchema>;

export const playlistsResponseSchema = z.object({
  playlists: z.array(playlistLiteSchema),
});
export type PlaylistsResponse = z.infer<typeof playlistsResponseSchema>;
