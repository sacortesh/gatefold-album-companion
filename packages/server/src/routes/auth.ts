import type { FastifyInstance } from "fastify";
import {
  authDebugRequestSchema,
  authDebugResponseSchema,
  authStatusSchema,
  callbackQuerySchema,
  disconnectResponseSchema,
  okSchema,
  sessionStatusSchema,
  uiLoginRequestSchema,
  type AuthStatus,
  type SessionStatus,
} from "@gatefold/shared";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
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

/** Where to send the browser after the OAuth round-trip. `publicUrl` wins
 *  when set (reverse-proxy / remote deployments). Otherwise: a relative
 *  redirect in production, so it lands back on whatever host:port the user
 *  actually reached the app on (the server serves the SPA itself there) —
 *  and `WEB_ORIGIN` (the Vite dev server) in development, where the API and
 *  the SPA run on different ports. Getting this wrong in production sends a
 *  successful login to a dead port that nothing is listening on. */
async function settingsUrl(params: string): Promise<string> {
  const { publicUrl } = await getAppConfig();
  const base = publicUrl || (env.NODE_ENV === "production" ? "" : env.WEB_ORIGIN);
  return `${base}/settings?${params}`;
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
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/auth/login",
    { schema: { security: [] } },
    async (_req, reply) => {
      if (!(await spotifyConfigured())) {
        return reply.redirect(await settingsUrl("auth=unconfigured"));
      }
      const { state, challenge } = issueAuthState();
      return reply.redirect(await buildAuthorizeUrl(state, challenge));
    },
  );

  typed.get(
    "/callback",
    { schema: { querystring: callbackQuerySchema, security: [] } },
    async (req, reply) => {
      const { code, state, error } = req.query;

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
    },
  );

  typed.get(
    "/auth/session",
    { schema: { response: { 200: sessionStatusSchema }, security: [] } },
    async (req): Promise<SessionStatus> => {
      const { uiAuth, apiKey, sessionEpoch } = await getAppConfig();

      if (!uiAuth.enabled) return { enabled: false, authenticated: true, apiKey };

      const raw = req.cookies[SESSION_COOKIE];
      const unsigned = raw ? req.unsignCookie(raw) : null;
      const authenticated =
        Boolean(unsigned?.valid) && unsigned?.value === String(sessionEpoch);

      return { enabled: true, authenticated, apiKey: authenticated ? apiKey : null };
    },
  );

  typed.post(
    "/auth/ui-login",
    {
      schema: {
        body: uiLoginRequestSchema,
        response: { 200: okSchema },
        security: [],
      },
    },
    async (req, reply) => {
      const { username, password } = req.body;
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
      return { ok: true as const };
    },
  );

  typed.post(
    "/auth/ui-logout",
    { schema: { response: { 200: okSchema }, security: [] } },
    async (_req, reply) => {
      await bumpSessionEpoch(); // invalidates this and every other outstanding session
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return { ok: true as const };
    },
  );
}

/** API routes (mounted under `/api`): `/api/auth/status`, `DELETE /api/auth`. */
export async function authApiRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/auth/status",
    { schema: { response: { 200: authStatusSchema } } },
    async (): Promise<AuthStatus> => buildStatus(),
  );

  typed.delete(
    "/auth",
    { schema: { response: { 200: disconnectResponseSchema } } },
    async () => {
      await disconnect();
      return { connected: false as const };
    },
  );

  if (env.NODE_ENV !== "production") {
    typed.post(
      "/auth/debug",
      {
        schema: {
          body: authDebugRequestSchema,
          response: { 200: authDebugResponseSchema },
        },
      },
      async (req) => {
        const { action } = req.body;
        if (action === "expire") _debugExpire();
        else _debugCorrupt();
        return { ok: true as const, action };
      },
    );
  }
}
