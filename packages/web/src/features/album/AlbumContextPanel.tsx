import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";

const Fact = ({ label, value }: { label: string; value: string }) => (
  <>
    <dt className="text-ink-muted">{label}</dt>
    <dd className="text-ink">{value}</dd>
  </>
);

export function AlbumContextPanel({ albumId }: { albumId: string }) {
  const ctx = useQuery({
    queryKey: ["album-context", albumId],
    queryFn: () => api.albumContext(albumId),
    enabled: Boolean(albumId),
    staleTime: 60 * 60_000,
  });

  const d = ctx.data;
  const { firstReleased, labels, genres, formats } = d?.facts ?? {
    firstReleased: null,
    labels: [],
    genres: [],
    formats: [],
  };
  const hasFacts =
    Boolean(firstReleased) ||
    labels.length > 0 ||
    genres.length > 0 ||
    formats.length > 0;
  const hasAnything =
    Boolean(d) &&
    (Boolean(d!.summary) ||
      d!.credits.length > 0 ||
      Boolean(d!.notes) ||
      hasFacts ||
      d!.links.length > 0);

  return (
    <details className="group rounded-lg border border-border bg-surface/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-ink">
        <ChevronRight className="size-4 transition group-open:rotate-90" />
        About this album
        {ctx.isLoading && (
          <span className="text-xs font-normal text-ink-muted">loading…</span>
        )}
      </summary>

      <div className="space-y-4 border-t border-border px-4 py-4 text-sm">
        {ctx.isError && (
          <p className="text-danger">Couldn&apos;t load background info.</p>
        )}
        {ctx.isSuccess && !hasAnything && (
          <p className="text-ink-muted">
            No background info found for this album.
          </p>
        )}

        {d?.summary && (
          <div>
            <p className="whitespace-pre-line text-ink">{d.summary}</p>
            {d.summarySource && (
              <a
                href={d.summarySource.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-primary hover:underline"
              >
                Read on {d.summarySource.label} →
              </a>
            )}
          </div>
        )}

        {hasFacts && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
            {firstReleased && (
              <Fact label="First released" value={firstReleased} />
            )}
            {labels.length > 0 && (
              <Fact label="Label" value={labels.join(", ")} />
            )}
            {genres.length > 0 && (
              <Fact label="Genre" value={genres.join(", ")} />
            )}
            {formats.length > 0 && (
              <Fact label="Format" value={formats.join(", ")} />
            )}
          </dl>
        )}

        {d && d.credits.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Personnel
            </p>
            <ul className="space-y-0.5 text-ink">
              {d.credits.map((c) => (
                <li key={c.name}>
                  <span className="text-ink">{c.name}</span>
                  <span className="text-ink-muted"> — {c.roles.join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {d?.notes && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Notes
            </p>
            <p className="whitespace-pre-line text-ink-muted">{d.notes}</p>
          </div>
        )}

        {d && !d.discogsConfigured && (
          <p className="text-xs text-ink-muted">
            Add a Discogs key in{" "}
            <Link to="/settings" className="text-primary hover:underline">
              Settings
            </Link>{" "}
            for personnel &amp; credits.
          </p>
        )}

        {d && d.links.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {d.links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {l.label} →
              </a>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
