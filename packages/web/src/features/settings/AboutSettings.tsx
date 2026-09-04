import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";

/** Version + update check against the project's GitHub releases (server-side, 30min cache). */
export function AboutSettings() {
  const qc = useQueryClient();
  const version = useQuery({
    queryKey: ["version"],
    queryFn: api.version,
    staleTime: 3600_000,
  });

  const [cleared, setCleared] = useState(false);
  const clearCache = useMutation({
    mutationFn: api.clearCache,
    onSuccess: () => {
      // Server-side caches (Spotify albums, context, lyrics, similar-albums)
      // are gone — refetch whatever's currently on screen so the page
      // reflects it immediately instead of waiting for a stale query to
      // naturally re-trigger.
      void qc.invalidateQueries();
      setCleared(true);
      setTimeout(() => setCleared(false), 1500);
    },
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

      <div className="space-y-1 border-t border-border pt-3">
        <p className="text-xs text-ink-muted">
          Clears cached Spotify/MusicBrainz/Discogs/LRCLIB/Last.fm lookups —
          use this if something's showing stale or wrong (a bad lyrics
          match, for example). Nothing you've saved (reviews, backlog,
          settings) is touched; everything just refetches on next view.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => clearCache.mutate()}
          disabled={clearCache.isPending}
        >
          {clearCache.isPending ? "Clearing…" : cleared ? "Cleared" : "Clear cache"}
        </Button>
        {clearCache.isError && (
          <p className="text-sm text-danger">
            {(clearCache.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}
