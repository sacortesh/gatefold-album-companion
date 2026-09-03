import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";

/** Version + update check against the project's GitHub releases (server-side, ~6h cache). */
export function AboutSettings() {
  const version = useQuery({
    queryKey: ["version"],
    queryFn: api.version,
    staleTime: 3600_000,
  });

  const v = version.data;
  if (!v) return null;

  return (
    <div className="space-y-3 rounded-lg border border-neutral-800 p-4">
      <h2 className="text-sm font-medium text-neutral-300">About</h2>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-neutral-400">
        <dt>Version</dt>
        <dd>{v.current}</dd>
      </dl>

      {v.updateAvailable ? (
        <p className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-emerald-400">
            Update available — {v.latest}
          </span>
          {v.releaseUrl && (
            <a
              href={v.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline"
            >
              Release notes
            </a>
          )}
        </p>
      ) : (
        <p className="text-sm text-neutral-500">
          {v.latest ? "Up to date." : "Couldn't check for updates."}
        </p>
      )}
    </div>
  );
}
