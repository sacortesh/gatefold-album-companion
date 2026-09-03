import { useState } from "react";
import { Play, RefreshCw, SkipBack, SkipForward } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AlbumTrack } from "@gatefold/shared";
import { api, ApiRequestError } from "../../api/client";
import { formatDuration } from "../../lib/format";
import { useBacklog } from "../backlog/useBacklog";
import { usePlayback } from "../now-playing/usePlayback";
import { BangerButton, LikeButton } from "../recent/TriageControls";
import { VerdictDialog } from "../review/VerdictDialog";
import { useAlbumReview } from "../review/useVerdict";
import { useTriageHotkeys } from "../triage/useTriageHotkeys";
import { AlbumContextPanel } from "./AlbumContextPanel";
import { LyricsPanel } from "./LyricsPanel";
import { useAlbumTriage } from "./useAlbumTriage";

function TrackRow({
  track,
  index,
  selected,
  isNow,
  showArtist,
  liked,
  inBanger,
  bangerLabel,
  pending,
  onSelect,
  onPlay,
  onLike,
  onBanger,
}: {
  track: AlbumTrack;
  index: number;
  selected: boolean;
  isNow: boolean;
  showArtist: boolean;
  liked: boolean;
  inBanger: boolean;
  bangerLabel: string;
  pending: boolean;
  onSelect: () => void;
  onPlay: () => void;
  onLike: () => void;
  onBanger: () => void;
}) {
  return (
    <li
      onClick={onSelect}
      className={`group flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 ${
        selected ? "bg-neutral-900" : "hover:bg-neutral-900/50"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        className="w-6 shrink-0 text-center text-xs text-neutral-500 hover:text-emerald-400"
        title="Play from here"
      >
        <span className="group-hover:hidden">{track.trackNumber ?? index + 1}</span>
        <Play className="mx-auto hidden size-3.5 group-hover:block" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {track.name}
          {track.explicit && (
            <span className="ml-1.5 rounded bg-neutral-800 px-1 text-[9px] text-neutral-400">
              E
            </span>
          )}
          {isNow && (
            <span className="ml-2 rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
              now
            </span>
          )}
        </p>
        {showArtist && (
          <p className="truncate text-xs text-neutral-500">
            {track.artists.join(", ")}
          </p>
        )}
      </div>

      <span className="shrink-0 text-xs tabular-nums text-neutral-600">
        {formatDuration(track.durationMs)}
      </span>
      <LikeButton liked={liked} onToggle={onLike} pending={pending} />
      <BangerButton
        inBanger={inBanger}
        label={bangerLabel}
        onFire={onBanger}
        pending={pending}
      />
    </li>
  );
}

export function AlbumPage() {
  const { id = "" } = useParams();
  const [picked, setPicked] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const album = useQuery<Awaited<ReturnType<typeof api.album>>, ApiRequestError>({
    queryKey: ["album", id],
    queryFn: () => api.album(id),
    enabled: Boolean(id),
  });
  const lyrics = useQuery({
    queryKey: ["album-lyrics", id],
    queryFn: () => api.albumLyrics(id),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });

  const { state, displayMs, controls } = usePlayback();
  const backlog = useBacklog();
  const review = useAlbumReview(id);

  const tracks = album.data?.tracks ?? [];
  const triage = useAlbumTriage(
    id,
    tracks.map((t) => t.id),
  );

  const nowId = state?.track?.id ?? null;
  const nowInAlbum = tracks.some((t) => t.id === nowId);
  const selectedId = picked ?? (nowInAlbum ? nowId : (tracks[0]?.id ?? null));
  const thisAlbumIsPlaying = Boolean(
    album.data && state?.contextUri === album.data.uri,
  );

  // L / B act on the playing track when it's on this album, otherwise on the
  // selected row.
  const hotkeyTargetId = nowInAlbum ? nowId : selectedId;
  useTriageHotkeys(
    Boolean(hotkeyTargetId),
    () =>
      hotkeyTargetId &&
      triage.toggleLike(hotkeyTargetId, triage.stateFor(hotkeyTargetId).liked),
    () => hotkeyTargetId && triage.fireBanger(hotkeyTargetId),
  );

  const playAlbum = useMutation({
    mutationFn: () =>
      api.play({ contextUri: album.data!.uri, shuffle: false, repeat: "off" }),
  });
  const playFrom = useMutation({
    mutationFn: (trackUri: string) =>
      api.play({
        contextUri: album.data!.uri,
        offset: { uri: trackUri },
        shuffle: false,
        repeat: "off",
      }),
  });

  if (album.error?.status === 401) {
    return (
      <p className="text-sm text-neutral-400">
        Spotify isn&apos;t connected.{" "}
        <Link to="/settings" className="text-emerald-400 hover:underline">
          Connect in Settings
        </Link>
        .
      </p>
    );
  }
  if (album.isLoading)
    return <p className="text-sm text-neutral-500">Loading album…</p>;
  if (album.isError || !album.data)
    return (
      <p className="text-sm text-red-400">
        {album.error?.message ?? "Couldn't load that album."}
      </p>
    );

  const a = album.data;
  const selectedTrack = tracks.find((t) => t.id === selectedId) ?? null;
  const albumArtistKey = a.artists.join("|");

  const playMutationError = (playAlbum.error ?? playFrom.error) as
    | Error
    | undefined;
  const backlogMutationError = (backlog.add.error ?? backlog.remove.error) as
    | Error
    | undefined;

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="h-44 w-44 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
          {a.image && (
            <img src={a.image} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold">{a.name}</h1>
          <p className="text-neutral-300">{a.artists.join(", ")}</p>
          <p className="text-sm text-neutral-500">
            {[
              a.year,
              `${a.totalTracks} track${a.totalTracks === 1 ? "" : "s"}`,
              formatDuration(a.durationMs),
              a.label,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {a.genres.length > 0 && (
            <p className="text-xs text-neutral-600">{a.genres.join(", ")}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {thisAlbumIsPlaying ? (
              <>
                <button
                  type="button"
                  onClick={controls.previous}
                  className="rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
                  aria-label="Previous track"
                >
                  <SkipBack className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={controls.toggle}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  {state?.isPlaying ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={controls.next}
                  className="rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
                  aria-label="Next track"
                >
                  <SkipForward className="size-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => playAlbum.mutate()}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Play album
              </button>
            )}
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
            >
              {review.data ? "Update review" : "Finish album"}
            </button>
            {a.inBacklog ? (
              <button
                type="button"
                onClick={() => backlog.remove.mutate(a.id)}
                disabled={backlog.remove.isPending}
                className="rounded-md border border-neutral-800 px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 disabled:opacity-50"
              >
                {backlog.remove.isPending ? "Removing…" : "Remove from backlog"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => backlog.add.mutate(a.id)}
                disabled={backlog.add.isPending}
                className="rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
              >
                {backlog.add.isPending ? "Adding…" : "Add to backlog"}
              </button>
            )}
          </div>
          {playMutationError && (
            <p className="text-sm text-red-400">{playMutationError.message}</p>
          )}
          {backlogMutationError && (
            <p className="text-sm text-red-400">
              Couldn&apos;t update the backlog: {backlogMutationError.message}
            </p>
          )}

          {review.data && (
            <div className="mt-2 rounded-md border border-neutral-800 bg-neutral-900/50 p-3 text-sm">
              <p className="text-neutral-300">
                <span className="font-medium capitalize">
                  {review.data.verdict}
                </span>
                {review.data.rating != null && ` · ${review.data.rating}/10`}
                <span className="text-neutral-500">
                  {" "}
                  · reviewed {review.data.listenedOn}
                </span>
              </p>
              {review.data.notes && (
                <p className="mt-1 whitespace-pre-wrap text-neutral-400">
                  {review.data.notes}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <AlbumContextPanel albumId={a.id} />

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-neutral-600">
              <kbd>P</kbd> play/pause · <kbd>L</kbd> like · <kbd>B</kbd> banger —{" "}
              {nowInAlbum
                ? "on the playing track"
                : selectedTrack
                  ? `on “${selectedTrack.name}” (selected)`
                  : "on the selected track"}
            </p>
            <button
              type="button"
              onClick={() => void triage.query.refetch()}
              disabled={triage.query.isFetching}
              title="Refresh like/banger state"
              className="shrink-0 rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`size-3.5 ${triage.query.isFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <ol className="space-y-0.5">
            {tracks.map((t, i) => {
              const st = triage.stateFor(t.id);
              return (
                <TrackRow
                  key={t.id}
                  track={t}
                  index={i}
                  selected={t.id === selectedId}
                  isNow={t.id === nowId}
                  showArtist={t.artists.join("|") !== albumArtistKey}
                  liked={st.liked}
                  inBanger={st.inBanger}
                  bangerLabel={triage.bangerLabel}
                  pending={triage.pendingTrackId === t.id}
                  onSelect={() => setPicked(t.id)}
                  onPlay={() => playFrom.mutate(t.uri)}
                  onLike={() => triage.toggleLike(t.id, st.liked)}
                  onBanger={() => triage.fireBanger(t.id)}
                />
              );
            })}
          </ol>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-3 text-sm font-medium text-neutral-400">
            {selectedTrack ? `Lyrics: ${selectedTrack.name}` : "Lyrics"}
          </h2>
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            <LyricsPanel
              lyrics={selectedId ? lyrics.data?.lyrics[selectedId] : undefined}
              loading={lyrics.isLoading}
              isNowPlaying={Boolean(
                selectedId && selectedId === nowId && state?.isPlaying,
              )}
              positionMs={displayMs}
            />
          </div>
          {a.copyrights.length > 0 && (
            <p className="mt-6 text-[11px] leading-relaxed text-neutral-600">
              {a.copyrights.join(" · ")}
            </p>
          )}
        </div>
      </div>

      {reviewOpen && (
        <VerdictDialog
          albumId={a.id}
          albumName={a.name}
          existing={review.data ?? null}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </section>
  );
}
