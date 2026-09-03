import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Review, Verdict } from "@gatefold/shared";
import { api, ApiRequestError } from "../../api/client";

const VERDICT_STYLE: Record<Verdict, string> = {
  keep: "border-emerald-800 bg-emerald-950 text-emerald-300",
  revisit: "border-amber-800 bg-amber-950 text-amber-300",
  pass: "border-neutral-700 bg-neutral-900 text-neutral-400",
  delete: "border-red-900 bg-red-950 text-red-300",
};

const FILTERS: Array<{ value: Verdict | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "keep", label: "Keep" },
  { value: "revisit", label: "Revisit" },
  { value: "pass", label: "Pass" },
  { value: "delete", label: "Delete" },
];

function Row({ review }: { review: Review }) {
  const play = useMutation({
    mutationFn: () => api.play({ contextUri: `spotify:album:${review.albumId}` }),
  });

  return (
    <li className="space-y-2 rounded-lg border border-neutral-800 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/album/${review.albumId}`}
            className="block truncate font-medium hover:underline"
          >
            {review.album}
          </Link>
          <p className="truncate text-sm text-neutral-400">{review.artist}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs capitalize ${VERDICT_STYLE[review.verdict]}`}
        >
          {review.verdict}
        </span>
      </div>

      <p className="text-xs text-neutral-500">
        reviewed {review.listenedOn}
        {review.rating != null && ` · ${review.rating}/10`}
        {review.revisitedOn.length > 0 && ` · revisited ${review.revisitedOn.length}×`}
      </p>

      {review.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {review.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-neutral-800 px-2 py-0.5 text-xs text-neutral-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {review.notes && (
        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-neutral-400">
          {review.notes}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => play.mutate()}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Play
        </button>
        <Link
          to={`/album/${review.albumId}`}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
        >
          Open review
        </Link>
      </div>
    </li>
  );
}

export function ReviewsPage() {
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "all">("all");

  const query = useQuery<
    Awaited<ReturnType<typeof api.reviews>>,
    ApiRequestError
  >({
    queryKey: ["reviews"],
    queryFn: api.reviews,
    retry: (count, err) => err.status !== 401 && count < 2,
  });

  const reviews = query.data?.reviews ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (verdictFilter !== "all" && r.verdict !== verdictFilter) return false;
      if (!q) return true;
      return (
        r.album.toLowerCase().includes(q) ||
        r.artist.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [reviews, search, verdictFilter]);

  if (query.error?.status === 401) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Reviews</h1>
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
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reviews</h1>
        {query.isSuccess && (
          <p className="text-sm text-neutral-500">
            {filtered.length} of {reviews.length}
          </p>
        )}
      </div>
      <p className="text-sm text-neutral-500">
        Every album you&apos;ve finished, with your notes. Open one to update
        the verdict, rating, or notes.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search album, artist, or tag…"
          className="min-w-[200px] flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setVerdictFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                verdictFilter === f.value
                  ? "bg-neutral-800 text-neutral-50"
                  : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {query.isError && (
        <p className="text-sm text-red-400">{query.error.message}</p>
      )}
      {query.isSuccess && reviews.length === 0 && (
        <p className="text-sm text-neutral-500">
          No reviews yet — finish an album from the backlog to write one.
        </p>
      )}
      {query.isSuccess && reviews.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-neutral-500">No reviews match that filter.</p>
      )}

      <ul className="space-y-2">
        {filtered.map((review) => (
          <Row key={review.albumId} review={review} />
        ))}
      </ul>
    </section>
  );
}
