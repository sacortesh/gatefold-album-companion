import { z } from "zod";

/** `GET /api/health` */
export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("spotify-companion"),
  version: z.string(),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Uniform error body for every `/api/*` failure. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** `GET /api/auth/status` */
export const authStatusSchema = z.object({
  /** True when a usable refresh token is on disk and the last token call worked. */
  connected: z.boolean(),
  /** Granted scopes, empty when disconnected. */
  scopes: z.array(z.string()),
  /** ISO timestamp the in-memory access token expires, or null. */
  expiresAt: z.string().nullable(),
  /** Present when connected and the `/me` probe succeeded. */
  user: z
    .object({
      id: z.string(),
      displayName: z.string().nullable(),
    })
    .nullable(),
  /** True only when Spotify client id/secret are configured in `.env`. */
  configured: z.boolean(),
});
export type AuthStatus = z.infer<typeof authStatusSchema>;

// Playback, recent, album, etc. DTOs are added in their respective phases.
