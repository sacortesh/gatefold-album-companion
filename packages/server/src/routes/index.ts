import type { FastifyInstance } from "fastify";
import { authApiRoutes, authWebRoutes } from "./auth.js";
import { configRoutes } from "./config.js";
import { healthRoutes } from "./health.js";
import { playbackRoutes } from "./playback.js";
import { triageRoutes } from "./triage.js";

/** Mounts every route. Phase 4+ registers backlog, album, verdict, etc. here. */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Top-level browser routes (must match the registered Spotify redirect URI).
  await app.register(authWebRoutes);

  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(authApiRoutes);
      await api.register(playbackRoutes);
      await api.register(configRoutes);
      await api.register(triageRoutes);
    },
    { prefix: "/api" },
  );
}
