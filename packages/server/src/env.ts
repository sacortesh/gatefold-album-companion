import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { ROOT } from "./paths.js";

loadDotenv({ path: path.join(ROOT, ".env") });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8888),
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Where to send the browser after the OAuth round-trip in dev (Vite origin). */
  WEB_ORIGIN: z.string().default("http://127.0.0.1:5173"),

  // Optional overrides for the runtime app config (data/app.json). When set,
  // these win over the file — handy for docker-compose users who prefer env
  // to the in-UI setup. Everything here is provisioned in Settings otherwise.
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().optional(),
  PUBLIC_URL: z.string().optional(),
  DISCOGS_CONSUMER_KEY: z.string().optional(),
  DISCOGS_CONSUMER_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
