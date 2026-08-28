import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AlbumSummary } from "@gatefold/shared";
import { api } from "../../api/client";
import { parseAlbumId } from "../../lib/spotify";
import { useDebounced } from "../../lib/useDebounced";

interface Props {
  onAdd: (album: string) => void;
  adding: boolean;
  addError: string | null;
  existingIds: Set<string>;
}

function ResultRow({
  album,
  added,
  onAdd,
}: {
  album: AlbumSummary;
  added: boolean;
  onAdd: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-2 py-1.5 hover:bg-neutral-900">
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-neutral-800">
        {album.image && (
          <img src={album.image} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{album.name}</p>
        <p className="truncate text-xs text-neutral-500">
          {album.artists.join(", ")}
          {album.year ? ` · ${album.year}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={added}
        className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800 disabled:opacity-50"
      >
        {added ? "Added" : "Add"}
      </button>
    </li>
  );
}

export function AlbumSearch({ onAdd, adding, addError, existingIds }: Props) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q.trim(), 350);
  const linkId = parseAlbumId(q);

  const search = useQuery({
    queryKey: ["album-search", debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.length >= 2 && !linkId,
    staleTime: 60_000,
  });

  const results = search.data?.albums ?? [];

  return (
    <div className="space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search albums, or paste a Spotify album link"
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
      />

      {addError && <p className="text-sm text-red-400">{addError}</p>}

      {linkId && (
        <button
          type="button"
          onClick={() => {
            onAdd(q.trim());
            setQ("");
          }}
          disabled={adding}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Add album from link
        </button>
      )}

      {!linkId && debounced.length >= 2 && (
        <div className="rounded-md border border-neutral-800">
          {search.isLoading && (
            <p className="px-2 py-2 text-sm text-neutral-500">Searching…</p>
          )}
          {search.isError && (
            <p className="px-2 py-2 text-sm text-red-400">
              {(search.error as Error).message}
            </p>
          )}
          {search.isSuccess && results.length === 0 && (
            <p className="px-2 py-2 text-sm text-neutral-500">No albums found.</p>
          )}
          <ul className="max-h-80 overflow-y-auto">
            {results.map((album) => (
              <ResultRow
                key={album.id}
                album={album}
                added={existingIds.has(album.id)}
                onAdd={() => {
                  onAdd(album.id);
                  setQ("");
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
