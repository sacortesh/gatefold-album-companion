import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health.js";

/** Mounts every `/api/*` route. Phase 1+ registers auth, playback, etc. here. */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    async (api) => {
      await api.register(healthRoutes);
    },
    { prefix: "/api" },
  );
}
