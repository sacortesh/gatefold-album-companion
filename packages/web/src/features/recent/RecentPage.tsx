import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import type { RecentRow } from "@gatefold/shared";
import { formatRelative } from "../../lib/format";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { TriageButton } from "../../components/TriageButton";
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
        row.isCurrent ? "bg-surface" : "hover:bg-surface/60"
      }`}
    >
      <Link
        to={`/album/${row.track.albumId}`}
        className="h-11 w-11 shrink-0 overflow-hidden rounded bg-surface-2"
      >
        {row.track.image && (
          <img
            src={row.track.image}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {row.track.name}
          {row.isCurrent && (
            <Badge variant="now-playing" className="ml-2">
              now
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-ink-muted">
          {row.track.artists.join(", ")} ·{" "}
          <Link to={`/album/${row.track.albumId}`} className="hover:text-ink">
            {row.track.albumName}
          </Link>{" "}
          · {formatRelative(row.playedAt)}
        </p>
      </div>

      <TriageButton kind="like" active={row.liked} onToggle={onLike} pending={pending} />
      <TriageButton
        kind="banger"
        active={row.inBanger}
        label={bangerLabel}
        onToggle={onBanger}
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
        <h1 className="font-display text-2xl font-semibold">Recently listened</h1>
        <p className="text-sm text-ink-muted">
          Spotify isn&apos;t connected.{" "}
          <Link to="/settings" className="text-primary hover:underline">
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
        <h1 className="font-display text-2xl font-semibold">Recently listened</h1>
        <div className="flex items-center gap-3">
          {!bangerPlaylistId && (
            <Link to="/settings" className="text-xs text-banger hover:underline">
              Set a Banger playlist →
            </Link>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={`size-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {query.isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
      {query.isError && (
        <p className="text-sm text-danger">{query.error.message}</p>
      )}
      {query.isSuccess && rows.length === 0 && (
        <p className="text-sm text-ink-muted">
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
            onBanger={() => fireBanger(row.track.id, row.inBanger)}
          />
        ))}
      </ul>
    </section>
  );
}
