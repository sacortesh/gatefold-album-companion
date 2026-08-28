import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";

const Fact = ({ label, value }: { label: string; value: string }) => (
  <>
    <dt className="text-neutral-500">{label}</dt>
    <dd className="text-neutral-300">{value}</dd>
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
    <details className="group rounded-lg border border-neutral-800 bg-neutral-900/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-neutral-300">
        <span className="inline-block text-xs transition group-open:rotate-90">
          ▶
        </span>
        About this album
        {ctx.isLoading && (
          <span className="text-xs font-normal text-neutral-500">loading…</span>
        )}
      </summary>

      <div className="space-y-4 border-t border-neutral-800 px-4 py-4 text-sm">
        {ctx.isError && (
          <p className="text-red-400">Couldn&apos;t load background info.</p>
        )}
        {ctx.isSuccess && !hasAnything && (
          <p className="text-neutral-500">
            No background info found for this album.
          </p>
        )}

        {d?.summary && (
          <div>
            <p className="whitespace-pre-line text-neutral-300">{d.summary}</p>
            {d.summarySource && (
              <a
                href={d.summarySource.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-emerald-400 hover:underline"
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
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Personnel
            </p>
            <ul className="space-y-0.5 text-neutral-300">
              {d.credits.map((c) => (
                <li key={c.name}>
                  <span className="text-neutral-200">{c.name}</span>
                  <span className="text-neutral-500">
                    {" "}
                    — {c.roles.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {d?.notes && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Notes
            </p>
            <p className="whitespace-pre-line text-neutral-400">{d.notes}</p>
          </div>
        )}

        {d && !d.discogsConfigured && (
          <p className="text-xs text-neutral-600">
            Set <code>DISCOGS_CONSUMER_KEY</code> /{" "}
            <code>DISCOGS_CONSUMER_SECRET</code> in <code>.env</code> for
            personnel &amp; credits.
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
                className="text-emerald-400 hover:underline"
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
