import { existsSync } from "node:fs";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { env } from "./env.js";
import { WEB_DIST } from "./paths.js";
import { registerRoutes } from "./routes/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV !== "test" && { level: "info" },
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    reply.status(status).send({
      error: { code: err.code ?? "internal_error", message: err.message },
    });
  });

  await registerRoutes(app);

  // In production the same process serves the built SPA.
  const serveSpa = env.NODE_ENV === "production" && existsSync(WEB_DIST);
  if (serveSpa) {
    const fastifyStatic = (await import("@fastify/static")).default;
    await app.register(fastifyStatic, { root: WEB_DIST, wildcard: false });
  }

  app.setNotFoundHandler((req, reply) => {
    const url = req.raw.url ?? "";
    const isApp =
      !url.startsWith("/api") &&
      !url.startsWith("/auth") &&
      !url.startsWith("/callback");
    if (serveSpa && isApp && req.method === "GET") {
      return reply.sendFile("index.html");
    }
    reply
      .status(404)
      .send({ error: { code: "not_found", message: `No route for ${url}` } });
  });

  return app;
}
