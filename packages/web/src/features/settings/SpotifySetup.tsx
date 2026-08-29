import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-xs text-neutral-400">{label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2 font-mono text-xs text-neutral-300"
        />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-md border border-neutral-700 px-3 text-xs hover:bg-neutral-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/** First-run / anytime setup: enter a Spotify client id and see the exact
 *  redirect URI to register. Auth is PKCE, so there's no client secret. */
export function SpotifySetup() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["app-settings"],
    queryFn: api.appSettings,
  });

  const [clientId, setClientId] = useState("");
  const [publicUrl, setPublicUrl] = useState("");

  useEffect(() => {
    if (settings.data) {
      setClientId(settings.data.spotifyClientId);
      setPublicUrl(settings.data.publicUrl);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      api.updateAppSettings({ spotifyClientId: clientId, publicUrl }),
    onSuccess: (next) => {
      qc.setQueryData(["app-settings"], next);
      void qc.invalidateQueries({ queryKey: ["auth-status"] });
    },
  });

  const s = settings.data;
  if (!s) return null;

  const dirty =
    clientId !== s.spotifyClientId || publicUrl !== s.publicUrl;

  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 p-4">
      <div>
        <h2 className="text-sm font-medium text-neutral-300">Spotify app</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Create an app at{" "}
          <a
            href="https://developer.spotify.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:underline"
          >
            developer.spotify.com/dashboard
          </a>
          , add the redirect URI below to it, then paste the client ID here.
          No client secret needed (PKCE).
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-neutral-400">
          Client ID
          {s.envLocked.spotifyClientId && (
            <span className="ml-2 text-neutral-600">— set by environment</span>
          )}
        </label>
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={s.envLocked.spotifyClientId}
          placeholder="e.g. 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs disabled:opacity-60"
        />
      </div>

      <CopyField label="Redirect URI (register this in the dashboard)" value={s.redirectUri} />

      <div className="space-y-1">
        <label className="text-xs text-neutral-400">
          Public URL — only if reaching this from another device
          {s.envLocked.publicUrl && (
            <span className="ml-2 text-neutral-600">— set by environment</span>
          )}
        </label>
        <input
          value={publicUrl}
          onChange={(e) => setPublicUrl(e.target.value)}
          disabled={s.envLocked.publicUrl}
          placeholder="https://album.example.com"
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm disabled:opacity-60"
        />
        <p className="text-xs text-neutral-600">
          Spotify only allows a plain-http redirect for 127.0.0.1. A remote URL
          must be https (put a reverse proxy or tunnel in front). The redirect
          URI updates to match.
        </p>
      </div>

      {save.isError && (
        <p className="text-sm text-red-400">{(save.error as Error).message}</p>
      )}

      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={!dirty || save.isPending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {save.isPending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
