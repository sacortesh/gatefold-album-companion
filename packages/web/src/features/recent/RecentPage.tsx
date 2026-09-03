import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import type { RecentRow } from "@gatefold/shared";
import { formatRelative } from "../../lib/format";
import { BangerButton, LikeButton } from "./TriageControls";
import { useRecent } from "./useRecent";

function Row({
  row,
  bangerLabel,
  pending,
  onLike,
  onBanger,
}: {
  row: RecentRow;
  bangerLabel: string;
  pending: boolean;
  onLike: () => void;
  onBanger: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-md px-2 py-2 ${
        row.isCurrent ? "bg-neutral-900" : "hover:bg-neutral-900/60"
      }`}
    >
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded bg-neutral-800">
        {row.track.image && (
          <img
            src={row.track.image}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {row.track.name}
          {row.isCurrent && (
            <span className="ml-2 rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
              now
            </span>
          )}
        </p>
        <p className="truncate text-xs text-neutral-500">
          {row.track.artists.join(", ")} · {formatRelative(row.playedAt)}
        </p>
      </div>

      <LikeButton liked={row.liked} onToggle={onLike} pending={pending} />
      <BangerButton
        inBanger={row.inBanger}
        label={bangerLabel}
        onFire={onBanger}
        pending={pending}
      />
    </li>
  );
}

export function RecentPage() {
  const {
    query,
    notConnected,
    rows,
    bangerLabel,
    bangerPlaylistId,
    toggleLike,
    fireBanger,
    pendingTrackId,
  } = useRecent();

  if (notConnected) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Recently listened</h1>
        <p className="text-sm text-neutral-400">
          Spotify isn&apos;t connected.{" "}
          <Link to="/settings" className="text-emerald-400 hover:underline">
            Connect in Settings
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Recently listened</h1>
        <div className="flex items-center gap-3">
          {!bangerPlaylistId && (
            <Link
              to="/settings"
              className="text-xs text-amber-400 hover:underline"
            >
              Set a Banger playlist →
            </Link>
          )}
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {query.isLoading && (
        <p className="text-sm text-neutral-500">Loading…</p>
      )}
      {query.isError && (
        <p className="text-sm text-red-400">{query.error.message}</p>
      )}
      {query.isSuccess && rows.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nothing yet — play something and it&apos;ll show up here (last 50
          tracks).
        </p>
      )}

      <ul className="space-y-0.5">
        {rows.map((row) => (
          <Row
            key={row.track.id}
            row={row}
            bangerLabel={bangerLabel}
            pending={pendingTrackId === row.track.id}
            onLike={() => toggleLike(row.track.id, row.liked)}
            onBanger={() => fireBanger(row.track.id)}
          />
        ))}
      </ul>
    </section>
  );
}
