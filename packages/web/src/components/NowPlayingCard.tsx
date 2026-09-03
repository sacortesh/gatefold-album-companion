import { Pause, Play, SkipForward } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDuration } from "../lib/format";
import { BangerButton, LikeButton } from "../features/recent/TriageControls";
import { useRecent } from "../features/recent/useRecent";
import { useHotkeys } from "../features/triage/useTriageHotkeys";
import { usePlayback } from "../features/now-playing/usePlayback";

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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-2.5">
        <Link
          to={`/album/${track.album.id}`}
          className="h-11 w-11 shrink-0 overflow-hidden rounded bg-neutral-800"
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
          <p className="truncate text-xs text-neutral-500">
            {track.artists.join(", ")} ·{" "}
            <Link
              to={`/album/${track.album.id}`}
              className="hover:text-neutral-300"
            >
              {track.album.name}
            </Link>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-0.5 flex-1 rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-neutral-600">
              {formatDuration(displayMs)} / {formatDuration(track.durationMs)}
            </span>
          </div>
        </div>

        <LikeButton
          liked={liked}
          pending={pending}
          onToggle={() => recent.toggleLike(track.id, liked)}
        />
        <BangerButton
          inBanger={inBanger}
          label={recent.bangerLabel}
          pending={pending}
          onFire={() => recent.fireBanger(track.id)}
        />
        <button
          type="button"
          onClick={controls.toggle}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          aria-label={state?.isPlaying ? "Pause" : "Play"}
        >
          {state?.isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={controls.next}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
          aria-label="Next track"
        >
          <SkipForward className="size-4" />
        </button>
      </div>
    </div>
  );
}
