import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "@gatefold/shared";
import { ROOT } from "../paths.js";

async function readVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(
      await readFile(path.join(ROOT, "package.json"), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const version = await readVersion();

  app.get("/health", async (): Promise<HealthResponse> => ({
    ok: true,
    service: "gatefold",
    version,
    time: new Date().toISOString(),
  }));
}
