import type {
  ApiError,
  AuthStatus,
  Backlog,
  Buttons,
  ConfigName,
  DevicesResponse,
  HealthResponse,
  PlaybackState,
  PlayRequest,
  Revisit,
  Settings,
} from "@spotify-companion/shared";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const err = (body as ApiError | undefined)?.error;
    throw new ApiRequestError(
      err?.code ?? "http_error",
      err?.message ?? res.statusText,
      res.status,
    );
  }
  return body as T;
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
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  authStatus: () => request<AuthStatus>("/auth/status"),
  authDisconnect: () =>
    request<{ connected: false }>("/auth", { method: "DELETE" }),
  authDebug: (action: "expire" | "corrupt") =>
    request<{ ok: true; action: string }>("/auth/debug", {
      method: "POST",
      body: JSON.stringify({ action }),
    }),

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
};

/** Full-page redirect into the Spotify consent screen. */
export const startSpotifyLogin = (): void => {
  window.location.href = "/auth/login";
};
