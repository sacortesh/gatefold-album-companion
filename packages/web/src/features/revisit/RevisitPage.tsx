import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { RevisitEntry } from "@gatefold/shared";
import { api, ApiRequestError } from "../../api/client";
import { Button } from "../../components/ui/button";
import { GenreChips } from "../../components/GenreChips";
import { Input } from "../../components/ui/input";
import { useDevicePickerPrompt } from "../playback/DevicePickerPrompt";

function Row({ entry }: { entry: RevisitEntry }) {
  const { requestDevice } = useDevicePickerPrompt();
  const play = useMutation({
    mutationFn: () =>
      api.play({ contextUri: entry.album?.uri ?? `spotify:album:${entry.albumId}` }),
    onError: (err) => {
      if (err instanceof ApiRequestError && err.code === "no_device") {
        requestDevice(() => play.mutate());
      }
    },
  });
  const a = entry.album;
  const r = entry.review;

  return (
    <li className="flex items-start gap-4 rounded-lg border border-border p-3">
      <Link
        to={`/album/${entry.albumId}`}
        className="h-16 w-16 shrink-0 overflow-hidden rounded bg-surface-2"
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
        <p className="truncate text-sm text-ink-muted">{a?.artists.join(", ")}</p>
        {a && <GenreChips genres={a.genres} />}
        {r && (
          <p className="mt-1 text-xs text-ink-muted">
            reviewed {r.listenedOn}
            {r.rating != null && ` · ${r.rating}/10`}
            {r.revisitedOn.length > 0 &&
              ` · revisited ${r.revisitedOn.length}×`}
          </p>
        )}
        {r?.notes && (
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-ink-muted">
            {r.notes}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        <Button variant="primary" size="sm" onClick={() => play.mutate()}>
          Play
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <Link to={`/album/${entry.albumId}`}>Open</Link>
        </Button>
      </div>
    </li>
  );
}

export function RevisitPage() {
  const query = useQuery<
    Awaited<ReturnType<typeof api.revisit>>,
    ApiRequestError
  >({
    queryKey: ["revisit"],
    queryFn: api.revisit,
    retry: (count, err) => err.status !== 401 && count < 2,
  });

  if (query.error?.status === 401) {
    return (
      <section className="space-y-3">
        <h1 className="font-display text-2xl font-semibold">Revisit</h1>
        <p className="text-sm text-ink-muted">
          Spotify isn&apos;t connected.{" "}
          <Link to="/settings" className="text-primary hover:underline">
            Connect in Settings
          </Link>
          .
        </p>
      </section>
    );
  }

  const items = query.data?.items ?? [];
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((entry) => {
      const a = entry.album;
      return (
        a?.name.toLowerCase().includes(q) ||
        a?.artists.some((artist) => artist.toLowerCase().includes(q)) ||
        entry.review?.notes?.toLowerCase().includes(q)
      );
    });
  }, [items, filter]);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-semibold">Revisit</h1>
        {query.isSuccess && items.length > 0 && (
          <span className="text-sm text-ink-muted">
            {filter ? `${filtered.length} of ${items.length}` : items.length}{" "}
            album{items.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <p className="text-sm text-ink-muted">
        Albums you weren&apos;t sure about. Play one, then update its review
        from the album page.
      </p>

      {query.isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
      {query.isError && (
        <p className="text-sm text-danger">{query.error.message}</p>
      )}
      {query.isSuccess && items.length === 0 && (
        <p className="text-sm text-ink-muted">
          Nothing to revisit. Mark an album <em>Revisit</em> when finishing it.
        </p>
      )}

      {items.length > 0 && (
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by album, artist, or notes…"
        />
      )}
      {query.isSuccess && items.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-ink-muted">No albums match that filter.</p>
      )}

      <ul className="space-y-2">
        {filtered.map((entry) => (
          <Row key={entry.albumId} entry={entry} />
        ))}
      </ul>
    </section>
  );
}
