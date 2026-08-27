import type { FastifyInstance } from "fastify";
import type { AuthStatus } from "@spotify-companion/shared";
import { buildAuthorizeUrl, consumeState, issueState } from "../auth/oauth.js";
import {
  _debugCorrupt,
  _debugExpire,
  accessTokenExpiresAt,
  completeLogin,
  currentScopes,
  disconnect,
  isConnected,
  spotifyConfigured,
} from "../auth/tokenStore.js";
import { env } from "../env.js";
import { AppError, NotConnectedError } from "../errors.js";
import { getMe } from "../spotify/client.js";

const settingsUrl = (params: string): string =>
  `${env.WEB_ORIGIN}/settings?${params}`;

function disconnected(configured: boolean): AuthStatus {
  return { connected: false, scopes: [], expiresAt: null, user: null, configured };
}

async function buildStatus(): Promise<AuthStatus> {
  const configured = spotifyConfigured();
  if (!configured || !(await isConnected())) return disconnected(configured);

  try {
    const me = await getMe(); // exercises the token + refresh path
    return {
      connected: true,
      scopes: currentScopes(),
      expiresAt: accessTokenExpiresAt(),
      user: { id: me.id, displayName: me.display_name },
      configured,
    };
  } catch (err) {
    if (
      err instanceof NotConnectedError ||
      (err instanceof AppError && err.statusCode === 401)
    ) {
      return { ...disconnected(configured), scopes: currentScopes() };
    }
    throw err;
  }
}

/** Top-level browser routes: `/auth/login`, `/callback`. */
export async function authWebRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/login", async (_req, reply) => {
    if (!spotifyConfigured()) {
      return reply.redirect(settingsUrl("auth=unconfigured"));
    }
    return reply.redirect(buildAuthorizeUrl(issueState()));
  });

  app.get("/callback", async (req, reply) => {
    const { code, state, error } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (error) return reply.redirect(settingsUrl(`auth=denied`));
    if (!code || !consumeState(state)) {
      return reply.redirect(settingsUrl("auth=invalid"));
    }

    try {
      await completeLogin(code);
      return reply.redirect(settingsUrl("auth=connected"));
    } catch (err) {
      req.log.error(err, "OAuth callback failed");
      return reply.redirect(settingsUrl("auth=failed"));
    }
  });
}

/** API routes (mounted under `/api`): `/api/auth/status`, `DELETE /api/auth`. */
export async function authApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/status", async (): Promise<AuthStatus> => buildStatus());

  app.delete("/auth", async () => {
    await disconnect();
    return { connected: false };
  });

  if (env.NODE_ENV !== "production") {
    app.post("/auth/debug", async (req) => {
      const { action } = (req.body ?? {}) as { action?: string };
      if (action === "expire") _debugExpire();
      else if (action === "corrupt") _debugCorrupt();
      else throw new AppError("bad_request", "action must be 'expire' or 'corrupt'");
      return { ok: true, action };
    });
  }
}
