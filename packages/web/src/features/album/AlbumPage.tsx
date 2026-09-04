import { useState } from "react";
import { Play, RefreshCw, SkipBack, SkipForward } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AlbumTrack } from "@gatefold/shared";
import { api, ApiRequestError } from "../../api/client";
import { formatDuration } from "../../lib/format";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { TriageButton } from "../../components/TriageButton";
import { useBacklog } from "../backlog/useBacklog";
import { usePlayback } from "../now-playing/usePlayback";
import { useDevicePickerPrompt } from "../playback/DevicePickerPrompt";
import { VerdictDialog } from "../review/VerdictDialog";
import { useAlbumReview } from "../review/useVerdict";
import { useTriageHotkeys } from "../triage/useTriageHotkeys";
import { AlbumContextPanel } from "./AlbumContextPanel";
import { AlbumGallery } from "./AlbumGallery";
import { AlbumHero } from "./AlbumHero";
import { LyricsPanel } from "./LyricsPanel";
import { useAlbumTriage } from "./useAlbumTriage";

type RowVariant = "default" | "now-playing" | "selected";

function TrackRow({
  track,
  index,
  variant,
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
  variant: RowVariant;
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
        variant === "selected" ? "bg-surface" : "hover:bg-surface/60"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        className="w-6 shrink-0 text-center text-xs text-ink-muted hover:text-primary"
        title="Play from here"
      >
        <span className="group-hover:hidden">{track.trackNumber ?? index + 1}</span>
        <Play className="mx-auto hidden size-3.5 group-hover:block" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {track.name}
          {track.explicit && (
            <Badge variant="neutral" className="ml-1.5 px-1 py-0 text-[9px]">
              E
            </Badge>
          )}
          {variant === "now-playing" && (
            <Badge variant="now-playing" className="ml-2">
              now
            </Badge>
          )}
        </p>
        {showArtist && (
          <p className="truncate text-xs text-ink-muted">
            {track.artists.join(", ")}
          </p>
        )}
      </div>

      <span className="shrink-0 text-xs tabular-nums text-ink-muted">
        {formatDuration(track.durationMs)}
      </span>
      <TriageButton kind="like" active={liked} onToggle={onLike} pending={pending} />
      <TriageButton
        kind="banger"
        active={inBanger}
        label={bangerLabel}
        onToggle={onBanger}
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
  const { requestDevice } = useDevicePickerPrompt();

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
    () =>
      hotkeyTargetId &&
      triage.fireBanger(hotkeyTargetId, triage.stateFor(hotkeyTargetId).inBanger),
  );

  const playAlbum = useMutation({
    mutationFn: () =>
      api.play({ contextUri: album.data!.uri, shuffle: false, repeat: "off" }),
    onError: (err) => {
      if (err instanceof ApiRequestError && err.code === "no_device") {
        requestDevice(() => playAlbum.mutate());
      }
    },
  });
  const playFrom = useMutation({
    mutationFn: (trackUri: string) =>
      api.play({
        contextUri: album.data!.uri,
        offset: { uri: trackUri },
        shuffle: false,
        repeat: "off",
      }),
    onError: (err, trackUri) => {
      if (err instanceof ApiRequestError && err.code === "no_device") {
        requestDevice(() => playFrom.mutate(trackUri));
      }
    },
  });

  if (album.error?.status === 401) {
    return (
      <p className="text-sm text-ink-muted">
        Spotify isn&apos;t connected.{" "}
        <Link to="/settings" className="text-primary hover:underline">
          Connect in Settings
        </Link>
        .
      </p>
    );
  }
  if (album.isLoading)
    return <p className="text-sm text-ink-muted">Loading album…</p>;
  if (album.isError || !album.data)
    return (
      <p className="text-sm text-danger">
        {album.error?.message ?? "Couldn't load that album."}
      </p>
    );

  const a = album.data;
  const selectedTrack = tracks.find((t) => t.id === selectedId) ?? null;
  const albumArtistKey = a.artists.join("|");

  const rawPlayError = playAlbum.error ?? playFrom.error;
  const playMutationError =
    rawPlayError instanceof ApiRequestError && rawPlayError.code === "no_device"
      ? undefined
      : rawPlayError;
  const backlogMutationError = (backlog.add.error ?? backlog.remove.error) as
    | Error
    | undefined;

  return (
    <section className="space-y-8">
      <AlbumHero
        image={a.image}
        name={a.name}
        artists={a.artists.join(", ")}
        meta={[
          a.year,
          `${a.totalTracks} track${a.totalTracks === 1 ? "" : "s"}`,
          formatDuration(a.durationMs),
          a.label,
        ]}
        genres={a.genres}
        actions={
          <>
            {thisAlbumIsPlaying ? (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={controls.previous}
                  aria-label="Previous track"
                >
                  <SkipBack className="size-4" />
                </Button>
                <Button variant="primary" onClick={controls.toggle}>
                  {state?.isPlaying ? "Pause" : "Resume"}
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={controls.next}
                  aria-label="Next track"
                >
                  <SkipForward className="size-4" />
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => playAlbum.mutate()}>
                Play album
              </Button>
            )}
            <Button variant="secondary" onClick={() => setReviewOpen(true)}>
              {review.data ? "Update review" : "Finish album"}
            </Button>
            {a.inBacklog ? (
              <Button
                variant="ghost"
                onClick={() => backlog.remove.mutate(a.id)}
                disabled={backlog.remove.isPending}
              >
                {backlog.remove.isPending ? "Removing…" : "Remove from backlog"}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => backlog.add.mutate(a.id)}
                disabled={backlog.add.isPending}
              >
                {backlog.add.isPending ? "Adding…" : "Add to backlog"}
              </Button>
            )}
          </>
        }
      >
        {playMutationError && (
          <p className="text-sm text-danger">{playMutationError.message}</p>
        )}
        {backlogMutationError && (
          <p className="text-sm text-danger">
            Couldn&apos;t update the backlog: {backlogMutationError.message}
          </p>
        )}

        {review.data && (
          <div className="mt-2 rounded-md border border-border bg-surface/50 p-3 text-sm">
            <p className="text-ink">
              <span className="font-medium capitalize">
                {review.data.verdict}
              </span>
              {review.data.rating != null && ` · ${review.data.rating}/10`}
              <span className="text-ink-muted"> · reviewed {review.data.listenedOn}</span>
            </p>
            {review.data.notes && (
              <p className="mt-1 whitespace-pre-wrap text-ink-muted">
                {review.data.notes}
              </p>
            )}
          </div>
        )}
      </AlbumHero>

      <AlbumGallery albumId={a.id} />

      <AlbumContextPanel albumId={a.id} />

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-ink-muted">
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
              aria-label="Refresh like/banger state"
              className="shrink-0 rounded-md p-1 text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            >
              <RefreshCw
                className={`size-3.5 ${triage.query.isFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <ol className="space-y-0.5">
            {tracks.map((t, i) => {
              const st = triage.stateFor(t.id);
              const variant: RowVariant =
                t.id === nowId ? "now-playing" : t.id === selectedId ? "selected" : "default";
              return (
                <TrackRow
                  key={t.id}
                  track={t}
                  index={i}
                  variant={variant}
                  showArtist={t.artists.join("|") !== albumArtistKey}
                  liked={st.liked}
                  inBanger={st.inBanger}
                  bangerLabel={triage.bangerLabel}
                  pending={triage.pendingTrackId === t.id}
                  onSelect={() => setPicked(t.id)}
                  onPlay={() => playFrom.mutate(t.uri)}
                  onLike={() => triage.toggleLike(t.id, st.liked)}
                  onBanger={() => triage.fireBanger(t.id, st.inBanger)}
                />
              );
            })}
          </ol>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-3 text-sm font-medium text-ink-muted">
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
            <p className="mt-6 text-[11px] leading-relaxed text-ink-muted">
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
