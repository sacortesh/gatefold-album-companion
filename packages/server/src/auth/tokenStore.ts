import { readFile, rm, writeFile } from "node:fs/promises";
import { env } from "../env.js";
import { NotConnectedError } from "../errors.js";
import { AUTH_FILE } from "../paths.js";
import {
  exchangeCode,
  refreshAccessToken,
  type SpotifyTokenResponse,
} from "./oauth.js";

interface StoredAuth {
  refreshToken: string;
  scope: string;
  obtainedAt: string;
}

/** Seconds of headroom before real expiry that we treat the access token as stale. */
const EXPIRY_SKEW_MS = 60_000;

let stored: StoredAuth | null | undefined; // undefined = not yet read from disk
let accessToken: string | null = null;
let accessExpiresAt = 0; // epoch ms
let scope = "";

async function readStored(): Promise<StoredAuth | null> {
  if (stored !== undefined) return stored;
  try {
    stored = JSON.parse(await readFile(AUTH_FILE, "utf8")) as StoredAuth;
    scope ||= stored.scope;
  } catch {
    stored = null;
  }
  return stored;
}

async function writeStored(next: StoredAuth): Promise<void> {
  stored = next;
  scope = next.scope;
  await writeFile(AUTH_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

/** Fold a token response into memory + disk. */
async function apply(
  token: SpotifyTokenResponse,
  prev: StoredAuth | null,
): Promise<void> {
  accessToken = token.access_token;
  accessExpiresAt = Date.now() + token.expires_in * 1000 - EXPIRY_SKEW_MS;
  scope = token.scope || prev?.scope || scope;

  const refreshToken = token.refresh_token ?? prev?.refreshToken;
  if (!refreshToken) return;

  if (
    refreshToken !== prev?.refreshToken ||
    (token.scope && token.scope !== prev?.scope)
  ) {
    await writeStored({
      refreshToken,
      scope,
      obtainedAt: new Date().toISOString(),
    });
  }
}

// --- Public API --------------------------------------------------------

/** Completes the OAuth callback: swap the code for tokens and persist. */
export async function completeLogin(code: string): Promise<void> {
  const token = await exchangeCode(code);
  await apply(token, await readStored());
}

/**
 * A valid access token, refreshing if missing/expired.
 * @param force  skip the in-memory token and refresh unconditionally.
 */
export async function getAccessToken(force = false): Promise<string> {
  if (!force && accessToken && Date.now() < accessExpiresAt) return accessToken;

  const prev = await readStored();
  if (!prev) throw new NotConnectedError();

  const token = await refreshAccessToken(prev.refreshToken);
  await apply(token, prev);
  return accessToken as string;
}

export async function isConnected(): Promise<boolean> {
  return (await readStored()) !== null;
}

export async function disconnect(): Promise<void> {
  stored = null;
  accessToken = null;
  accessExpiresAt = 0;
  scope = "";
  await rm(AUTH_FILE, { force: true });
}

export function currentScopes(): string[] {
  return scope ? scope.split(" ").filter(Boolean) : [];
}

export function accessTokenExpiresAt(): string | null {
  return accessExpiresAt > Date.now()
    ? new Date(accessExpiresAt).toISOString()
    : null;
}

export const spotifyConfigured = (): boolean =>
  Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);

// --- Debug hooks (non-production only; wired in routes/auth.ts) ---------

/** Pretend the access token expired — next call refreshes. */
export function _debugExpire(): void {
  accessExpiresAt = 0;
}

/** Poison the in-memory token but keep it "unexpired" — next call hits a 401. */
export function _debugCorrupt(): void {
  accessToken = "invalid-access-token";
  accessExpiresAt = Date.now() + 3_600_000;
}
