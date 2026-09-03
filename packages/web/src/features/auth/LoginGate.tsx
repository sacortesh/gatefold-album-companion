import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setApiKey, setOnUnauthorized } from "../../api/client";
import { GatefoldMark } from "../../components/GatefoldMark";

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.uiLogin(username, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm space-y-4 px-6">
      <h1 className="text-center text-lg font-semibold text-neutral-100">
        <GatefoldMark className="size-5" /> Gatefold
      </h1>
      <form
        onSubmit={submit}
        className="space-y-3 rounded-lg border border-neutral-800 p-4"
      >
        <div className="space-y-1">
          <label className="text-xs text-neutral-400">Username</label>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-400">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending || !username || !password}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function CenterMessage({ text }: { text: string }) {
  return (
    <p className="mx-auto mt-24 max-w-sm px-6 text-center text-sm text-neutral-500">
      {text}
    </p>
  );
}

/** Boots the app: fetches `/auth/session`, shows a login form if UI auth is
 *  on and the browser has no valid session cookie, otherwise stores the API
 *  key from the response and renders the real app. */
export function LoginGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
    staleTime: Infinity,
  });

  useEffect(() => {
    setOnUnauthorized(() => {
      setApiKey(null);
      void qc.invalidateQueries({ queryKey: ["session"] });
    });
    return () => setOnUnauthorized(null);
  }, [qc]);

  if (session.isLoading || !session.data) return <CenterMessage text="Loading…" />;
  if (session.isError) {
    return <CenterMessage text="Couldn't reach the server." />;
  }

  if (!session.data.authenticated) {
    setApiKey(null);
    return (
      <LoginForm
        onSuccess={() => void qc.invalidateQueries({ queryKey: ["session"] })}
      />
    );
  }

  // Set inline (not in an effect) — child effects fire before parent effects,
  // so children's queries would otherwise race the key being stored.
  setApiKey(session.data.apiKey);
  return <>{children}</>;
}
