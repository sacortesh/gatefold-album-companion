import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setApiKey } from "../../api/client";

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

/** API key (required on every `/api/*` call) + optional forms auth for the
 *  SPA itself. Both live in Settings → Security, mirroring Sonarr. */
export function SecuritySettings() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["app-settings"],
    queryFn: api.appSettings,
  });

  const regenerate = useMutation({
    mutationFn: api.regenerateApiKey,
    onSuccess: (next) => {
      qc.setQueryData(["app-settings"], next);
      setApiKey(next.apiKey); // this browser keeps working without a reload
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (settings.data) {
      setEnabled(settings.data.uiAuth.enabled);
      setUsername(settings.data.uiAuth.username);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      api.updateUiAuth({
        enabled,
        username,
        ...(password ? { password } : {}),
      }),
    onSuccess: (next) => {
      qc.setQueryData(["app-settings"], next);
      setPassword("");
      // Saving always rotates the session epoch server-side, so this
      // browser's cookie (if any) is no longer valid — re-run the gate.
      void qc.invalidateQueries({ queryKey: ["session"] });
    },
  });

  const logout = useMutation({
    mutationFn: api.uiLogout,
    onSuccess: () => {
      setApiKey(null);
      void qc.invalidateQueries({ queryKey: ["session"] });
    },
  });

  const s = settings.data;
  if (!s) return null;

  const authDirty =
    enabled !== s.uiAuth.enabled || username !== s.uiAuth.username || password.length > 0;
  const canEnable = enabled
    ? Boolean(username) && (s.uiAuth.passwordSet || Boolean(password))
    : true;

  return (
    <div className="space-y-6 rounded-lg border border-neutral-800 p-4">
      <div>
        <h2 className="text-sm font-medium text-neutral-300">Security</h2>
        <p className="mt-1 text-xs text-neutral-500">
          The API key is required on every request; sign-in is an optional
          extra layer for the app itself.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-medium text-neutral-400">API key</h3>
        <CopyField label="X-Api-Key header (or ?apikey=)" value={s.apiKey} />
        {regenerate.isError && (
          <p className="text-sm text-red-400">
            {(regenerate.error as Error).message}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Regenerate the API key? Anything using the old key stops working.")) {
              regenerate.mutate();
            }
          }}
          disabled={regenerate.isPending}
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
        >
          {regenerate.isPending ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      <div className="space-y-3 border-t border-neutral-800 pt-4">
        <h3 className="text-xs font-medium text-neutral-400">Sign-in</h3>

        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-900"
          />
          Require a username + password to open the app
        </label>

        {enabled && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-neutral-400">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-neutral-400">
                Password
                {s.uiAuth.enabled && (
                  <span className="ml-2 text-neutral-600">
                    — leave blank to keep the current one
                  </span>
                )}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {save.isError && (
          <p className="text-sm text-red-400">{(save.error as Error).message}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!authDirty || !canEnable || save.isPending}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
          {s.uiAuth.enabled && (
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
