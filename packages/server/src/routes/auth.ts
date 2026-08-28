import type { FastifyInstance } from "fastify";
import type { AuthStatus } from "@gatefold/shared";
import {
  buildAuthorizeUrl,
  consumeAuthState,
  issueAuthState,
} from "../auth/oauth.js";
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
import { getAppConfig } from "../store/appConfig.js";

async function settingsUrl(params: string): Promise<string> {
  const { webOrigin } = await getAppConfig();
  return `${webOrigin}/settings?${params}`;
}

function disconnected(configured: boolean, redirectUri: string): AuthStatus {
  return {
    connected: false,
    scopes: [],
    expiresAt: null,
    user: null,
    configured,
    redirectUri,
  };
}

async function buildStatus(): Promise<AuthStatus> {
  const { spotifyClientId, redirectUri } = await getAppConfig();
  const configured = Boolean(spotifyClientId);
  if (!configured || !(await isConnected())) {
    return disconnected(configured, redirectUri);
  }

  try {
    const me = await getMe(); // exercises the token + refresh path
    return {
      connected: true,
      scopes: currentScopes(),
      expiresAt: accessTokenExpiresAt(),
      user: { id: me.id, displayName: me.display_name },
      configured,
      redirectUri,
    };
  } catch (err) {
    if (
      err instanceof NotConnectedError ||
      (err instanceof AppError && err.statusCode === 401)
    ) {
      return {
        ...disconnected(configured, redirectUri),
        scopes: currentScopes(),
      };
    }
    throw err;
  }
}

/** Top-level browser routes: `/auth/login`, `/callback`. */
export async function authWebRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/login", async (_req, reply) => {
    if (!(await spotifyConfigured())) {
      return reply.redirect(await settingsUrl("auth=unconfigured"));
    }
    const { state, challenge } = issueAuthState();
    return reply.redirect(await buildAuthorizeUrl(state, challenge));
  });

  app.get("/callback", async (req, reply) => {
    const { code, state, error } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (error) return reply.redirect(await settingsUrl("auth=denied"));

    const verifier = consumeAuthState(state);
    if (!code || !verifier) {
      return reply.redirect(await settingsUrl("auth=invalid"));
    }

    try {
      await completeLogin(code, verifier);
      return reply.redirect(await settingsUrl("auth=connected"));
    } catch (err) {
      req.log.error(err, "OAuth callback failed");
      return reply.redirect(await settingsUrl("auth=failed"));
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
      else
        throw new AppError(
          "bad_request",
          "action must be 'expire' or 'corrupt'",
        );
      return { ok: true, action };
    });
  }
}
