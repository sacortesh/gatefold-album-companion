import type { FastifyInstance } from "fastify";
import {
  verdictRequestSchema,
  type Review,
  type RevisitResponse,
  type VerdictResponse,
} from "@spotify-companion/shared";
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
  app.post("/verdict", async (req): Promise<VerdictResponse> => {
    const body = verdictRequestSchema.parse(req.body);
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
  });

  app.get("/reviews", async () => ({ reviews: await readAllReviews() }));

  app.get("/review-template", async () => ({
    template: await readReviewTemplate(),
  }));

  app.get("/review/:albumId", async (req): Promise<Review> => {
    const { albumId } = req.params as { albumId: string };
    const review = await findReview(albumId);
    if (!review) {
      throw new AppError("no_review", "No review for that album yet.", 404);
    }
    return review;
  });

  app.get("/revisit", async (): Promise<RevisitResponse> => {
    const { items } = await readConfig("revisit");
    const [reviews, albums] = await Promise.all([
      readAllReviews(),
      items.length
        ? getAlbums(items.map((i) => i.albumId))
        : Promise.resolve(new Map()),
    ]);

    return {
      items: items.map((i) => {
        const raw = albums.get(i.albumId);
        return {
          albumId: i.albumId,
          addedAt: i.addedAt,
          album: raw ? toAlbumSummary(raw) : null,
          review: reviews.find((r) => r.albumId === i.albumId) ?? null,
        };
      }),
    };
  });
}
