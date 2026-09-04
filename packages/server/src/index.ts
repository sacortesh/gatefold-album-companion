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

// Without this, `docker stop` / `compose down` / a k8s pod termination kills
// the process outright (exit 143) with in-flight requests dropped mid-flight.
// `app.close()` stops accepting new connections and drains what's in flight.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.once(sig, () => {
    app.log.info({ sig }, "shutting down");
    app.close().then(
      () => process.exit(0),
      (err: unknown) => {
        app.log.error(err, "error during shutdown");
        process.exit(1);
      },
    );
  });
}
