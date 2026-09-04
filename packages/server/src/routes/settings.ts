import type { FastifyInstance } from "fastify";
import {
  appSettingsSchema,
  appSettingsUpdateSchema,
  okSchema,
  uiAuthUpdateSchema,
  type AppSettings,
} from "@gatefold/shared";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { clearAllCaches } from "../cache.js";
import {
  getAppConfig,
  regenerateApiKey,
  setUiAuth,
  updateAppConfig,
  type AppConfig,
} from "../store/appConfig.js";

/** Never leak the secrets back to the browser — only whether they're set. */
function toDto(c: AppConfig): AppSettings {
  return {
    spotifyClientId: c.spotifyClientId,
    publicUrl: c.publicUrl,
    redirectUri: c.redirectUri,
    discogsConfigured: Boolean(c.discogsConsumerKey && c.discogsConsumerSecret),
    lastfmConfigured: Boolean(c.lastfmApiKey),
    apiKey: c.apiKey,
    uiAuth: {
      enabled: c.uiAuth.enabled,
      username: c.uiAuth.username,
      passwordSet: Boolean(c.uiAuth.passwordHash),
    },
    envLocked: {
      spotifyClientId: c.envLocked.spotifyClientId,
      publicUrl: c.envLocked.publicUrl,
      discogs:
        c.envLocked.discogsConsumerKey || c.envLocked.discogsConsumerSecret,
      lastfm: c.envLocked.lastfmApiKey,
    },
  };
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/settings/app",
    { schema: { response: { 200: appSettingsSchema } } },
    async (): Promise<AppSettings> => toDto(await getAppConfig()),
  );

  typed.put(
    "/settings/app",
    {
      schema: {
        body: appSettingsUpdateSchema,
        response: { 200: appSettingsSchema },
      },
    },
    async (req): Promise<AppSettings> => {
      const patch = req.body;
      const clean: Parameters<typeof updateAppConfig>[0] = {};
      if (patch.spotifyClientId !== undefined)
        clean.spotifyClientId = patch.spotifyClientId.trim();
      if (patch.publicUrl !== undefined)
        clean.publicUrl = patch.publicUrl.trim().replace(/\/+$/, "");
      if (patch.discogsConsumerKey !== undefined)
        clean.discogsConsumerKey = patch.discogsConsumerKey.trim();
      if (patch.discogsConsumerSecret !== undefined)
        clean.discogsConsumerSecret = patch.discogsConsumerSecret.trim();
      if (patch.lastfmApiKey !== undefined)
        clean.lastfmApiKey = patch.lastfmApiKey.trim();
      return toDto(await updateAppConfig(clean));
    },
  );

  typed.post(
    "/settings/api-key/regenerate",
    { schema: { response: { 200: appSettingsSchema } } },
    async (): Promise<AppSettings> => toDto(await regenerateApiKey()),
  );

  typed.post(
    "/settings/cache/clear",
    { schema: { response: { 200: okSchema } } },
    async () => {
      await clearAllCaches();
      return { ok: true as const };
    },
  );

  typed.put(
    "/settings/ui-auth",
    {
      schema: {
        body: uiAuthUpdateSchema,
        response: { 200: appSettingsSchema },
      },
    },
    async (req): Promise<AppSettings> => toDto(await setUiAuth(req.body)),
  );
}
