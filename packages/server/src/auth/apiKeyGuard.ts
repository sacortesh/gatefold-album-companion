import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors.js";
import { getAppConfig } from "../store/appConfig.js";
import { timingSafeEqualStr } from "./password.js";

/** Guards every `/api/*` route except `/api/health`. The SPA gets the key
 *  from `/auth/session` (gated by UI auth if enabled) and sends it back as
 *  `X-Api-Key` on every call; scripts/curl can pass `?apikey=` instead. */
export async function apiKeyGuard(
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const { apiKey } = await getAppConfig();

  const header = req.headers["x-api-key"];
  const query = (req.query as Record<string, unknown> | undefined)?.apikey;
  const provided =
    typeof header === "string"
      ? header
      : typeof query === "string"
        ? query
        : undefined;

  if (!provided || !timingSafeEqualStr(provided, apiKey)) {
    throw new AppError("unauthorized", "Missing or invalid API key", 401);
  }
}
