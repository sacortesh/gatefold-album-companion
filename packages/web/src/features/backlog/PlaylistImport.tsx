import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useBacklog } from "./useBacklog";

export function PlaylistImport() {
  const { importAlbums } = useBacklog();
  const [link, setLink] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["playlist-albums", submitted],
    queryFn: () => api.playlistAlbums(submitted as string),
    enabled: Boolean(submitted),
    retry: false,
  });

  const albums = q.data?.albums ?? [];

  useEffect(() => {
    if (q.data) {
      setPicked(
        new Set(
          q.data.albums.filter((a) => !a.inBacklog).map((a) => a.album.id),
        ),
      );
    }
  }, [q.data]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectable = albums.filter((a) => !a.inBacklog).map((a) => a.album.id);
  const allPicked =
    selectable.length > 0 && selectable.every((id) => picked.has(id));

  const runImport = () => {
    if (picked.size === 0) return;
    importAlbums.mutate([...picked], {
      onSuccess: () => {
        setSubmitted(null);
        setLink("");
        setPicked(new Set());
      },
    });
  };

  return (
    <details className="rounded-lg border border-neutral-800 bg-neutral-900/40">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-medium text-neutral-300">
        Import albums from a playlist
      </summary>

      <div className="space-y-3 border-t border-neutral-800 px-4 py-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim()) setSubmitted(link.trim());
          }}
        >
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Paste a Spotify playlist link"
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!link.trim() || q.isFetching}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
          >
            {q.isFetching ? "Reading…" : "Read"}
          </button>
        </form>

        {q.isError && (
          <p className="text-sm text-red-400">{(q.error as Error).message}</p>
        )}

        {q.isSuccess && albums.length === 0 && (
          <p className="text-sm text-neutral-500">
            No full albums in “{q.data.playlistName}” — it&apos;s probably all
            singles.
          </p>
        )}

        {q.isSuccess && albums.length > 0 && (
          <>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>
                {albums.length} album{albums.length === 1 ? "" : "s"} in “
                {q.data.playlistName}”
              </span>
              <button
                type="button"
                onClick={() =>
                  setPicked(allPicked ? new Set() : new Set(selectable))
                }
                className="hover:text-neutral-200"
              >
                {allPicked ? "Select none" : "Select all new"}
              </button>
            </div>

            <ul className="max-h-72 space-y-0.5 overflow-y-auto">
              {albums.map(({ album, trackCount, inBacklog }) => (
                <li key={album.id}>
                  <label
                    className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
                      inBacklog
                        ? "opacity-40"
                        : "cursor-pointer hover:bg-neutral-900"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={inBacklog}
                      checked={inBacklog || picked.has(album.id)}
                      onChange={() => toggle(album.id)}
                    />
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-neutral-800">
                      {album.image && (
                        <img
                          src={album.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{album.name}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {album.artists.join(", ")}
                        {album.year ? ` · ${album.year}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-neutral-600">
                      {inBacklog
                        ? "in backlog"
                        : `${trackCount} track${trackCount === 1 ? "" : "s"}`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {importAlbums.isError && (
              <p className="text-sm text-red-400">
                {(importAlbums.error as Error).message}
              </p>
            )}

            <button
              type="button"
              onClick={runImport}
              disabled={picked.size === 0 || importAlbums.isPending}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {importAlbums.isPending
                ? "Adding…"
                : `Add ${picked.size} to backlog`}
            </button>
          </>
        )}
      </div>
    </details>
  );
}
