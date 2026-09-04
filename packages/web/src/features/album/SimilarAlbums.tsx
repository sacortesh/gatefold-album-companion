import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";

/** Last.fm similar-artist → top-album, resolved to real Spotify albums
 *  (Last.fm's own art is near-universally a generic placeholder). Secondary
 *  discovery content, not the tracklist/lyrics/triage loop this app is
 *  actually for — placed after the tracklist, not competing with it for
 *  attention. Renders nothing when Last.fm isn't configured or nothing's
 *  left after filtering out albums already backlogged/revisited/reviewed. */
export function SimilarAlbums({ albumId }: { albumId: string }) {
  const similar = useQuery({
    queryKey: ["album-similar", albumId],
    queryFn: () => api.similarAlbums(albumId),
    enabled: Boolean(albumId),
    staleTime: 60 * 60_000,
  });

  const albums = similar.data?.albums ?? [];
  if (!similar.isSuccess || albums.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-ink-muted">Similar albums</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {albums.map((a) => (
          <Link
            key={a.id}
            to={`/album/${a.id}`}
            className="w-32 shrink-0 space-y-1.5"
          >
            <div className="aspect-square w-32 overflow-hidden rounded-lg bg-surface-2">
              {a.image && (
                <img
                  src={a.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="truncate text-xs text-ink-muted">
                {a.artists.join(", ")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
