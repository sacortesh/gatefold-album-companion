import type {
  ApiError,
  AuthStatus,
  HealthResponse,
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

export const api = {
  health: () => request<HealthResponse>("/health"),

  authStatus: () => request<AuthStatus>("/auth/status"),
  authDisconnect: () =>
    request<{ connected: false }>("/auth", { method: "DELETE" }),
  /** Dev-only: force a token refresh / 401 on the next Spotify call. */
  authDebug: (action: "expire" | "corrupt") =>
    request<{ ok: true; action: string }>("/auth/debug", {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
};

/** Full-page redirect into the Spotify consent screen. */
export const startSpotifyLogin = (): void => {
  window.location.href = "/auth/login";
};
