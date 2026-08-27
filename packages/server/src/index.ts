import { buildApp } from "./app.js";
import { env, spotifyConfigured } from "./env.js";

const app = await buildApp();

if (!spotifyConfigured) {
  app.log.warn(
    "Spotify credentials not set — copy .env.example to .env (Phase 1). API health still works.",
  );
}

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
