import { z } from "zod";
import { reviewSchema } from "./review.js";

/** `GET /api/health` */
export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("gatefold"),
  version: z.string(),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** `GET /api/version` — checked against GitHub releases, ~6h server-side cache. */
export const versionResponseSchema = z.object({
  current: z.string(),
  /** Null when no release was found or the GitHub API was unreachable. */
  latest: z.string().nullable(),
  updateAvailable: z.boolean(),
  releaseUrl: z.string().nullable(),
});
export type VersionResponse = z.infer<typeof versionResponseSchema>;

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
  /** True once a Spotify client id is set (in the UI or via env). */
  configured: z.boolean(),
  /** The redirect URI to register in the Spotify dashboard. */
  redirectUri: z.string(),
});
export type AuthStatus = z.infer<typeof authStatusSchema>;

/** `GET /api/settings/app` — never returns secrets, only whether they're set. */
export const appSettingsSchema = z.object({
  spotifyClientId: z.string(),
  publicUrl: z.string(),
  redirectUri: z.string(),
  discogsConfigured: z.boolean(),
  /** Required on every other `/api/*` call — shown for copy/paste into scripts. */
  apiKey: z.string(),
  uiAuth: z.object({
    enabled: z.boolean(),
    username: z.string(),
    passwordSet: z.boolean(),
  }),
  /** Fields pinned by an env var — the UI shows these read-only. */
  envLocked: z.object({
    spotifyClientId: z.boolean(),
    publicUrl: z.boolean(),
    discogs: z.boolean(),
  }),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

/** `PUT /api/settings/app` — omitted fields are left unchanged; env-locked fields are ignored. */
export const appSettingsUpdateSchema = z.object({
  spotifyClientId: z.string().optional(),
  publicUrl: z.string().optional(),
  discogsConsumerKey: z.string().optional(),
  discogsConsumerSecret: z.string().optional(),
});
export type AppSettingsUpdate = z.infer<typeof appSettingsUpdateSchema>;

/** `PUT /api/settings/ui-auth` — `password` only needs sending when setting/changing it. */
export const uiAuthUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().min(1).optional(),
});
export type UiAuthUpdate = z.infer<typeof uiAuthUpdateSchema>;

/** `POST /auth/ui-login` */
export const uiLoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type UiLoginRequest = z.infer<typeof uiLoginRequestSchema>;

/** `GET /auth/session` — the SPA calls this first; `apiKey` is only present
 *  once authenticated (or when UI auth is off), and is what unlocks `/api/*`. */
export const sessionStatusSchema = z.object({
  enabled: z.boolean(),
  authenticated: z.boolean(),
  apiKey: z.string().nullable(),
});
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

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
  /** Force shuffle to this state before starting playback (album listens pass `false`). */
  shuffle: z.boolean().optional(),
  /** Force repeat to this mode before starting playback. */
  repeat: repeatModeSchema.optional(),
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

// --- Phase 4: backlog + search -------------------------------------

export const albumSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  artists: z.array(z.string()),
  image: z.string().nullable(),
  year: z.string().nullable(),
  totalTracks: z.number(),
  /** Sum of known track durations; null when not available (search results). */
  durationMs: z.number().nullable(),
});
export type AlbumSummary = z.infer<typeof albumSummarySchema>;

export const backlogEntrySchema = z.object({
  albumId: z.string(),
  uri: z.string(),
  addedAt: z.string(),
  priority: z.number().int(),
  /** null when Spotify no longer returns the album. */
  album: albumSummarySchema.nullable(),
});
export type BacklogEntry = z.infer<typeof backlogEntrySchema>;

export const backlogResponseSchema = z.object({
  items: z.array(backlogEntrySchema),
});
export type BacklogResponse = z.infer<typeof backlogResponseSchema>;

export const addBacklogRequestSchema = z.object({
  /** Album id or any open.spotify.com / spotify:album: URL — resolved server-side. */
  album: z.string().min(1),
});
export type AddBacklogRequest = z.infer<typeof addBacklogRequestSchema>;

export const reorderBacklogRequestSchema = z.object({
  albumIds: z.array(z.string()),
});
export type ReorderBacklogRequest = z.infer<typeof reorderBacklogRequestSchema>;

export const bulkAddBacklogRequestSchema = z.object({
  albums: z.array(z.string().min(1)).min(1),
});
export type BulkAddBacklogRequest = z.infer<typeof bulkAddBacklogRequestSchema>;

export const searchResponseSchema = z.object({
  albums: z.array(albumSummarySchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

/** One album distilled out of a source playlist. */
export const playlistAlbumSchema = z.object({
  album: albumSummarySchema,
  /** How many of the playlist's tracks come from this album. */
  trackCount: z.number(),
  inBacklog: z.boolean(),
});
export type PlaylistAlbum = z.infer<typeof playlistAlbumSchema>;

export const playlistAlbumsResponseSchema = z.object({
  playlistName: z.string(),
  albums: z.array(playlistAlbumSchema),
});
export type PlaylistAlbumsResponse = z.infer<
  typeof playlistAlbumsResponseSchema
>;

// --- Phase 5: album view + lyrics ---------------------------------

export const albumTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  artists: z.array(z.string()),
  durationMs: z.number(),
  trackNumber: z.number().nullable(),
  discNumber: z.number().nullable(),
  explicit: z.boolean(),
});
export type AlbumTrack = z.infer<typeof albumTrackSchema>;

export const albumDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  artists: z.array(z.string()),
  image: z.string().nullable(),
  year: z.string().nullable(),
  releaseDate: z.string().nullable(),
  label: z.string().nullable(),
  popularity: z.number().nullable(),
  totalTracks: z.number(),
  durationMs: z.number(),
  genres: z.array(z.string()),
  copyrights: z.array(z.string()),
  tracks: z.array(albumTrackSchema),
  inBacklog: z.boolean(),
});
export type AlbumDetail = z.infer<typeof albumDetailSchema>;

export const lyricLineSchema = z.object({
  timeMs: z.number(),
  text: z.string(),
});
export type LyricLine = z.infer<typeof lyricLineSchema>;

export const trackLyricsSchema = z.object({
  source: z.literal("lrclib").nullable(),
  synced: z.array(lyricLineSchema).nullable(),
  plain: z.string().nullable(),
  instrumental: z.boolean(),
});
export type TrackLyrics = z.infer<typeof trackLyricsSchema>;

export const albumLyricsResponseSchema = z.object({
  /** keyed by track id */
  lyrics: z.record(z.string(), trackLyricsSchema),
});
export type AlbumLyricsResponse = z.infer<typeof albumLyricsResponseSchema>;

export const trackTriageStateSchema = z.object({
  liked: z.boolean(),
  inBanger: z.boolean(),
});
export type TrackTriageState = z.infer<typeof trackTriageStateSchema>;

export const trackStatesResponseSchema = z.object({
  bangerPlaylistId: z.string().nullable(),
  bangerLabel: z.string(),
  bangerAutoLike: z.boolean(),
  /** keyed by track id */
  states: z.record(z.string(), trackTriageStateSchema),
});
export type TrackStatesResponse = z.infer<typeof trackStatesResponseSchema>;

// --- Phase 6: revisit list ---------------------------------------

export const revisitEntrySchema = z.object({
  albumId: z.string(),
  addedAt: z.string(),
  album: albumSummarySchema.nullable(),
  review: reviewSchema.nullable(),
});
export type RevisitEntry = z.infer<typeof revisitEntrySchema>;

export const revisitResponseSchema = z.object({
  items: z.array(revisitEntrySchema),
});
export type RevisitResponse = z.infer<typeof revisitResponseSchema>;

// --- Phase 8 Rev-3: album context -------------------------------

export const albumContextCreditSchema = z.object({
  name: z.string(),
  roles: z.array(z.string()),
});
export type AlbumContextCredit = z.infer<typeof albumContextCreditSchema>;

export const albumContextLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

export const albumContextSchema = z.object({
  /** Prose on why the album matters, from Wikipedia. */
  summary: z.string().nullable(),
  summarySource: albumContextLinkSchema.nullable(),
  /** Personnel / credits, from Discogs, grouped by person. */
  credits: z.array(albumContextCreditSchema),
  /** Free-text release notes, from Discogs. */
  notes: z.string().nullable(),
  facts: z.object({
    firstReleased: z.string().nullable(),
    labels: z.array(z.string()),
    genres: z.array(z.string()),
    formats: z.array(z.string()),
  }),
  links: z.array(albumContextLinkSchema),
  /** Providers that actually contributed something. */
  sources: z.array(z.enum(["musicbrainz", "wikipedia", "discogs"])),
  /** True when Discogs creds aren't configured, so the UI can nudge. */
  discogsConfigured: z.boolean(),
});
export type AlbumContext = z.infer<typeof albumContextSchema>;

// --- Route params / querystrings (for OpenAPI docs + request validation) ---
// Kept separate from the response/body DTOs above since these describe
// *how a route is addressed*, not the shape of data it deals in.

export const idParamSchema = z.object({ id: z.string().min(1) });
export const albumIdParamSchema = z.object({ albumId: z.string().min(1) });
/** `/api/config/:name` — deliberately loose (just "a string"); the route
 *  validates it against the real `ConfigName` union itself and returns a
 *  friendly 404, rather than a generic Fastify validation error. */
export const configNameParamSchema = z.object({ name: z.string().min(1) });

export const searchQuerySchema = z.object({ q: z.string().optional() });
export const trackStatesQuerySchema = z.object({ ids: z.string().optional() });
export const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

/** Body for the playback controls that only ever look at `deviceId`
 *  (pause/next/previous) — narrower than `playRequestSchema`, whose other
 *  fields (`contextUri`, `shuffle`, ...) only mean something to `/play`. */
export const deviceIdRequestSchema = z.object({ deviceId: z.string().optional() });

export const disconnectResponseSchema = z.object({ connected: z.literal(false) });
export const reviewTemplateResponseSchema = z.object({ template: z.string() });
export const authDebugRequestSchema = z.object({
  action: z.enum(["expire", "corrupt"]),
});
export const authDebugResponseSchema = z.object({
  ok: z.literal(true),
  action: z.string(),
});
