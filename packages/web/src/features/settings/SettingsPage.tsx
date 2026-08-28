import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, startSpotifyLogin } from "../../api/client";
import { BangerPlaylistPicker } from "./BangerPlaylistPicker";
import { DevicePicker } from "./DevicePicker";
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
          ? "border-emerald-800 bg-emerald-950 text-emerald-200"
          : "border-red-800 bg-red-950 text-red-200"
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
      <h1 className="text-2xl font-semibold">Settings</h1>

      {banner && <Banner kind={banner} />}

      <div className="space-y-3 rounded-lg border border-neutral-800 p-4">
        <h2 className="text-sm font-medium text-neutral-300">Spotify</h2>

        {status.isLoading && (
          <p className="text-sm text-neutral-500">Checking connection…</p>
        )}

        {status.isError && (
          <p className="text-sm text-red-400">
            Couldn&apos;t reach the server: {(status.error as Error).message}
          </p>
        )}

        {s && !s.configured && (
          <p className="text-sm text-neutral-400">
            Not configured yet — set a client ID below.
          </p>
        )}

        {s?.configured && !s.connected && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-400">Not connected.</p>
            <button
              type="button"
              onClick={startSpotifyLogin}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Connect Spotify
            </button>
          </div>
        )}

        {s?.connected && (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Connected{s.user?.displayName ? ` as ${s.user.displayName}` : ""}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-neutral-400">
              <dt>Scopes</dt>
              <dd>{s.scopes.length} granted</dd>
              <dt>Token expires</dt>
              <dd>
                {s.expiresAt
                  ? new Date(s.expiresAt).toLocaleTimeString()
                  : "refreshing on next call"}
              </dd>
            </dl>
            <button
              type="button"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      <SpotifySetup />

      {s?.connected && <DevicePicker />}

      {s?.connected && <BangerPlaylistPicker />}

      {import.meta.env.DEV && s?.connected && (
        <div className="space-y-2 rounded-lg border border-dashed border-neutral-800 p-4">
          <h2 className="text-sm font-medium text-neutral-400">
            Developer — token refresh
          </h2>
          <p className="text-xs text-neutral-500">
            Then reload the status above; the next Spotify call should recover
            transparently.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => debug.mutate("expire")}
              className="rounded border border-neutral-700 px-3 py-1 text-xs hover:bg-neutral-800"
            >
              Expire access token
            </button>
            <button
              type="button"
              onClick={() => debug.mutate("corrupt")}
              className="rounded border border-neutral-700 px-3 py-1 text-xs hover:bg-neutral-800"
            >
              Corrupt access token (force 401)
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
