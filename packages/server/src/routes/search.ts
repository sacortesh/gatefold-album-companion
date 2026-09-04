import type { FastifyInstance } from "fastify";
import { searchQuerySchema, searchResponseSchema } from "@gatefold/shared";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { searchAlbums } from "../spotify/albums.js";

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/search",
    {
      schema: {
        querystring: searchQuerySchema,
        response: { 200: searchResponseSchema },
      },
    },
    async (req) => {
      const q = (req.query.q ?? "").trim();
      if (q.length < 2) return { albums: [] };
      return { albums: await searchAlbums(q, 20) };
    },
  );
}
