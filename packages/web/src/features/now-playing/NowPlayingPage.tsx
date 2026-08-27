import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import type { Device } from "@spotify-companion/shared";
import { formatDuration } from "../../lib/format";
import { usePlayback } from "./usePlayback";

function DeviceLine({ device }: { device: Device | null }) {
  if (!device) return null;
  return (
    <p className="text-xs text-neutral-500">
      Playing on <span className="text-neutral-300">{device.name}</span>
      {device.volumePercent !== null ? ` · vol ${device.volumePercent}%` : ""}
    </p>
  );
}

function ConnectPrompt() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Now Playing</h1>
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

export function NowPlayingPage() {
  const { state, displayMs, notConnected, query, controls } = usePlayback();

  if (notConnected) return <ConnectPrompt />;

  if (query.isLoading) {
    return <p className="text-sm text-neutral-500">Loading playback…</p>;
  }

  if (query.isError) {
    return (
      <p className="text-sm text-red-400">
        Couldn&apos;t read playback: {query.error.message}
      </p>
    );
  }

  const track = state?.track ?? null;

  if (!track) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Now Playing</h1>
        <p className="text-sm text-neutral-400">
          Nothing is playing. Start something in any Spotify app, or set a
          device in{" "}
          <Link to="/settings" className="text-emerald-400 hover:underline">
            Settings
          </Link>
          .
        </p>
        <DeviceLine device={state?.device ?? null} />
      </section>
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
    <section className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="h-48 w-48 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
          {track.album.image && (
            <img
              src={track.album.image}
              alt={track.album.name}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-2xl font-semibold">{track.name}</h1>
          <p className="truncate text-neutral-300">
            {track.artists.join(", ")}
          </p>
          <p className="truncate text-sm text-neutral-500">
            {track.album.name}
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
          className="group h-2 cursor-pointer rounded-full bg-neutral-800"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-linear group-active:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs tabular-nums text-neutral-500">
          <span>{formatDuration(displayMs)}</span>
          <span>{formatDuration(track.durationMs)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={controls.previous}
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
          aria-label="Previous track"
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={controls.toggle}
          className="rounded-md bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {state?.isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={controls.next}
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
          aria-label="Next track"
        >
          ⏭
        </button>
      </div>

      {controls.error && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-200">
          <span>{controls.error}</span>
          <button
            type="button"
            onClick={controls.clearError}
            className="text-red-400 hover:text-red-200"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
