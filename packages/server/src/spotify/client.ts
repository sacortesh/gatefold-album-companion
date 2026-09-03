import { getAccessToken } from "../auth/tokenStore.js";
import { AppError } from "../errors.js";

const API_BASE = "https://api.spotify.com/v1";

/** Cap concurrent Spotify calls to stay comfortably under the rolling 30s window. */
class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.active >= this.max) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiters.shift()?.();
    }
  }
}

const gate = new Semaphore(4);
const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Only auto-retry a 429 if Spotify's backoff is short — a real rate-limit
 *  quota penalty can carry a `Retry-After` in the thousands of seconds, and
 *  no live request should ever legitimately block a caller that long. */
const MAX_AUTO_RETRY_WAIT_SECONDS = 5;

/** A stalled response (no timeout, no retry) would otherwise hang forever
 *  and permanently pin one of the 4 concurrency slots above. */
const REQUEST_TIMEOUT_MS = 15_000;

export interface SpotifyRequest {
  method?: string;
  /** Path under `/v1`, e.g. `/me` or `/me/player`. */
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

/**
 * Authenticated Spotify fetch. Single chokepoint for:
 *  - bearer injection
 *  - refresh + retry once on 401
 *  - honour `Retry-After` on 429
 *  - concurrency cap
 *
 * Returns parsed JSON, or `null` for 204/empty bodies.
 */
export async function spotifyRequest<T = unknown>(
  req: SpotifyRequest,
): Promise<T> {
  return gate.run(() => attempt<T>(req, 0, false));
}

async function attempt<T>(
  req: SpotifyRequest,
  retry: number,
  forceRefresh: boolean,
): Promise<T> {
  const url = new URL(API_BASE + req.path);
  for (const [k, v] of Object.entries(req.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const token = await getAccessToken(forceRefresh);
  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(req.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new AppError(
        "spotify_timeout",
        `Spotify ${req.method ?? "GET"} ${req.path} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
        504,
      );
    }
    throw err;
  }

  if (res.status === 401 && retry === 0) {
    return attempt<T>(req, retry + 1, true);
  }

  if (res.status === 429) {
    const raw = Number(res.headers.get("retry-after") ?? "1");
    const wait = Number.isFinite(raw) ? raw : 1;
    if (retry < MAX_RETRIES && wait <= MAX_AUTO_RETRY_WAIT_SECONDS) {
      await sleep(wait * 1000);
      return attempt<T>(req, retry + 1, false);
    }
    throw new AppError(
      "spotify_rate_limited",
      `Spotify rate-limited this app — try again in ${wait}s.`,
      429,
    );
  }

  const text = await res.text();

  if (!res.ok) {
    let message = text.slice(0, 500);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      /* keep raw text */
    }
    throw new AppError(
      "spotify_api_error",
      `Spotify ${req.method ?? "GET"} ${req.path} → ${res.status}: ${message}`,
      res.status >= 500 ? 502 : res.status,
    );
  }

  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Some player-control endpoints reply 2xx with a short opaque body.
    return null as T;
  }
}

// --- Typed helpers (grown per phase) ----------------------------------

export interface SpotifyMe {
  id: string;
  display_name: string | null;
  email?: string;
  product?: string;
}

export const getMe = (): Promise<SpotifyMe> =>
  spotifyRequest<SpotifyMe>({ path: "/me" });
