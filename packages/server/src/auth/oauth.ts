import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../errors.js";
import { getAppConfig } from "../store/appConfig.js";

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

const b64url = (buf: Buffer): string =>
  buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// --- PKCE + CSRF state (in-memory, single-user, short-lived) --------------

interface Pending {
  at: number;
  verifier: string;
}
const pending = new Map<string, Pending>();
const STATE_TTL_MS = 10 * 60_000;

/** Start a login: mint a CSRF `state` and its paired PKCE verifier/challenge. */
export function issueAuthState(): { state: string; challenge: string } {
  const state = randomBytes(16).toString("hex");
  const verifier = b64url(randomBytes(64));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  pending.set(state, { at: Date.now(), verifier });
  return { state, challenge };
}

/** Redeem a `state` from the callback → its verifier, or null if unknown/expired. */
export function consumeAuthState(state: string | undefined): string | null {
  if (!state) return null;
  const entry = pending.get(state);
  pending.delete(state);
  if (!entry || Date.now() - entry.at >= STATE_TTL_MS) return null;
  return entry.verifier;
}

// --- Flow (Authorization Code with PKCE — no client secret) --------------

export async function buildAuthorizeUrl(
  state: string,
  challenge: string,
): Promise<string> {
  const { spotifyClientId, redirectUri } = await getAppConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: spotifyClientId,
    scope: SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function tokenRequest(
  body: URLSearchParams,
): Promise<SpotifyTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
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

export async function exchangeCode(
  code: string,
  verifier: string,
): Promise<SpotifyTokenResponse> {
  const { spotifyClientId, redirectUri } = await getAppConfig();
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: spotifyClientId,
      code_verifier: verifier,
    }),
  );
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<SpotifyTokenResponse> {
  const { spotifyClientId } = await getAppConfig();
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: spotifyClientId,
    }),
  );
}
