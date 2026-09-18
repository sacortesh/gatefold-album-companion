import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { statusLabel } from "../../lib/verdictLabels";
import { useBacklog } from "../backlog/useBacklog";

/** Last.fm similar-artist → top albums, resolved to real Spotify albums
 *  (Last.fm's own art is near-universally a generic placeholder). Secondary
 *  discovery content, not the tracklist/lyrics/triage loop this app is
 *  actually for — placed after the tracklist, not competing with it for
 *  attention. Renders nothing when Last.fm isn't configured or nothing
 *  came back. Albums already in Backlog/Revisit/Reviews are shown dimmed
 *  with a reason (Phase 12.2) rather than dropped — confirmation that the
 *  recommendation was good, not just filtered away; a `"new"` card gets a
 *  quick "Add to backlog" action instead of only being a dead-end link. */
export function SimilarAlbums({ albumId }: { albumId: string }) {
  const { importAlbums } = useBacklog();
  const similar = useQuery({
    queryKey: ["album-similar", albumId],
    queryFn: () => api.similarAlbums(albumId),
    enabled: Boolean(albumId),
    staleTime: 60 * 60_000,
  });

  const albums = similar.data?.albums ?? [];
  if (!similar.isSuccess || albums.length === 0) return null;

  const addingId =
    importAlbums.isPending && importAlbums.variables?.length === 1
      ? importAlbums.variables[0]
      : null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-ink-muted">Similar albums</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {albums.map(({ album: a, status, verdict }) => {
          const known = status !== "new";
          return (
            <div
              key={a.id}
              className={`w-32 shrink-0 space-y-1.5 ${known ? "opacity-50" : ""}`}
            >
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
              <Link to={`/album/${a.id}`} className="block min-w-0">
                <p className="truncate text-sm font-medium">{a.name}</p>
                <p className="truncate text-xs text-ink-muted">
                  {a.artists.join(", ")}
                </p>
              </Link>
              {known ? (
                <p className="truncate text-xs text-ink-muted">
                  {statusLabel(status, verdict)}
                </p>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  disabled={addingId === a.id}
                  onClick={() => importAlbums.mutate([a.id])}
                >
                  {addingId === a.id ? "Adding…" : "Add to backlog"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
