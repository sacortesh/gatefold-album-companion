import type { FastifyInstance } from "fastify";
import { configSchemas, type ConfigName } from "@spotify-companion/shared";
import { AppError } from "../errors.js";
import { readConfig, writeConfig } from "../store/config.js";

const isConfigName = (v: string): v is ConfigName => v in configSchemas;

function nameParam(params: unknown): ConfigName {
  const name = (params as { name?: string }).name ?? "";
  if (!isConfigName(name)) {
    throw new AppError("unknown_config", `No config named "${name}"`, 404);
  }
  return name;
}

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get("/config/:name", async (req) => readConfig(nameParam(req.params)));

  app.put("/config/:name", async (req) =>
    writeConfig(nameParam(req.params), req.body ?? {}),
  );
}
