import type { FastifyInstance } from "fastify";
import {
  addBacklogRequestSchema,
  albumIdParamSchema,
  backlogEntrySchema,
  backlogResponseSchema,
  bulkAddBacklogRequestSchema,
  idParamSchema,
  okSchema,
  playlistAlbumsResponseSchema,
  reorderBacklogRequestSchema,
  type BacklogEntry,
  type BacklogItem,
  type BacklogResponse,
  type PlaylistAlbumsResponse,
} from "@gatefold/shared";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { getCachedGenres } from "../context/index.js";
import { AppError } from "../errors.js";
import {
  getAlbum,
  getAlbums,
  parseAlbumId,
  toAlbumSummary,
} from "../spotify/albums.js";
import {
  getPlaylistAlbums,
  parsePlaylistId,
} from "../spotify/playlists.js";
import { readConfig, writeConfig } from "../store/config.js";

const today = (): string => new Date().toISOString().slice(0, 10);

const renumber = (items: BacklogItem[]): BacklogItem[] =>
  items.map((it, i) => ({ ...it, priority: i }));

async function enrich(items: BacklogItem[]): Promise<BacklogEntry[]> {
  const ordered = [...items].sort((a, b) => a.priority - b.priority);
  const albums = ordered.length
    ? await getAlbums(ordered.map((i) => i.albumId))
    : new Map();
  return Promise.all(
    ordered.map(async (i) => {
      const raw = albums.get(i.albumId);
      if (!raw) return { ...i, album: null };
      const summary = toAlbumSummary(raw);
      const genres = await getCachedGenres(
        summary.artists[0] ?? "",
        summary.name,
      );
      return { ...i, album: { ...summary, genres } };
    }),
  );
}

export async function backlogRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/backlog",
    { schema: { response: { 200: backlogResponseSchema } } },
    async (): Promise<BacklogResponse> => {
      const { items } = await readConfig("backlog");
      return { items: await enrich(items) };
    },
  );

  typed.post(
    "/backlog",
    {
      schema: {
        body: addBacklogRequestSchema,
        response: { 200: backlogEntrySchema },
      },
    },
    async (req): Promise<BacklogEntry> => {
      const { album } = req.body;
      const id = parseAlbumId(album);
      if (!id) {
        throw new AppError(
          "bad_album",
          "That doesn't look like a Spotify album id or link.",
          400,
        );
      }

      const backlog = await readConfig("backlog");
      let entry = backlog.items.find((i) => i.albumId === id);

      if (!entry) {
        const raw = await getAlbum(id).catch((err: unknown) => {
          if (err instanceof AppError && err.statusCode === 404) {
            throw new AppError("album_not_found", "No album with that id.", 404);
          }
          throw err;
        });
        entry = {
          albumId: id,
          uri: raw.uri,
          addedAt: today(),
          priority: backlog.items.length,
        };
        backlog.items = renumber([...backlog.items, entry]);
        await writeConfig("backlog", backlog);
      }

      const [enriched] = await enrich([entry]);
      return enriched as BacklogEntry;
    },
  );

  typed.post(
    "/backlog/bulk",
    {
      schema: {
        body: bulkAddBacklogRequestSchema,
        response: { 200: backlogResponseSchema },
      },
    },
    async (req): Promise<BacklogResponse> => {
      const { albums } = req.body;
      const ids = [
        ...new Set(
          albums
            .map((a) => parseAlbumId(a))
            .filter((x): x is string => Boolean(x)),
        ),
      ];

      const backlog = await readConfig("backlog");
      const have = new Set(backlog.items.map((i) => i.albumId));
      const toAdd = ids.filter((id) => !have.has(id));

      if (toAdd.length) {
        const raws = await getAlbums(toAdd);
        for (const id of toAdd) {
          const raw = raws.get(id);
          if (!raw) continue;
          backlog.items.push({
            albumId: id,
            uri: raw.uri,
            addedAt: today(),
            priority: backlog.items.length,
          });
        }
        backlog.items = renumber(backlog.items);
        await writeConfig("backlog", backlog);
      }

      return { items: await enrich(backlog.items) };
    },
  );

  typed.delete(
    "/backlog/:albumId",
    {
      schema: { params: albumIdParamSchema, response: { 200: okSchema } },
    },
    async (req) => {
      const { albumId } = req.params;
      const backlog = await readConfig("backlog");
      backlog.items = renumber(
        backlog.items.filter((i) => i.albumId !== albumId),
      );
      await writeConfig("backlog", backlog);
      return { ok: true as const };
    },
  );

  typed.get(
    "/playlist/:id/albums",
    {
      schema: {
        params: idParamSchema,
        response: { 200: playlistAlbumsResponseSchema },
      },
    },
    async (req): Promise<PlaylistAlbumsResponse> => {
      const { id: rawId } = req.params;
      const id = parsePlaylistId(rawId);
      if (!id) {
        throw new AppError(
          "bad_playlist",
          "That doesn't look like a Spotify playlist id or link.",
          400,
        );
      }

      const [{ name, albums }, backlog] = await Promise.all([
        getPlaylistAlbums(id).catch((err: unknown) => {
          if (err instanceof AppError && err.statusCode === 404) {
            throw new AppError(
              "playlist_not_found",
              "No playlist with that id — is it public?",
              404,
            );
          }
          throw err;
        }),
        readConfig("backlog"),
      ]);

      const inBacklog = new Set(backlog.items.map((i) => i.albumId));
      return {
        playlistName: name,
        albums: albums.map((a) => ({
          album: a.album,
          trackCount: a.trackCount,
          inBacklog: inBacklog.has(a.album.id),
        })),
      };
    },
  );

  typed.put(
    "/backlog",
    {
      schema: {
        body: reorderBacklogRequestSchema,
        response: { 200: okSchema },
      },
    },
    async (req) => {
      const { albumIds } = req.body;
      const backlog = await readConfig("backlog");
      const byId = new Map(backlog.items.map((i) => [i.albumId, i]));

      const reordered: BacklogItem[] = [];
      for (const id of albumIds) {
        const item = byId.get(id);
        if (item) {
          reordered.push(item);
          byId.delete(id);
        }
      }
      reordered.push(...byId.values()); // keep anything the client didn't mention

      backlog.items = renumber(reordered);
      await writeConfig("backlog", backlog);
      return { ok: true as const };
    },
  );
}
