import type {
  AlbumContext,
  AlbumDetail,
  AlbumLyricsResponse,
  ApiError,
  AppSettings,
  AppSettingsUpdate,
  AuthStatus,
  Backlog,
  BacklogEntry,
  BacklogResponse,
  BangerResponse,
  Buttons,
  ConfigName,
  DevicesResponse,
  HealthResponse,
  LinksConfig,
  PlaybackState,
  PlaylistAlbumsResponse,
  PlaylistsResponse,
  PlayRequest,
  RecentResponse,
  Review,
  ReviewsResponse,
  Revisit,
  RevisitResponse,
  SearchResponse,
  SessionStatus,
  Settings,
  SimilarAlbumsResponse,
  TrackStatesResponse,
  UiAuthUpdate,
  VerdictRequest,
  VerdictResponse,
  VersionResponse,
} from "@gatefold/shared";

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** Set once at boot from `GET /auth/session`, sent back as `X-Api-Key` on
 *  every `/api/*` call. `null` until the session bootstrap resolves. */
let apiKey: string | null = null;
export function setApiKey(key: string | null): void {
  apiKey = key;
}

/** Called on a 401 from the API-key guard — e.g. the key was regenerated in
 *  another tab. The caller re-runs the session bootstrap. */
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const err = (body as ApiError | undefined)?.error;
    // Only the API-key guard's own code means "the key is bad" — a plain 401
    // also covers "Spotify isn't connected" (`not_connected`), which is a
    // normal, frequent state and must not be treated as an auth failure.
    if (err?.code === "unauthorized") onUnauthorized?.();
    throw new ApiRequestError(
      err?.code ?? "http_error",
      err?.message ?? res.statusText,
      res.status,
    );
  }
  return body as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
      ...init?.headers,
    },
    ...init,
  });
  return parseResponse<T>(res);
}

/** For the handful of endpoints that live outside `/api` (session bootstrap,
 *  UI login/logout) — no API key, but cookies are sent. */
async function rawRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json", ...init?.headers },
    credentials: "same-origin",
    ...init,
  });
  return parseResponse<T>(res);
}

const post = (path: string, body?: unknown) =>
  request<{ ok: true }>(path, {
    method: "POST",
    // Always send a JSON body — Fastify rejects an empty body when the
    // content-type is application/json.
    body: JSON.stringify(body ?? {}),
  });

interface ConfigMap {
  settings: Settings;
  buttons: Buttons;
  backlog: Backlog;
  revisit: Revisit;
  links: LinksConfig;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  version: () => request<VersionResponse>("/version"),

  authStatus: () => request<AuthStatus>("/auth/status"),
  authDisconnect: () =>
    request<{ connected: false }>("/auth", { method: "DELETE" }),
  appSettings: () => request<AppSettings>("/settings/app"),
  updateAppSettings: (body: AppSettingsUpdate) =>
    request<AppSettings>("/settings/app", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  authDebug: (action: "expire" | "corrupt") =>
    request<{ ok: true; action: string }>("/auth/debug", {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
  regenerateApiKey: () =>
    request<AppSettings>("/settings/api-key/regenerate", { method: "POST" }),
  updateUiAuth: (body: UiAuthUpdate) =>
    request<AppSettings>("/settings/ui-auth", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  session: () => rawRequest<SessionStatus>("/auth/session"),
  uiLogin: (username: string, password: string) =>
    rawRequest<{ ok: true }>("/auth/ui-login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  uiLogout: () => rawRequest<{ ok: true }>("/auth/ui-logout", { method: "POST" }),

  playback: () => request<PlaybackState>("/playback"),
  devices: () => request<DevicesResponse>("/devices"),
  play: (body?: PlayRequest) => post("/playback/play", body),
  pause: (deviceId?: string) => post("/playback/pause", { deviceId }),
  next: (deviceId?: string) => post("/playback/next", { deviceId }),
  previous: (deviceId?: string) => post("/playback/previous", { deviceId }),
  seek: (positionMs: number, deviceId?: string) =>
    post("/playback/seek", { positionMs, deviceId }),
  transfer: (deviceId: string, play?: boolean) =>
    post("/playback/transfer", { deviceId, play }),

  getConfig: <N extends ConfigName>(name: N) =>
    request<ConfigMap[N]>(`/config/${name}`),
  putConfig: <N extends ConfigName>(name: N, value: ConfigMap[N]) =>
    request<ConfigMap[N]>(`/config/${name}`, {
      method: "PUT",
      body: JSON.stringify(value),
    }),

  recent: () => request<RecentResponse>("/recent"),
  like: (trackId: string) => post("/like", { trackId }),
  unlike: (trackId: string) =>
    request<{ ok: true }>("/like", {
      method: "DELETE",
      body: JSON.stringify({ trackId }),
    }),
  banger: (trackId: string) =>
    request<BangerResponse>("/banger", {
      method: "POST",
      body: JSON.stringify({ trackId }),
    }),
  unbanger: (trackId: string) =>
    request<{ ok: true }>("/banger", {
      method: "DELETE",
      body: JSON.stringify({ trackId }),
    }),
  playlists: () => request<PlaylistsResponse>("/playlists"),

  backlog: () => request<BacklogResponse>("/backlog"),
  addToBacklog: (album: string) =>
    request<BacklogEntry>("/backlog", {
      method: "POST",
      body: JSON.stringify({ album }),
    }),
  bulkAddToBacklog: (albums: string[]) =>
    request<BacklogResponse>("/backlog/bulk", {
      method: "POST",
      body: JSON.stringify({ albums }),
    }),
  removeFromBacklog: (albumId: string) =>
    request<{ ok: true }>(`/backlog/${albumId}`, { method: "DELETE" }),
  playlistAlbums: (playlist: string) =>
    request<PlaylistAlbumsResponse>(
      `/playlist/${encodeURIComponent(playlist)}/albums`,
    ),
  reorderBacklog: (albumIds: string[]) =>
    request<{ ok: true }>("/backlog", {
      method: "PUT",
      body: JSON.stringify({ albumIds }),
    }),
  search: (q: string) =>
    request<SearchResponse>(`/search?q=${encodeURIComponent(q)}`),

  album: (id: string) => request<AlbumDetail>(`/album/${id}`),
  albumContext: (id: string) => request<AlbumContext>(`/album/${id}/context`),
  albumLyrics: (id: string) =>
    request<AlbumLyricsResponse>(`/album/${id}/lyrics`),
  similarAlbums: (id: string) =>
    request<SimilarAlbumsResponse>(`/album/${id}/similar`),
  trackStates: (ids: string[]) =>
    request<TrackStatesResponse>(
      `/track-states?ids=${encodeURIComponent(ids.join(","))}`,
    ),

  verdict: (body: VerdictRequest) =>
    request<VerdictResponse>("/verdict", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  reviews: () => request<ReviewsResponse>("/reviews"),
  reviewTemplate: () => request<{ template: string }>("/review-template"),
  review: (albumId: string) => request<Review>(`/review/${albumId}`),
  revisit: () => request<RevisitResponse>("/revisit"),
};

/** Full-page redirect into the Spotify consent screen. */
export const startSpotifyLogin = (): void => {
  window.location.href = "/auth/login";
};
