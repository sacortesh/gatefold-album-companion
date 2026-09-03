import type { FastifyInstance } from "fastify";
import type { VersionResponse } from "@gatefold/shared";
import { getVersionInfo } from "../version.js";

export async function versionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/version", async (): Promise<VersionResponse> => getVersionInfo());
}
