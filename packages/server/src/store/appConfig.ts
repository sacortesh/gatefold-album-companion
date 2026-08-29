import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { env } from "../env.js";
import { AppError } from "../errors.js";
import { DATA_DIR } from "../paths.js";
import { hashPassword, verifyPassword } from "../auth/password.js";

const FILE = path.join(DATA_DIR, "app.json");
const DEFAULT_REDIRECT = "http://127.0.0.1:8888/callback";

const uiAuthSchema = z.object({
  enabled: z.boolean().default(false),
  username: z.string().default(""),
  passwordHash: z.string().default(""),
});

/** The file-backed half of the config. Secrets live here in plain text — it's
 *  the operator's own box, same as Sonarr's config.xml. Gitignored. */
const fileSchema = z.object({
  spotifyClientId: z.string().default(""),
  discogsConsumerKey: z.string().default(""),
  discogsConsumerSecret: z.string().default(""),
  /** Public base URL the app is reached at, e.g. https://album.example.com. */
  publicUrl: z.string().default(""),
  /** Required on every `/api/*` call except `/api/health`. Generated on first run. */
  apiKey: z.string().default(""),
  /** Signs the UI session cookie. Generated on first run. */
  cookieSecret: z.string().default(""),
  /** Bumped whenever UI auth settings change — invalidates all outstanding sessions. */
  sessionEpoch: z.number().int().default(0),
  /** Optional forms auth gating the SPA + the API-key bootstrap route. */
  uiAuth: uiAuthSchema.default({ enabled: false, username: "", passwordHash: "" }),
});
type AppConfigFile = z.infer<typeof fileSchema>;

export interface AppConfig extends AppConfigFile {
  /** The redirect URI to register in the Spotify dashboard. */
  redirectUri: string;
  /** Base URL for post-OAuth browser redirects. */
  webOrigin: string;
  /** Fields pinned by an env var — writes to them are ignored, UI shows read-only. */
  envLocked: {
    spotifyClientId: boolean;
    publicUrl: boolean;
    discogsConsumerKey: boolean;
    discogsConsumerSecret: boolean;
  };
}

let cached: AppConfigFile | undefined;

async function persist(next: AppConfigFile): Promise<void> {
  cached = next;
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

async function readFileConfig(): Promise<AppConfigFile> {
  if (cached) return cached;

  let parsed: AppConfigFile;
  try {
    parsed = fileSchema.parse(JSON.parse(await readFile(FILE, "utf8")));
  } catch {
    parsed = fileSchema.parse({});
  }

  // First-run seeding: an apiKey/cookieSecret must exist before the server
  // can answer any /api/* request, so generate + persist immediately.
  let dirty = false;
  if (!parsed.apiKey) {
    parsed = { ...parsed, apiKey: randomBytes(24).toString("hex") };
    dirty = true;
  }
  if (!parsed.cookieSecret) {
    parsed = { ...parsed, cookieSecret: randomBytes(32).toString("hex") };
    dirty = true;
  }

  if (dirty) await persist(parsed);
  else cached = parsed;
  return parsed;
}

const prefer = (envVal: string | undefined, fileVal: string): string =>
  envVal && envVal.length > 0 ? envVal : fileVal;

export async function getAppConfig(): Promise<AppConfig> {
  const file = await readFileConfig();

  const spotifyClientId = prefer(env.SPOTIFY_CLIENT_ID, file.spotifyClientId);
  const discogsConsumerKey = prefer(
    env.DISCOGS_CONSUMER_KEY,
    file.discogsConsumerKey,
  );
  const discogsConsumerSecret = prefer(
    env.DISCOGS_CONSUMER_SECRET,
    file.discogsConsumerSecret,
  );
  const publicUrl = prefer(env.PUBLIC_URL, file.publicUrl).replace(/\/+$/, "");

  const redirectUri =
    env.SPOTIFY_REDIRECT_URI ||
    (publicUrl ? `${publicUrl}/callback` : DEFAULT_REDIRECT);

  return {
    ...file,
    spotifyClientId,
    discogsConsumerKey,
    discogsConsumerSecret,
    publicUrl,
    redirectUri,
    webOrigin: publicUrl || env.WEB_ORIGIN,
    envLocked: {
      spotifyClientId: Boolean(env.SPOTIFY_CLIENT_ID),
      publicUrl: Boolean(env.PUBLIC_URL),
      discogsConsumerKey: Boolean(env.DISCOGS_CONSUMER_KEY),
      discogsConsumerSecret: Boolean(env.DISCOGS_CONSUMER_SECRET),
    },
  };
}

/** Write the file-backed fields. Env-locked fields in `patch` are silently dropped. */
export async function updateAppConfig(
  patch: Partial<AppConfigFile>,
): Promise<AppConfig> {
  const current = await readFileConfig();
  const locked = (await getAppConfig()).envLocked;

  const merged: AppConfigFile = { ...current };
  if (patch.spotifyClientId !== undefined && !locked.spotifyClientId)
    merged.spotifyClientId = patch.spotifyClientId;
  if (patch.publicUrl !== undefined && !locked.publicUrl)
    merged.publicUrl = patch.publicUrl;
  if (patch.discogsConsumerKey !== undefined && !locked.discogsConsumerKey)
    merged.discogsConsumerKey = patch.discogsConsumerKey;
  if (patch.discogsConsumerSecret !== undefined && !locked.discogsConsumerSecret)
    merged.discogsConsumerSecret = patch.discogsConsumerSecret;

  await persist(fileSchema.parse(merged));
  return getAppConfig();
}

export async function spotifyConfigured(): Promise<boolean> {
  return Boolean((await getAppConfig()).spotifyClientId);
}

export async function discogsConfigured(): Promise<boolean> {
  const c = await getAppConfig();
  return Boolean(c.discogsConsumerKey && c.discogsConsumerSecret);
}

// --- Phase 9.2: API key + UI auth ------------------------------------

export async function regenerateApiKey(): Promise<AppConfig> {
  const current = await readFileConfig();
  await persist({ ...current, apiKey: randomBytes(24).toString("hex") });
  return getAppConfig();
}

export interface UiAuthPatch {
  enabled?: boolean;
  username?: string;
  /** Plaintext — hashed before it touches disk. Omit to keep the current password. */
  password?: string;
}

/** Any change here bumps `sessionEpoch`, invalidating every outstanding session cookie. */
export async function setUiAuth(patch: UiAuthPatch): Promise<AppConfig> {
  const current = await readFileConfig();
  const uiAuth = { ...current.uiAuth };

  if (patch.username !== undefined) uiAuth.username = patch.username;
  if (patch.password) uiAuth.passwordHash = hashPassword(patch.password);
  if (patch.enabled !== undefined) uiAuth.enabled = patch.enabled;

  if (uiAuth.enabled && (!uiAuth.username || !uiAuth.passwordHash)) {
    throw new AppError(
      "bad_request",
      "Set a username and password before enabling UI auth",
    );
  }

  await persist({
    ...current,
    uiAuth,
    sessionEpoch: current.sessionEpoch + 1,
  });
  return getAppConfig();
}

export async function verifyUiCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const { uiAuth } = await getAppConfig();
  if (!uiAuth.enabled || !uiAuth.username || !uiAuth.passwordHash) return false;
  if (username !== uiAuth.username) return false;
  return verifyPassword(password, uiAuth.passwordHash);
}

/** Logout: invalidate every session cookie (single-user app, so this is fine). */
export async function bumpSessionEpoch(): Promise<void> {
  const current = await readFileConfig();
  await persist({ ...current, sessionEpoch: current.sessionEpoch + 1 });
}
