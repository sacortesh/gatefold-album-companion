import type { FastifyInstance } from "fastify";
import { authApiRoutes, authWebRoutes } from "./auth.js";
import { healthRoutes } from "./health.js";

/** Mounts every route. Phase 2+ registers playback, recent, album, etc. here. */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Top-level browser routes (must match the registered Spotify redirect URI).
  await app.register(authWebRoutes);

  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(authApiRoutes);
    },
    { prefix: "/api" },
  );
}
