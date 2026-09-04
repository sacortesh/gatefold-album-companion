import { Pause, Play, SkipForward } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDuration } from "../lib/format";
import { useRecent } from "../features/recent/useRecent";
import { useHotkeys } from "../features/triage/useTriageHotkeys";
import { usePlayback } from "../features/now-playing/usePlayback";
import { Button } from "./ui/button";
import { ProgressBar } from "./ui/progress-bar";
import { TriageButton } from "./TriageButton";

/**
 * Ambient player that rides along the bottom of every page — small art, track
 * info, Like / Banger, play-pause, skip, and a progress bar (display only).
 * Hidden when nothing is playing or Spotify isn't connected. The full transport
 * lives on the Now Playing page and the album view.
 *
 * `P` toggles play/pause from anywhere.
 */
export function NowPlayingCard() {
  const { state, displayMs, notConnected, controls } = usePlayback();
  const recent = useRecent();

  const track = state?.track ?? null;

  useHotkeys({ p: () => controls.toggle() }, Boolean(track));

  if (notConnected || !track) return null;

  const current =
    recent.currentRow?.track.id === track.id ? recent.currentRow : null;
  const liked = current?.liked ?? false;
  const inBanger = current?.inBanger ?? false;
  const pending = recent.pendingTrackId === track.id;
  const pct = track.durationMs
    ? Math.min(100, (displayMs / track.durationMs) * 100)
    : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-2.5">
        <Link
          to={`/album/${track.album.id}`}
          className="h-11 w-11 shrink-0 overflow-hidden rounded bg-surface-2"
        >
          {track.album.image && (
            <img
              src={track.album.image}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <Link to="/now-playing" className="hover:underline">
              {track.name}
            </Link>
          </p>
          <p className="truncate text-xs text-ink-muted">
            {track.artists.join(", ")} ·{" "}
            <Link to={`/album/${track.album.id}`} className="hover:text-ink">
              {track.album.name}
            </Link>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar pct={pct} className="h-0.5" />
            <span className="shrink-0 text-[10px] tabular-nums text-ink-muted">
              {formatDuration(displayMs)} / {formatDuration(track.durationMs)}
            </span>
          </div>
        </div>

        <TriageButton
          kind="like"
          active={liked}
          pending={pending}
          onToggle={() => recent.toggleLike(track.id, liked)}
        />
        <TriageButton
          kind="banger"
          active={inBanger}
          label={recent.bangerLabel}
          pending={pending}
          onToggle={() => recent.fireBanger(track.id)}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={controls.toggle}
          aria-label={state?.isPlaying ? "Pause" : "Play"}
        >
          {state?.isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </Button>
        <Button variant="secondary" size="sm" onClick={controls.next} aria-label="Next track">
          <SkipForward className="size-4" />
        </Button>
      </div>
    </div>
  );
}
