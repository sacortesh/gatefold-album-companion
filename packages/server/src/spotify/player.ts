import type {
  Device,
  NowPlayingTrack,
  PlaybackState,
} from "@gatefold/shared";
import { spotifyRequest } from "./client.js";

// --- Raw Spotify shapes (partial) ------------------------------------

interface RawDevice {
  id: string | null;
  is_active: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number | null;
}

interface RawTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  track_number?: number;
  disc_number?: number;
  artists?: Array<{ name: string }>;
  album?: {
    id: string;
    name: string;
    total_tracks?: number;
    images?: Array<{ url: string; width: number | null }>;
  };
}

interface RawPlayback {
  device: RawDevice | null;
  shuffle_state: boolean;
  repeat_state: "off" | "track" | "context";
  context: { uri: string; type: string } | null;
  progress_ms: number | null;
  is_playing: boolean;
  currently_playing_type: string;
  item: RawTrack | null;
}

// --- Mapping --------------------------------------------------------

const mapDevice = (d: RawDevice): Device => ({
  id: d.id ?? "",
  name: d.name,
  type: d.type,
  isActive: d.is_active,
  isRestricted: d.is_restricted,
  volumePercent: d.volume_percent,
});

function pickImage(images?: Array<{ url: string; width: number | null }>): string | null {
  if (!images?.length) return null;
  // Prefer a mid-size image (~300px) for the now-playing panel.
  const sorted = [...images].sort(
    (a, b) => Math.abs((a.width ?? 0) - 300) - Math.abs((b.width ?? 0) - 300),
  );
  return sorted[0]?.url ?? images[0]?.url ?? null;
}

function mapTrack(item: RawTrack | null, type: string): NowPlayingTrack | null {
  if (!item || type !== "track" || !item.album) return null;
  return {
    id: item.id,
    name: item.name,
    uri: item.uri,
    durationMs: item.duration_ms,
    artists: (item.artists ?? []).map((a) => a.name),
    album: {
      id: item.album.id,
      name: item.album.name,
      image: pickImage(item.album.images),
      totalTracks: item.album.total_tracks ?? null,
    },
    trackNumber: item.track_number ?? null,
    discNumber: item.disc_number ?? null,
  };
}

const emptyPlayback = (): PlaybackState => ({
  isPlaying: false,
  device: null,
  track: null,
  progressMs: 0,
  contextUri: null,
  contextType: null,
  shuffle: false,
  repeat: "off",
  fetchedAt: new Date().toISOString(),
});

// --- Reads ---------------------------------------------------------

export async function getPlayback(): Promise<PlaybackState> {
  const raw = await spotifyRequest<RawPlayback | null>({ path: "/me/player" });
  if (!raw) return emptyPlayback();
  return {
    isPlaying: raw.is_playing,
    device: raw.device ? mapDevice(raw.device) : null,
    track: mapTrack(raw.item, raw.currently_playing_type),
    progressMs: raw.progress_ms ?? 0,
    contextUri: raw.context?.uri ?? null,
    contextType: raw.context?.type ?? null,
    shuffle: raw.shuffle_state,
    repeat: raw.repeat_state,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getDevices(): Promise<Device[]> {
  const raw = await spotifyRequest<{ devices: RawDevice[] }>({
    path: "/me/player/devices",
  });
  return raw.devices.filter((d) => d.id).map(mapDevice);
}

// --- Controls -----------------------------------------------------

const deviceQuery = (deviceId?: string) =>
  deviceId ? { device_id: deviceId } : {};

export async function setShuffle(
  state: boolean,
  deviceId?: string,
): Promise<void> {
  await spotifyRequest({
    method: "PUT",
    path: "/me/player/shuffle",
    query: { state: state ? "true" : "false", ...deviceQuery(deviceId) },
  });
}

export async function setRepeat(
  state: "off" | "track" | "context",
  deviceId?: string,
): Promise<void> {
  await spotifyRequest({
    method: "PUT",
    path: "/me/player/repeat",
    query: { state, ...deviceQuery(deviceId) },
  });
}

export interface PlayOptions {
  contextUri?: string;
  uris?: string[];
  offset?: { position?: number; uri?: string };
  positionMs?: number;
  deviceId?: string;
  /** When set, shuffle is forced to this state *before* playback starts. */
  shuffle?: boolean;
  /** When set, repeat is forced to this mode *before* playback starts. */
  repeat?: "off" | "track" | "context";
}

export async function play(opts: PlayOptions = {}): Promise<void> {
  // Normalise playback modes first — starting an album context with shuffle on
  // makes Spotify begin on a random track instead of track 1.
  if (opts.shuffle !== undefined) await setShuffle(opts.shuffle, opts.deviceId);
  if (opts.repeat !== undefined) await setRepeat(opts.repeat, opts.deviceId);

  const body: Record<string, unknown> = {};
  if (opts.contextUri) body.context_uri = opts.contextUri;
  if (opts.uris) body.uris = opts.uris;
  if (opts.offset) body.offset = opts.offset;
  if (opts.positionMs !== undefined) body.position_ms = opts.positionMs;

  await spotifyRequest({
    method: "PUT",
    path: "/me/player/play",
    query: deviceQuery(opts.deviceId),
    body: Object.keys(body).length ? body : undefined,
  });
}

export async function pause(deviceId?: string): Promise<void> {
  await spotifyRequest({
    method: "PUT",
    path: "/me/player/pause",
    query: deviceQuery(deviceId),
  });
}

export async function next(deviceId?: string): Promise<void> {
  await spotifyRequest({
    method: "POST",
    path: "/me/player/next",
    query: deviceQuery(deviceId),
  });
}

export async function previous(deviceId?: string): Promise<void> {
  await spotifyRequest({
    method: "POST",
    path: "/me/player/previous",
    query: deviceQuery(deviceId),
  });
}

export async function seek(positionMs: number, deviceId?: string): Promise<void> {
  await spotifyRequest({
    method: "PUT",
    path: "/me/player/seek",
    query: { position_ms: positionMs, ...deviceQuery(deviceId) },
  });
}

export async function transferPlayback(
  deviceId: string,
  play = false,
): Promise<void> {
  await spotifyRequest({
    method: "PUT",
    path: "/me/player",
    body: { device_ids: [deviceId], play },
  });
}
