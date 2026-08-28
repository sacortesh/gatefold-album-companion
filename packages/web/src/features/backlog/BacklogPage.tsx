import { Link } from "react-router-dom";
import type { BacklogEntry } from "@gatefold/shared";
import { formatDuration } from "../../lib/format";
import { AlbumSearch } from "./AlbumSearch";
import { PlaylistImport } from "./PlaylistImport";
import { useBacklog } from "./useBacklog";

function Card({
  entry,
  first,
  last,
  onPlay,
  onRemove,
  onMove,
}: {
  entry: BacklogEntry;
  first: boolean;
  last: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const a = entry.album;
  const meta = a
    ? [
        a.year,
        `${a.totalTracks} track${a.totalTracks === 1 ? "" : "s"}`,
        a.durationMs != null ? formatDuration(a.durationMs) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "album unavailable";

  return (
    <li className="flex items-center gap-4 rounded-lg border border-neutral-800 p-3">
      <Link
        to={`/album/${entry.albumId}`}
        className="h-16 w-16 shrink-0 overflow-hidden rounded bg-neutral-800"
      >
        {a?.image && (
          <img src={a.image} alt="" className="h-full w-full object-cover" />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to={`/album/${entry.albumId}`}
          className="block truncate font-medium hover:underline"
        >
          {a?.name ?? entry.albumId}
        </Link>
        <p className="truncate text-sm text-neutral-400">
          {a?.artists.join(", ")}
        </p>
        <p className="truncate text-xs text-neutral-600">{meta}</p>
      </div>

      <div className="flex shrink-0 flex-col text-neutral-500">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={first}
          className="px-1 leading-none hover:text-neutral-200 disabled:opacity-20"
          aria-label="Move up"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={last}
          className="px-1 leading-none hover:text-neutral-200 disabled:opacity-20"
          aria-label="Move down"
        >
          ▼
        </button>
      </div>

      <button
        type="button"
        onClick={onPlay}
        className="shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Play album
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
      >
        Remove
      </button>
    </li>
  );
}

export function BacklogPage() {
  const { query, notConnected, items, add, remove, playAlbum, move } =
    useBacklog();

  if (notConnected) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Backlog</h1>
        <p className="text-sm text-neutral-400">
          Spotify isn&apos;t connected.{" "}
          <Link to="/settings" className="text-emerald-400 hover:underline">
            Connect in Settings
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Backlog</h1>
        <span className="text-sm text-neutral-500">
          {items.length} album{items.length === 1 ? "" : "s"}
        </span>
      </div>

      <AlbumSearch
        onAdd={(album) => add.mutate(album)}
        adding={add.isPending}
        addError={add.isError ? (add.error as Error).message : null}
        existingIds={new Set(items.map((i) => i.albumId))}
      />

      <PlaylistImport />

      {playAlbum.isError && (
        <p className="text-sm text-red-400">
          Couldn&apos;t start playback: {(playAlbum.error as Error).message}
        </p>
      )}

      {query.isLoading && (
        <p className="text-sm text-neutral-500">Loading…</p>
      )}
      {query.isError && (
        <p className="text-sm text-red-400">{query.error.message}</p>
      )}
      {query.isSuccess && items.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nothing queued. Search above to add an album.
        </p>
      )}

      <ul className="space-y-2">
        {items.map((entry, i) => (
          <Card
            key={entry.albumId}
            entry={entry}
            first={i === 0}
            last={i === items.length - 1}
            onPlay={() => playAlbum.mutate(entry.uri)}
            onRemove={() => remove.mutate(entry.albumId)}
            onMove={(dir) => move(entry.albumId, dir)}
          />
        ))}
      </ul>
    </section>
  );
}
