import type { FastifyInstance } from "fastify";
import {
  appSettingsUpdateSchema,
  uiAuthUpdateSchema,
  type AppSettings,
} from "@gatefold/shared";
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

  app.post("/settings/api-key/regenerate", async (): Promise<AppSettings> =>
    toDto(await regenerateApiKey()),
  );

  app.put("/settings/ui-auth", async (req): Promise<AppSettings> => {
    const patch = uiAuthUpdateSchema.parse(req.body ?? {});
    return toDto(await setUiAuth(patch));
  });
}
