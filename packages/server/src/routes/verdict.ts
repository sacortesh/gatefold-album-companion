import type { FastifyInstance } from "fastify";
import {
  albumIdParamSchema,
  reviewSchema,
  reviewTemplateResponseSchema,
  reviewsResponseSchema,
  revisitResponseSchema,
  verdictRequestSchema,
  verdictResponseSchema,
  type Review,
  type RevisitResponse,
  type VerdictResponse,
} from "@gatefold/shared";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { getCachedGenres } from "../context/index.js";
import { AppError } from "../errors.js";
import { getAlbum, getAlbums, toAlbumSummary } from "../spotify/albums.js";
import {
  isAlbumSaved,
  removeSavedAlbum,
  saveAlbum,
} from "../spotify/library.js";
import { readConfig, writeConfig } from "../store/config.js";
import {
  findReview,
  readAllReviews,
  readReviewTemplate,
  writeReview,
} from "../store/reviews.js";

const today = (): string => new Date().toISOString().slice(0, 10);
const dedupe = (xs: string[]): string[] => [...new Set(xs)];

async function removeFromBacklog(albumId: string): Promise<void> {
  const backlog = await readConfig("backlog");
  const kept = backlog.items.filter((i) => i.albumId !== albumId);
  if (kept.length !== backlog.items.length) {
    await writeConfig("backlog", {
      items: kept.map((it, i) => ({ ...it, priority: i })),
    });
  }
}

export async function verdictRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/verdict",
    {
      schema: {
        body: verdictRequestSchema,
        response: { 200: verdictResponseSchema },
      },
    },
    async (req): Promise<VerdictResponse> => {
      const body = req.body;
      const raw = await getAlbum(body.albumId);
      const artist = raw.artists?.[0]?.name ?? "Unknown Artist";

      let savedAlbum = false;
      let removedFromLibrary = false;

      if (body.verdict === "keep") {
        await saveAlbum(body.albumId);
        savedAlbum = true;
      } else if (body.verdict === "delete") {
        if (await isAlbumSaved(body.albumId)) {
          await removeSavedAlbum(body.albumId);
          removedFromLibrary = true;
        }
      }

      const revisit = await readConfig("revisit");
      const wasInRevisit = revisit.items.some((i) => i.albumId === body.albumId);
      const existing = await findReview(body.albumId);

      const review = await writeReview(
        {
          album: raw.name,
          artist,
          albumId: body.albumId,
          verdict: body.verdict,
          rating: body.rating,
          tags: body.tags,
          listenedOn: existing?.listenedOn ?? today(),
          revisitedOn:
            existing && wasInRevisit
              ? dedupe([...existing.revisitedOn, today()])
              : (existing?.revisitedOn ?? []),
        },
        body.notes,
      );

      if (body.verdict === "revisit") {
        if (!wasInRevisit) {
          revisit.items.push({
            albumId: body.albumId,
            reviewPath: review.path,
            addedAt: today(),
          });
          await writeConfig("revisit", revisit);
        }
      } else if (wasInRevisit) {
        await writeConfig("revisit", {
          items: revisit.items.filter((i) => i.albumId !== body.albumId),
        });
      }

      await removeFromBacklog(body.albumId);

      return { verdict: body.verdict, review, savedAlbum, removedFromLibrary };
    },
  );

  typed.get(
    "/reviews",
    { schema: { response: { 200: reviewsResponseSchema } } },
    async () => {
      const reviews = await readAllReviews();
      return {
        reviews: await Promise.all(
          reviews.map(async (r) => ({
            ...r,
            genres: await getCachedGenres(r.artist, r.album),
          })),
        ),
      };
    },
  );

  typed.get(
    "/review-template",
    { schema: { response: { 200: reviewTemplateResponseSchema } } },
    async () => ({ template: await readReviewTemplate() }),
  );

  typed.get(
    "/review/:albumId",
    { schema: { params: albumIdParamSchema, response: { 200: reviewSchema } } },
    async (req): Promise<Review> => {
      const { albumId } = req.params;
      const review = await findReview(albumId);
      if (!review) {
        throw new AppError("no_review", "No review for that album yet.", 404);
      }
      return review;
    },
  );

  typed.get(
    "/revisit",
    { schema: { response: { 200: revisitResponseSchema } } },
    async (): Promise<RevisitResponse> => {
      const { items } = await readConfig("revisit");
      const [reviews, albums] = await Promise.all([
        readAllReviews(),
        items.length
          ? getAlbums(items.map((i) => i.albumId))
          : Promise.resolve(new Map()),
      ]);

      return {
        items: await Promise.all(
          items.map(async (i) => {
            const raw = albums.get(i.albumId);
            const summary = raw ? toAlbumSummary(raw) : null;
            const album = summary
              ? {
                  ...summary,
                  genres: await getCachedGenres(
                    summary.artists[0] ?? "",
                    summary.name,
                  ),
                }
              : null;
            return {
              albumId: i.albumId,
              addedAt: i.addedAt,
              album,
              review: reviews.find((r) => r.albumId === i.albumId) ?? null,
            };
          }),
        ),
      };
    },
  );
}
