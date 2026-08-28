import type { FastifyInstance } from "fastify";
import type { SearchResponse } from "@spotify-companion/shared";
import { searchAlbums } from "../spotify/albums.js";

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/search", async (req): Promise<SearchResponse> => {
    const q = ((req.query as { q?: string }).q ?? "").trim();
    if (q.length < 2) return { albums: [] };
    return { albums: await searchAlbums(q, 20) };
  });
}
