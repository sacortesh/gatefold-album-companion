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

// Playback, recent, album, etc. DTOs are added in their respective phases.
