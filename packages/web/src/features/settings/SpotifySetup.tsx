import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { CopyField } from "../../components/CopyField";

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
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-medium text-ink">Spotify app</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Create an app at{" "}
          <a
            href="https://developer.spotify.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            developer.spotify.com/dashboard
          </a>
          , add the redirect URI below to it, then paste the client ID here.
          No client secret needed (PKCE).
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-ink-muted">
          Client ID
          {s.envLocked.spotifyClientId && (
            <span className="ml-2 text-ink-muted">— set by environment</span>
          )}
        </label>
        <Input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={s.envLocked.spotifyClientId}
          placeholder="e.g. 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
          className="font-mono text-xs"
        />
      </div>

      <CopyField label="Redirect URI (register this in the dashboard)" value={s.redirectUri} />

      <div className="space-y-1">
        <label className="text-xs text-ink-muted">
          Public URL — only if reaching this from another device
          {s.envLocked.publicUrl && (
            <span className="ml-2 text-ink-muted">— set by environment</span>
          )}
        </label>
        <Input
          value={publicUrl}
          onChange={(e) => setPublicUrl(e.target.value)}
          disabled={s.envLocked.publicUrl}
          placeholder="https://album.example.com"
        />
        <p className="text-xs text-ink-muted">
          Spotify only allows a plain-http redirect for 127.0.0.1. A remote URL
          must be https (put a reverse proxy or tunnel in front). The redirect
          URI updates to match.
        </p>
      </div>

      {save.isError && (
        <p className="text-sm text-danger">{(save.error as Error).message}</p>
      )}

      <Button variant="primary" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
        {save.isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
