import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { ROOT } from "./paths.js";

loadDotenv({ path: path.join(ROOT, ".env") });

const envSchema = z.object({
  // Spotify credentials are optional until Phase 1 (auth).
  SPOTIFY_CLIENT_ID: z.string().default(""),
  SPOTIFY_CLIENT_SECRET: z.string().default(""),
  SPOTIFY_REDIRECT_URI: z.string().default("http://127.0.0.1:8888/callback"),
  WEB_ORIGIN: z.string().default("http://127.0.0.1:5173"),
  PORT: z.coerce.number().int().positive().default(8888),
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = envSchema.parse(process.env);

/** True once real Spotify credentials are present. */
export const spotifyConfigured = Boolean(
  env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET,
);
