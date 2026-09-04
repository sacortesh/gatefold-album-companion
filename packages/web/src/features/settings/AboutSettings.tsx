import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";

/** Version + update check against the project's GitHub releases (server-side, 30min cache). */
export function AboutSettings() {
  const version = useQuery({
    queryKey: ["version"],
    queryFn: api.version,
    staleTime: 3600_000,
  });

  const v = version.data;
  if (!v) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-ink">About</h2>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-ink-muted">
        <dt>Version</dt>
        <dd>{v.current}</dd>
      </dl>

      {v.updateAvailable ? (
        <p className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-primary">Update available — {v.latest}</span>
          {v.releaseUrl && (
            <a
              href={v.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Release notes
            </a>
          )}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          {v.latest ? "Up to date." : "Couldn't check for updates."}
        </p>
      )}

      <a
        href="/docs"
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs text-primary hover:underline"
      >
        API documentation →
      </a>
    </div>
  );
}
