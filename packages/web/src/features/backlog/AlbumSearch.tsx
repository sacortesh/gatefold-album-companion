import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AlbumSummary } from "@gatefold/shared";
import { api } from "../../api/client";
import { parseAlbumId } from "../../lib/spotify";
import { useDebounced } from "../../lib/useDebounced";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

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
    <li className="flex items-center gap-3 px-2 py-1.5 hover:bg-surface">
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-surface-2">
        {album.image && (
          <img src={album.image} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{album.name}</p>
        <p className="truncate text-xs text-ink-muted">
          {album.artists.join(", ")}
          {album.year ? ` · ${album.year}` : ""}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onAdd} disabled={added}>
        {added ? "Added" : "Add"}
      </Button>
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
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search albums, or paste a Spotify album link"
      />

      {addError && <p className="text-sm text-danger">{addError}</p>}

      {linkId && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            onAdd(q.trim());
            setQ("");
          }}
          disabled={adding}
        >
          Add album from link
        </Button>
      )}

      {!linkId && debounced.length >= 2 && (
        <div className="rounded-md border border-border">
          {search.isLoading && (
            <p className="px-2 py-2 text-sm text-ink-muted">Searching…</p>
          )}
          {search.isError && (
            <p className="px-2 py-2 text-sm text-danger">
              {(search.error as Error).message}
            </p>
          )}
          {search.isSuccess && results.length === 0 && (
            <p className="px-2 py-2 text-sm text-ink-muted">No albums found.</p>
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
