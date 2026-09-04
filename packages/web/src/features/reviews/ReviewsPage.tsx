import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReviewListItem, Verdict } from "@gatefold/shared";
import { api, ApiRequestError } from "../../api/client";
import { Button } from "../../components/ui/button";
import { GenreChips } from "../../components/GenreChips";
import { Input } from "../../components/ui/input";
import { useDevicePickerPrompt } from "../playback/DevicePickerPrompt";

const VERDICT_STYLE: Record<Verdict, string> = {
  keep: "border-primary/40 bg-primary/10 text-primary",
  revisit: "border-banger/40 bg-banger/10 text-banger",
  pass: "border-border bg-surface text-ink-muted",
  delete: "border-danger/40 bg-danger/10 text-danger",
};

const FILTERS: Array<{ value: Verdict | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "keep", label: "Keep" },
  { value: "revisit", label: "Revisit" },
  { value: "pass", label: "Pass" },
  { value: "delete", label: "Delete" },
];

function Row({ review }: { review: ReviewListItem }) {
  const { requestDevice } = useDevicePickerPrompt();
  const play = useMutation({
    mutationFn: () => api.play({ contextUri: `spotify:album:${review.albumId}` }),
    onError: (err) => {
      if (err instanceof ApiRequestError && err.code === "no_device") {
        requestDevice(() => play.mutate());
      }
    },
  });

  return (
    <li className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/album/${review.albumId}`}
            className="block truncate font-medium hover:underline"
          >
            {review.album}
          </Link>
          <p className="truncate text-sm text-ink-muted">{review.artist}</p>
          <GenreChips genres={review.genres} />
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs capitalize ${VERDICT_STYLE[review.verdict]}`}
        >
          {review.verdict}
        </span>
      </div>

      <p className="text-xs text-ink-muted">
        reviewed {review.listenedOn}
        {review.rating != null && ` · ${review.rating}/10`}
        {review.revisitedOn.length > 0 && ` · revisited ${review.revisitedOn.length}×`}
      </p>

      {review.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {review.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-ink-muted"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {review.notes && (
        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-ink-muted">
          {review.notes}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="primary" size="sm" onClick={() => play.mutate()}>
          Play
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <Link to={`/album/${review.albumId}`}>Open review</Link>
        </Button>
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
        <h1 className="font-display text-2xl font-semibold">Reviews</h1>
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

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Reviews</h1>
        {query.isSuccess && (
          <p className="text-sm text-ink-muted">
            {filtered.length} of {reviews.length}
          </p>
        )}
      </div>
      <p className="text-sm text-ink-muted">
        Every album you&apos;ve finished, with your notes. Open one to update
        the verdict, rating, or notes.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search album, artist, or tag…"
          className="min-w-[200px] flex-1"
        />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setVerdictFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                verdictFilter === f.value
                  ? "bg-surface-2 text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
      {query.isError && (
        <p className="text-sm text-danger">{query.error.message}</p>
      )}
      {query.isSuccess && reviews.length === 0 && (
        <p className="text-sm text-ink-muted">
          No reviews yet — finish an album from the backlog to write one.
        </p>
      )}
      {query.isSuccess && reviews.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-ink-muted">No reviews match that filter.</p>
      )}

      <ul className="space-y-2">
        {filtered.map((review) => (
          <Row key={review.albumId} review={review} />
        ))}
      </ul>
    </section>
  );
}
