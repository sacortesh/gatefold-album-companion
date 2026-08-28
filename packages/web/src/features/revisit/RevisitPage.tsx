import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { RevisitEntry } from "@spotify-companion/shared";
import { api, ApiRequestError } from "../../api/client";

function Row({ entry }: { entry: RevisitEntry }) {
  const play = useMutation({
    mutationFn: () =>
      api.play({ contextUri: entry.album?.uri ?? `spotify:album:${entry.albumId}` }),
  });
  const a = entry.album;
  const r = entry.review;

  return (
    <li className="flex items-start gap-4 rounded-lg border border-neutral-800 p-3">
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
        <p className="truncate text-sm text-neutral-400">{a?.artists.join(", ")}</p>
        {r && (
          <p className="mt-1 text-xs text-neutral-500">
            reviewed {r.listenedOn}
            {r.rating != null && ` · ${r.rating}/10`}
            {r.revisitedOn.length > 0 &&
              ` · revisited ${r.revisitedOn.length}×`}
          </p>
        )}
        {r?.notes && (
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-neutral-400">
            {r.notes}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        <button
          type="button"
          onClick={() => play.mutate()}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Play
        </button>
        <Link
          to={`/album/${entry.albumId}`}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-center text-sm hover:bg-neutral-800"
        >
          Open
        </Link>
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
        <h1 className="text-2xl font-semibold">Revisit</h1>
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

  const items = query.data?.items ?? [];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Revisit</h1>
      <p className="text-sm text-neutral-500">
        Albums you weren&apos;t sure about. Play one, then update its review
        from the album page.
      </p>

      {query.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {query.isError && (
        <p className="text-sm text-red-400">{query.error.message}</p>
      )}
      {query.isSuccess && items.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nothing to revisit. Mark an album <em>Revisit</em> when finishing it.
        </p>
      )}

      <ul className="space-y-2">
        {items.map((entry) => (
          <Row key={entry.albumId} entry={entry} />
        ))}
      </ul>
    </section>
  );
}
