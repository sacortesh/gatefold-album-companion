import { randomBytes } from "node:crypto";
import { env } from "../env.js";
import { AppError } from "../errors.js";

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

/** Scopes from functional-spec FR-1. Requested up front — Spotify can't add them later. */
export const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-library-read",
  "user-library-modify",
  "user-read-private",
] as const;

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

function basicAuthHeader(): string {
  const raw = `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

// --- CSRF state (in-memory, single-user, short-lived) ---------------------

const pendingStates = new Map<string, number>();
const STATE_TTL_MS = 10 * 60_000;

export function issueState(): string {
  const state = randomBytes(16).toString("hex");
  pendingStates.set(state, Date.now());
  return state;
}

export function consumeState(state: string | undefined): boolean {
  if (!state) return false;
  const issuedAt = pendingStates.get(state);
  pendingStates.delete(state);
  return issuedAt !== undefined && Date.now() - issuedAt < STATE_TTL_MS;
}

// --- Flow ----------------------------------------------------------------

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.SPOTIFY_CLIENT_ID,
    scope: SCOPES.join(" "),
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function tokenRequest(body: URLSearchParams): Promise<SpotifyTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: basicAuthHeader(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new AppError(
      "spotify_token_error",
      `Spotify token endpoint ${res.status}: ${text.slice(0, 300)}`,
      res.status === 400 ? 401 : 502,
    );
  }
  return JSON.parse(text) as SpotifyTokenResponse;
}

export function exchangeCode(code: string): Promise<SpotifyTokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
    }),
  );
}

export function refreshAccessToken(
  refreshToken: string,
): Promise<SpotifyTokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}
