import type { FastifyInstance } from "fastify";
import { apiKeyGuard } from "../auth/apiKeyGuard.js";
import { authApiRoutes, authWebRoutes } from "./auth.js";
import { configRoutes } from "./config.js";
import { healthRoutes } from "./health.js";
import { albumRoutes } from "./album.js";
import { backlogRoutes } from "./backlog.js";
import { playbackRoutes } from "./playback.js";
import { searchRoutes } from "./search.js";
import { settingsRoutes } from "./settings.js";
import { triageRoutes } from "./triage.js";
import { verdictRoutes } from "./verdict.js";
import { versionRoutes } from "./version.js";

/** Mounts every route. Phase 5+ registers album view, verdict, etc. here. */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Top-level browser routes (must match the registered Spotify redirect URI,
  // plus the session/login endpoints — never behind the API-key guard below).
  await app.register(authWebRoutes);

  // /api/health stays open (used by the Docker HEALTHCHECK, no key needed).
  await app.register(
    async (api) => {
      await api.register(healthRoutes);
    },
    { prefix: "/api" },
  );

  await app.register(
    async (api) => {
      api.addHook("preHandler", apiKeyGuard);
      await api.register(authApiRoutes);
      await api.register(settingsRoutes);
      await api.register(versionRoutes);
      await api.register(playbackRoutes);
      await api.register(configRoutes);
      await api.register(triageRoutes);
      await api.register(backlogRoutes);
      await api.register(searchRoutes);
      await api.register(albumRoutes);
      await api.register(verdictRoutes);
    },
    { prefix: "/api" },
  );
}
