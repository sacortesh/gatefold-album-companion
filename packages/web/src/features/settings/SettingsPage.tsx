import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, startSpotifyLogin } from "../../api/client";
import { Button } from "../../components/ui/button";
import { AboutSettings } from "./AboutSettings";
import { AttributionSettings } from "./AttributionSettings";
import { BangerPlaylistPicker } from "./BangerPlaylistPicker";
import { DevicePicker } from "./DevicePicker";
import { DiscogsSetup } from "./DiscogsSetup";
import { LastfmSetup } from "./LastfmSetup";
import { LinksSettings } from "./LinksSettings";
import { SecuritySettings } from "./SecuritySettings";
import { SpotifySetup } from "./SpotifySetup";

const AUTH_MESSAGES: Record<string, { tone: "ok" | "err"; text: string }> = {
  connected: { tone: "ok", text: "Connected to Spotify." },
  denied: { tone: "err", text: "You declined the Spotify permission request." },
  invalid: { tone: "err", text: "Login link expired or was tampered with — try again." },
  failed: { tone: "err", text: "Could not complete the Spotify login. Try again." },
  unconfigured: {
    tone: "err",
    text: "Set a Spotify client ID below before connecting.",
  },
};

function Banner({ kind }: { kind: string }) {
  const msg = AUTH_MESSAGES[kind];
  if (!msg) return null;
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        msg.tone === "ok"
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-danger/40 bg-danger/10 text-danger"
      }`}
    >
      {msg.text}
    </div>
  );
}

export function SettingsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const auth = params.get("auth");
    if (auth) {
      setBanner(auth);
      const next = new URLSearchParams(params);
      next.delete("auth");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const status = useQuery({
    queryKey: ["auth-status"],
    queryFn: api.authStatus,
    refetchInterval: 60_000,
  });

  const disconnect = useMutation({
    mutationFn: api.authDisconnect,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-status"] }),
  });

  const debug = useMutation({
    mutationFn: (a: "expire" | "corrupt") => api.authDebug(a),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-status"] }),
  });

  const s = status.data;

  return (
    <section className="max-w-xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>

      {banner && <Banner kind={banner} />}

      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-ink">Spotify</h2>

        {status.isLoading && (
          <p className="text-sm text-ink-muted">Checking connection…</p>
        )}

        {status.isError && (
          <p className="text-sm text-danger">
            Couldn&apos;t reach the server: {(status.error as Error).message}
          </p>
        )}

        {s && !s.configured && (
          <p className="text-sm text-ink-muted">
            Not configured yet — set a client ID below.
          </p>
        )}

        {s?.configured && !s.connected && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">Not connected.</p>
            <Button variant="primary" onClick={startSpotifyLogin}>
              Connect Spotify
            </Button>
          </div>
        )}

        {s?.connected && (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Connected{s.user?.displayName ? ` as ${s.user.displayName}` : ""}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ink-muted">
              <dt>Scopes</dt>
              <dd>{s.scopes.length} granted</dd>
              <dt>Token expires</dt>
              <dd>
                {s.expiresAt
                  ? new Date(s.expiresAt).toLocaleTimeString()
                  : "refreshing on next call"}
              </dd>
            </dl>
            <Button
              variant="secondary"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              Disconnect
            </Button>
          </div>
        )}
      </div>

      <SpotifySetup />

      <DiscogsSetup />

      <LastfmSetup />

      <LinksSettings />

      <SecuritySettings />

      {s?.connected && <DevicePicker />}

      {s?.connected && <BangerPlaylistPicker />}

      <AboutSettings />

      <AttributionSettings />

      {import.meta.env.DEV && s?.connected && (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-4">
          <h2 className="text-sm font-medium text-ink-muted">
            Developer — token refresh
          </h2>
          <p className="text-xs text-ink-muted">
            Then reload the status above; the next Spotify call should recover
            transparently.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => debug.mutate("expire")}>
              Expire access token
            </Button>
            <Button variant="secondary" size="sm" onClick={() => debug.mutate("corrupt")}>
              Corrupt access token (force 401)
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
