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
  const res = await fetch(url, {
    method: req.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(req.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });

  if (res.status === 401 && retry === 0) {
    return attempt<T>(req, retry + 1, true);
  }

  if (res.status === 429 && retry < MAX_RETRIES) {
    const wait = Number(res.headers.get("retry-after") ?? "1");
    await sleep((Number.isFinite(wait) ? wait : 1) * 1000);
    return attempt<T>(req, retry + 1, false);
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

  return (text ? JSON.parse(text) : null) as T;
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
