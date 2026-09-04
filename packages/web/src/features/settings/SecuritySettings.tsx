import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setApiKey } from "../../api/client";
import { Button } from "../../components/ui/button";
import { CopyField } from "../../components/CopyField";

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
    <div className="space-y-6 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-medium text-ink">Security</h2>
        <p className="mt-1 text-xs text-ink-muted">
          The API key is required on every request; sign-in is an optional
          extra layer for the app itself.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-medium text-ink-muted">API key</h3>
        <CopyField label="X-Api-Key header (or ?apikey=)" value={s.apiKey} masked />
        {regenerate.isError && (
          <p className="text-sm text-danger">
            {(regenerate.error as Error).message}
          </p>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            if (window.confirm("Regenerate the API key? Anything using the old key stops working.")) {
              regenerate.mutate();
            }
          }}
          disabled={regenerate.isPending}
        >
          {regenerate.isPending ? "Regenerating…" : "Regenerate"}
        </Button>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="text-xs font-medium text-ink-muted">Sign-in</h3>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-surface accent-primary"
          />
          Require a username + password to open the app
        </label>

        {enabled && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-ink-muted">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-muted">
                Password
                {s.uiAuth.enabled && (
                  <span className="ml-2 text-ink-muted">
                    — leave blank to keep the current one
                  </span>
                )}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink"
              />
            </div>
          </div>
        )}

        {save.isError && (
          <p className="text-sm text-danger">{(save.error as Error).message}</p>
        )}

        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={() => save.mutate()}
            disabled={!authDirty || !canEnable || save.isPending}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          {s.uiAuth.enabled && (
            <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
              Sign out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
