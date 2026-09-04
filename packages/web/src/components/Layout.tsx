import { Link, NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { GatefoldMark } from "./GatefoldMark";
import { NowPlayingCard } from "./NowPlayingCard";

const navItems = [
  { to: "/", label: "Backlog", end: true },
  { to: "/now-playing", label: "Now Playing" },
  { to: "/recent", label: "Recent" },
  { to: "/revisit", label: "Revisit" },
  { to: "/reviews", label: "Reviews" },
  { to: "/settings", label: "Settings" },
];

function UpdateBanner() {
  const { data } = useQuery({
    queryKey: ["version"],
    queryFn: api.version,
    staleTime: 3600_000,
  });

  if (!data?.updateAvailable) return null;

  return (
    <Link
      to="/settings"
      className="mt-3 block rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-center text-xs text-primary hover:bg-primary/15"
    >
      Gatefold {data.latest} is available — see Settings → About
    </Link>
  );
}

function HealthDot() {
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 30_000,
  });

  const ok = Boolean(data?.ok) && !isError;
  return (
    <span className="flex items-center gap-2 text-xs text-ink-muted">
      <span
        className={`h-2 w-2 rounded-full ${ok ? "bg-primary" : "bg-danger"}`}
      />
      {ok ? `api v${data?.version}` : "api offline"}
    </span>
  );
}

export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <UpdateBanner />
      {/* Single row at desktop (taste-checklist: nav ≤80px, one line) —
          wraps below the app's documented ~360px overflow breakpoint
          instead of a hard two-row split. */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border py-3">
        <Link
          to="/"
          className="flex items-center gap-1.5 font-display text-sm font-semibold tracking-tight text-ink"
        >
          <GatefoldMark /> Gatefold
        </Link>
        <nav className="flex flex-1 flex-wrap gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-surface-2 text-ink"
                    : "text-ink-muted hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <HealthDot />
      </header>

      <main className="flex-1 py-8 pb-28">
        <Outlet />
      </main>

      <NowPlayingCard />
    </div>
  );
}
