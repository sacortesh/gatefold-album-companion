import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";

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
    <div className="space-y-4 rounded-lg border border-neutral-800 p-4">
      <div>
        <h2 className="text-sm font-medium text-neutral-300">Discogs</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Optional — enables personnel &amp; credits in the "About this
          album" panel. Create a key pair at{" "}
          <a
            href="https://www.discogs.com/settings/developers"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:underline"
          >
            discogs.com/settings/developers
          </a>
          .
        </p>
      </div>

      <p className="flex items-center gap-2 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${s.discogsConfigured ? "bg-emerald-500" : "bg-neutral-700"}`}
        />
        <span className="text-neutral-400">
          {s.discogsConfigured ? "Configured" : "Not configured"}
        </span>
      </p>

      <div className="space-y-1">
        <label className="text-xs text-neutral-400">
          Consumer key
          {s.envLocked.discogs && (
            <span className="ml-2 text-neutral-600">— set by environment</span>
          )}
        </label>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={consumerKey}
          onChange={(e) => setConsumerKey(e.target.value)}
          disabled={s.envLocked.discogs}
          placeholder={s.discogsConfigured ? "Configured — leave blank to keep" : ""}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs disabled:opacity-60"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-neutral-400">
          Consumer secret
          {s.envLocked.discogs && (
            <span className="ml-2 text-neutral-600">— set by environment</span>
          )}
        </label>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={consumerSecret}
          onChange={(e) => setConsumerSecret(e.target.value)}
          disabled={s.envLocked.discogs}
          placeholder={s.discogsConfigured ? "Configured — leave blank to keep" : ""}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs disabled:opacity-60"
        />
      </div>

      {save.isError && (
        <p className="text-sm text-red-400">{(save.error as Error).message}</p>
      )}

      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={!dirty || s.envLocked.discogs || save.isPending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {save.isPending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
