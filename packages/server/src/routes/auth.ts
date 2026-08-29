import type { FastifyInstance } from "fastify";
import type { AuthStatus, SessionStatus } from "@gatefold/shared";
import { uiLoginRequestSchema } from "@gatefold/shared";
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
import {
  bumpSessionEpoch,
  getAppConfig,
  verifyUiCredentials,
} from "../store/appConfig.js";

const SESSION_COOKIE = "gatefold_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

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

/** Top-level browser routes: `/auth/login`, `/callback`, `/auth/session`,
 *  `/auth/ui-login`, `/auth/ui-logout`. None of these sit behind the
 *  `/api/*` API-key guard — `/auth/session` is precisely how the SPA
 *  obtains that key in the first place. */
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

  app.get("/auth/session", async (req): Promise<SessionStatus> => {
    const { uiAuth, apiKey, sessionEpoch } = await getAppConfig();

    if (!uiAuth.enabled) return { enabled: false, authenticated: true, apiKey };

    const raw = req.cookies[SESSION_COOKIE];
    const unsigned = raw ? req.unsignCookie(raw) : null;
    const authenticated =
      Boolean(unsigned?.valid) && unsigned?.value === String(sessionEpoch);

    return { enabled: true, authenticated, apiKey: authenticated ? apiKey : null };
  });

  app.post("/auth/ui-login", async (req, reply) => {
    const { username, password } = uiLoginRequestSchema.parse(req.body ?? {});
    const ok = await verifyUiCredentials(username, password);
    if (!ok) throw new AppError("invalid_credentials", "Wrong username or password", 401);

    const { sessionEpoch } = await getAppConfig();
    reply.cookie(SESSION_COOKIE, String(sessionEpoch), {
      signed: true,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return { ok: true };
  });

  app.post("/auth/ui-logout", async (_req, reply) => {
    await bumpSessionEpoch(); // invalidates this and every other outstanding session
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
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
