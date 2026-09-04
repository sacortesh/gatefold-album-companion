import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

/** Enables "Similar albums" on the album page. Same write-only pattern as
 *  DiscogsSetup — the key is never echoed back, and presence of a key is
 *  the on/off switch (clear the field, save, and the feature turns off). */
export function LastfmSetup() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["app-settings"],
    queryFn: api.appSettings,
  });

  const [apiKey, setApiKey] = useState("");

  const save = useMutation({
    mutationFn: () => api.updateAppSettings({ lastfmApiKey: apiKey }),
    onSuccess: (next) => {
      qc.setQueryData(["app-settings"], next);
      setApiKey("");
      void qc.invalidateQueries({ queryKey: ["album-similar"] });
    },
  });

  const s = settings.data;
  if (!s) return null;

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-medium text-ink">Last.fm</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Optional — enables "Similar albums" on the album page. Get a free
          key at{" "}
          <a
            href="https://www.last.fm/api/account/create"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            last.fm/api/account/create
          </a>
          . Clear the field and save to turn the feature off.
        </p>
      </div>

      <p className="flex items-center gap-2 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${s.lastfmConfigured ? "bg-primary" : "bg-surface-2"}`}
        />
        <span className="text-ink-muted">
          {s.lastfmConfigured ? "Configured" : "Not configured"}
        </span>
      </p>

      <div className="space-y-1">
        <label className="text-xs text-ink-muted">
          API key
          {s.envLocked.lastfm && (
            <span className="ml-2 text-ink-muted">— set by environment</span>
          )}
        </label>
        <Input
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={s.envLocked.lastfm}
          placeholder={
            s.lastfmConfigured
              ? "Configured — leave blank to keep, blank + Save to disable"
              : ""
          }
          className="font-mono text-xs"
        />
      </div>

      {save.isError && (
        <p className="text-sm text-danger">{(save.error as Error).message}</p>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={() => save.mutate()}
          disabled={s.envLocked.lastfm || save.isPending}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>

        <a
          href="https://github.com/sacortesh/gatefold-album-companion/blob/main/docs/self-hosting.md#lastfm-optional"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline"
        >
          Full setup guide →
        </a>
      </div>
    </div>
  );
}
