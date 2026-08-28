import type { FastifyInstance } from "fastify";
import {
  appSettingsUpdateSchema,
  type AppSettings,
} from "@spotify-companion/shared";
import {
  getAppConfig,
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
    envLocked: {
      spotifyClientId: c.envLocked.spotifyClientId,
      publicUrl: c.envLocked.publicUrl,
      discogs:
        c.envLocked.discogsConsumerKey || c.envLocked.discogsConsumerSecret,
    },
  };
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/settings/app", async (): Promise<AppSettings> =>
    toDto(await getAppConfig()),
  );

  app.put("/settings/app", async (req): Promise<AppSettings> => {
    const patch = appSettingsUpdateSchema.parse(req.body ?? {});
    const clean: Parameters<typeof updateAppConfig>[0] = {};
    if (patch.spotifyClientId !== undefined)
      clean.spotifyClientId = patch.spotifyClientId.trim();
    if (patch.publicUrl !== undefined)
      clean.publicUrl = patch.publicUrl.trim().replace(/\/+$/, "");
    if (patch.discogsConsumerKey !== undefined)
      clean.discogsConsumerKey = patch.discogsConsumerKey.trim();
    if (patch.discogsConsumerSecret !== undefined)
      clean.discogsConsumerSecret = patch.discogsConsumerSecret.trim();
    return toDto(await updateAppConfig(clean));
  });
}
