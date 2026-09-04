import type { FastifyInstance } from "fastify";
import { healthResponseSchema } from "@gatefold/shared";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { readCurrentVersion } from "../version.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const version = await readCurrentVersion();
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/health",
    { schema: { response: { 200: healthResponseSchema }, security: [] } },
    async () => ({
      ok: true as const,
      service: "gatefold" as const,
      version,
      time: new Date().toISOString(),
    }),
  );
}
