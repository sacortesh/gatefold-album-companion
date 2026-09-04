import type { FastifyInstance } from "fastify";
import { versionResponseSchema } from "@gatefold/shared";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { getVersionInfo } from "../version.js";

export async function versionRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/version",
    { schema: { response: { 200: versionResponseSchema } } },
    async () => getVersionInfo(),
  );
}
