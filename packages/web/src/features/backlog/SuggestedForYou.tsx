import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { SuggestionSource } from "@gatefold/shared";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { useBacklog } from "./useBacklog";

const SOURCE_LABEL: Record<SuggestionSource, string> = {
  backlog: "In your backlog",
  keep: "A keeper",
  revisit: "Marked to revisit",
};

/** "Play next" (Phase 12.3) — real albums already sitting in Backlog /
 *  Keep / Revisit, weighted by whatever time-of-day schedule is
 *  configured in Settings. Deliberately not new-album discovery (that's
 *  `SimilarAlbums.tsx` on the album page) — the point is surfacing what
 *  you already have, so the backlog actually gets worked through instead
 *  of only ever growing. Renders nothing when none of the three lists
 *  have anything to pick from. */
export function SuggestedForYou() {
  const { playAlbum } = useBacklog();
  const suggestions = useQuery({
    queryKey: ["suggestions"],
    queryFn: api.suggestions,
    staleTime: 15 * 60_000,
  });

  const items = suggestions.data?.albums ?? [];
  if (!suggestions.isSuccess || items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-medium text-ink-muted">Play next</h2>
        {suggestions.data?.activeRule && (
          <span className="text-xs text-ink-muted">
            — {suggestions.data.activeRule}
          </span>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map(({ album: a, source }) => (
          <div key={a.id} className="w-32 shrink-0 space-y-1.5">
            <Link
              to={`/album/${a.id}`}
              className="block aspect-square w-32 overflow-hidden rounded-lg bg-surface-2"
            >
              {a.image && (
                <img
                  src={a.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              )}
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="truncate text-xs text-ink-muted">
                {a.artists.join(", ")}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {SOURCE_LABEL[source]}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={playAlbum.isPending && playAlbum.variables === a.uri}
              onClick={() => playAlbum.mutate(a.uri)}
            >
              Play
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
