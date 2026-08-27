import path from "node:path";
import { fileURLToPath } from "node:url";

/** packages/server/src */
const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root — where `.env`, `data/`, and `packages/` live. */
export const ROOT = path.resolve(here, "../../..");

export const DATA_DIR = path.join(ROOT, "data");
export const CONFIG_DIR = path.join(DATA_DIR, "config");
export const REVIEWS_DIR = path.join(DATA_DIR, "reviews");
export const CACHE_DIR = path.join(DATA_DIR, "cache");
export const AUTH_FILE = path.join(DATA_DIR, ".auth.json");

/** Built SPA, served by Fastify in production. */
export const WEB_DIST = path.join(ROOT, "packages", "web", "dist");
