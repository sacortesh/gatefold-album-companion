import { z } from "zod";

export const verdictSchema = z.enum(["keep", "revisit", "pass", "delete"]);
export type Verdict = z.infer<typeof verdictSchema>;

/** Frontmatter block of a `data/reviews/<year>/<artist>-<album>.md` file. */
export const reviewFrontmatterSchema = z.object({
  album: z.string(),
  artist: z.string(),
  albumId: z.string(),
  verdict: verdictSchema,
  rating: z.number().int().min(1).max(10).optional(),
  tags: z.array(z.string()).default([]),
  listenedOn: z.string(), // YYYY-MM-DD
  revisitedOn: z.array(z.string()).default([]),
});
export type ReviewFrontmatter = z.infer<typeof reviewFrontmatterSchema>;

/** A parsed review file: frontmatter + the markdown body below it. */
export const reviewSchema = reviewFrontmatterSchema.extend({
  notes: z.string(),
  /** repo-relative path, e.g. `data/reviews/2026/deafheaven-sunbather.md` */
  path: z.string(),
});
export type Review = z.infer<typeof reviewSchema>;

/** Payload the web app sends to `POST /api/verdict`. */
export const verdictRequestSchema = z.object({
  albumId: z.string().min(1),
  verdict: verdictSchema,
  rating: z.number().int().min(1).max(10).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(""),
});
export type VerdictRequest = z.infer<typeof verdictRequestSchema>;

export const verdictResponseSchema = z.object({
  verdict: verdictSchema,
  review: reviewSchema,
  savedAlbum: z.boolean(),
  removedFromLibrary: z.boolean(),
});
export type VerdictResponse = z.infer<typeof verdictResponseSchema>;

export const reviewsResponseSchema = z.object({
  reviews: z.array(reviewSchema),
});
export type ReviewsResponse = z.infer<typeof reviewsResponseSchema>;
