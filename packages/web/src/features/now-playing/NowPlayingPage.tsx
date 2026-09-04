import { type MouseEvent } from "react";
import { SkipBack, SkipForward, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { Device } from "@gatefold/shared";
import { formatDuration } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { TriageButton } from "../../components/TriageButton";
import { RecentPage } from "../recent/RecentPage";
import { useRecent } from "../recent/useRecent";
import { useTriageHotkeys } from "../triage/useTriageHotkeys";
import { usePlayback } from "./usePlayback";

function DeviceLine({ device }: { device: Device | null }) {
  if (!device) return null;
  return (
    <p className="text-xs text-ink-muted">
      Playing on <span className="text-ink">{device.name}</span>
      {device.volumePercent !== null ? ` · vol ${device.volumePercent}%` : ""}
    </p>
  );
}

function ConnectPrompt() {
  return (
    <section className="space-y-3">
      <h1 className="font-display text-2xl font-semibold">Now Playing</h1>
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

export function NowPlayingPage() {
  const { state, displayMs, notConnected, query, controls } = usePlayback();
  const recent = useRecent();

  const trackId = state?.track?.id ?? null;
  const currentRow =
    recent.currentRow?.track.id === trackId ? recent.currentRow : null;
  const liked = currentRow?.liked ?? false;
  const inBanger = currentRow?.inBanger ?? false;
  const triagePending = recent.pendingTrackId === trackId;

  useTriageHotkeys(
    Boolean(trackId),
    () => trackId && recent.toggleLike(trackId, liked),
    () => trackId && recent.fireBanger(trackId),
  );

  if (notConnected) return <ConnectPrompt />;

  if (query.isLoading) {
    return <p className="text-sm text-ink-muted">Loading playback…</p>;
  }

  if (query.isError) {
    return (
      <p className="text-sm text-danger">
        Couldn&apos;t read playback: {query.error.message}
      </p>
    );
  }

  const track = state?.track ?? null;

  if (!track) {
    return (
      <div className="space-y-10">
        <section className="space-y-3">
          <h1 className="font-display text-2xl font-semibold">Now Playing</h1>
          <p className="text-sm text-ink-muted">
            Nothing is playing. Start something in any Spotify app, or set a
            device in{" "}
            <Link to="/settings" className="text-primary hover:underline">
              Settings
            </Link>
            .
          </p>
          <DeviceLine device={state?.device ?? null} />
        </section>
        <RecentPage />
      </div>
    );
  }

  const pct = track.durationMs ? (displayMs / track.durationMs) * 100 : 0;
  const inAlbum =
    state?.contextType === "album" &&
    track.trackNumber &&
    track.album.totalTracks;

  const onScrub = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    controls.seek(Math.round(frac * track.durationMs));
  };

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <div className="h-48 w-48 shrink-0 overflow-hidden rounded-lg bg-surface">
            {track.album.image && (
              <img
                src={track.album.image}
                alt={track.album.name}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="truncate font-display text-2xl font-semibold">
              {track.name}
            </h1>
            <p className="truncate font-display italic text-ink-muted">
              {track.artists.join(", ")}
            </p>
            <p className="truncate text-sm text-ink-muted">
              <Link
                to={`/album/${track.album.id}`}
                className="hover:text-ink hover:underline"
              >
                {track.album.name}
              </Link>
              {inAlbum
                ? ` · track ${track.trackNumber} of ${track.album.totalTracks}`
                : ""}
            </p>
            <DeviceLine device={state?.device ?? null} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div
            role="slider"
            aria-label="Seek"
            aria-valuenow={Math.round(displayMs / 1000)}
            aria-valuemax={Math.round(track.durationMs / 1000)}
            aria-valuemin={0}
            tabIndex={0}
            onClick={onScrub}
            className="group h-2 cursor-pointer rounded-full bg-surface-2"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-linear group-active:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs tabular-nums text-ink-muted">
            <span>{formatDuration(displayMs)}</span>
            <span>{formatDuration(track.durationMs)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="lg" onClick={controls.previous} aria-label="Previous track">
            <SkipBack className="size-4" />
          </Button>
          <Button variant="primary" size="lg" onClick={controls.toggle}>
            {state?.isPlaying ? "Pause" : "Play"}
          </Button>
          <Button variant="secondary" size="lg" onClick={controls.next} aria-label="Next track">
            <SkipForward className="size-4" />
          </Button>

          <span className="mx-1 h-6 w-px bg-border" />

          <TriageButton
            kind="like"
            size="lg"
            active={liked}
            pending={triagePending}
            onToggle={() => recent.toggleLike(track.id, liked)}
          />
          <TriageButton
            kind="banger"
            size="lg"
            active={inBanger}
            label={recent.bangerLabel}
            pending={triagePending}
            onToggle={() => recent.fireBanger(track.id)}
          />
        </div>

        <p className="text-xs text-ink-muted">
          Shortcuts: <kbd>P</kbd> play/pause · <kbd>L</kbd> like · <kbd>B</kbd>{" "}
          banger · click the bar to seek
        </p>

        {controls.error && (
          <div className="flex items-start justify-between gap-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            <span>{controls.error}</span>
            <button
              type="button"
              onClick={controls.clearError}
              className="text-danger hover:opacity-80"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      </section>

      <RecentPage />
    </div>
  );
}
