import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

/** packages/server/src */
const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root — where `.env` and `packages/` live. */
export const ROOT = path.resolve(here, "../../..");

// Loaded here (not env.ts) so CONFIG_DIR below can come from a local .env
// file too, not just a real environment variable — env.ts imports ROOT from
// this module, so this must run before anything else reads process.env.
loadDotenv({ path: path.join(ROOT, ".env") });

/** All mutable state lives under here — `/config` in the Docker image,
 *  `./data` by default in dev. One volume mount covers the whole app. */
export const DATA_DIR = process.env.CONFIG_DIR || path.join(ROOT, "data");

export const CONFIG_DIR = path.join(DATA_DIR, "config");
export const REVIEWS_DIR = path.join(DATA_DIR, "reviews");
export const CACHE_DIR = path.join(DATA_DIR, "cache");
export const AUTH_FILE = path.join(DATA_DIR, ".auth.json");

/** Built SPA, served by Fastify in production. */
export const WEB_DIST = path.join(ROOT, "packages", "web", "dist");
