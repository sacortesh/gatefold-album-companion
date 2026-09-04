import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

/** Enables the credits half of the "About this album" panel. Key/secret are
 *  never echoed back by the API — fields start blank and a save only
 *  touches whatever you typed into, matching the UI-auth password pattern
 *  in SecuritySettings. */
export function DiscogsSetup() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["app-settings"],
    queryFn: api.appSettings,
  });

  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api.updateAppSettings({
        ...(consumerKey ? { discogsConsumerKey: consumerKey } : {}),
        ...(consumerSecret ? { discogsConsumerSecret: consumerSecret } : {}),
      }),
    onSuccess: (next) => {
      qc.setQueryData(["app-settings"], next);
      setConsumerKey("");
      setConsumerSecret("");
      void qc.invalidateQueries({ queryKey: ["album-context"] });
    },
  });

  const s = settings.data;
  if (!s) return null;

  const dirty = Boolean(consumerKey) || Boolean(consumerSecret);

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-medium text-ink">Discogs</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Optional — enables personnel &amp; credits in the "About this
          album" panel. Create a key pair at{" "}
          <a
            href="https://www.discogs.com/settings/developers"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            discogs.com/settings/developers
          </a>
          .
        </p>
      </div>

      <p className="flex items-center gap-2 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${s.discogsConfigured ? "bg-primary" : "bg-surface-2"}`}
        />
        <span className="text-ink-muted">
          {s.discogsConfigured ? "Configured" : "Not configured"}
        </span>
      </p>

      <div className="space-y-1">
        <label className="text-xs text-ink-muted">
          Consumer key
          {s.envLocked.discogs && (
            <span className="ml-2 text-ink-muted">— set by environment</span>
          )}
        </label>
        <Input
          autoComplete="off"
          spellCheck={false}
          value={consumerKey}
          onChange={(e) => setConsumerKey(e.target.value)}
          disabled={s.envLocked.discogs}
          placeholder={s.discogsConfigured ? "Configured — leave blank to keep" : ""}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-ink-muted">
          Consumer secret
          {s.envLocked.discogs && (
            <span className="ml-2 text-ink-muted">— set by environment</span>
          )}
        </label>
        <Input
          autoComplete="off"
          spellCheck={false}
          value={consumerSecret}
          onChange={(e) => setConsumerSecret(e.target.value)}
          disabled={s.envLocked.discogs}
          placeholder={s.discogsConfigured ? "Configured — leave blank to keep" : ""}
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
          disabled={!dirty || s.envLocked.discogs || save.isPending}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>

        <a
          href="https://github.com/sacortesh/gatefold-album-companion/blob/main/docs/self-hosting.md#discogs-optional"
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
