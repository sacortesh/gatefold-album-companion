import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { env } from "../env.js";
import { DATA_DIR } from "../paths.js";

const FILE = path.join(DATA_DIR, "app.json");
const DEFAULT_REDIRECT = "http://127.0.0.1:8888/callback";

/** The file-backed half of the config. Secrets live here in plain text — it's
 *  the operator's own box, same as Sonarr's config.xml. Gitignored. */
const fileSchema = z.object({
  spotifyClientId: z.string().default(""),
  discogsConsumerKey: z.string().default(""),
  discogsConsumerSecret: z.string().default(""),
  /** Public base URL the app is reached at, e.g. https://album.example.com. */
  publicUrl: z.string().default(""),
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

async function readFileConfig(): Promise<AppConfigFile> {
  if (cached) return cached;
  try {
    cached = fileSchema.parse(JSON.parse(await readFile(FILE, "utf8")));
  } catch {
    cached = fileSchema.parse({});
  }
  return cached;
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

  cached = fileSchema.parse(merged);
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify(cached, null, 2)}\n`, "utf8");
  return getAppConfig();
}

export async function spotifyConfigured(): Promise<boolean> {
  return Boolean((await getAppConfig()).spotifyClientId);
}

export async function discogsConfigured(): Promise<boolean> {
  const c = await getAppConfig();
  return Boolean(c.discogsConsumerKey && c.discogsConsumerSecret);
}
