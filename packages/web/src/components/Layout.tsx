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
      className="mt-3 block rounded-md border border-emerald-900 bg-emerald-950 px-3 py-1.5 text-center text-xs text-emerald-200 hover:bg-emerald-900"
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
    <span className="flex items-center gap-2 text-xs text-neutral-400">
      <span
        className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
      />
      {ok ? `api v${data?.version}` : "api offline"}
    </span>
  );
}

export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <UpdateBanner />
      <header className="border-b border-neutral-800 py-4">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="text-sm font-semibold tracking-tight text-neutral-100"
          >
            <GatefoldMark /> Gatefold
          </Link>
          <HealthDot />
        </div>
        <nav className="mt-3 flex flex-wrap gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-neutral-800 text-neutral-50"
                    : "text-neutral-400 hover:text-neutral-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 py-8 pb-28">
        <Outlet />
      </main>

      <NowPlayingCard />
    </div>
  );
}
