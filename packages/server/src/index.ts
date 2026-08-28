import { buildApp } from "./app.js";
import { env } from "./env.js";
import { spotifyConfigured } from "./store/appConfig.js";

const app = await buildApp();

if (!(await spotifyConfigured())) {
  app.log.warn(
    "No Spotify client id yet — set one in Settings (or SPOTIFY_CLIENT_ID). API health still works.",
  );
}

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
