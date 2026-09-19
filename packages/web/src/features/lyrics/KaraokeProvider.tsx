import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { TrackLyrics } from "@gatefold/shared";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "../../components/ui/dialog";
import { FuriganaText } from "../../components/FuriganaText";
import { ProgressBar } from "../../components/ui/progress-bar";
import { TriageButton } from "../../components/TriageButton";
import { formatDuration } from "../../lib/format";
import {
  GLOSS_LABEL,
  glossOptionsFor,
  SHOWS_FURIGANA,
  SHOWS_ROMANIZED,
  type GlossMode,
} from "../album/LyricsPanel";
import { usePlayback } from "../now-playing/usePlayback";
import { useRecent } from "../recent/useRecent";
import { useHotkeys } from "../triage/useTriageHotkeys";

interface KaraokeContextValue {
  /** True once there's a currently-playing track with lyrics of any kind
   *  (synced or plain) — the gate trigger buttons (bottom bar, album page)
   *  use to enable/disable themselves, without each duplicating the lyrics
   *  fetch. Plain-only lyrics still open karaoke; they just don't auto-scroll
   *  or highlight a line, since there's no timing to follow. */
  canOpen: boolean;
  openKaraoke: () => void;
}

const KaraokeContext = createContext<KaraokeContextValue | null>(null);

export function useKaraoke(): KaraokeContextValue {
  const ctx = useContext(KaraokeContext);
  if (!ctx) {
    throw new Error("useKaraoke must be used within KaraokeProvider");
  }
  return ctx;
}

function KaraokeView({
  lines,
  glossMode,
  romanized,
  furiganaLines,
  positionMs,
  live,
}: {
  lines: Array<{ timeMs: number; text: string }>;
  glossMode: GlossMode;
  romanized: string[] | null;
  furiganaLines: TrackLyrics["furiganaSynced"];
  positionMs: number;
  live: boolean;
}) {
  const activeIdx = live
    ? lines.reduce((acc, l, i) => (l.timeMs <= positionMs ? i : acc), -1)
    : -1;
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIdx]);

  return (
    // `absolute inset-0` (not a percentage/flex height) so this reliably
    // fills the fixed-position dialog regardless of its own display type,
    // and owns its own scroll region — a long lyric sheet needs to scroll,
    // not render as one giant vertically-centered block past the viewport
    // edges (the bug this replaced: `flex h-full justify-center` centered
    // the *whole* list, silently cutting off whatever didn't fit).
    <div className="absolute inset-0 overflow-y-auto">
      {/* `py-[50vh]` so even the first/last line has room to scroll to
          vertical center, same trick teleprompter/karaoke UIs use. */}
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-[50vh] text-center">
        {lines.map((line, i) => {
          const segments = SHOWS_FURIGANA.has(glossMode)
            ? furiganaLines?.[i]
            : null;
          return (
            <div
              key={`${line.timeMs}-${i}`}
              ref={i === activeIdx ? activeRef : undefined}
            >
              <p
                className={
                  !live
                    ? "text-xl text-ink-muted sm:text-2xl"
                    : i === activeIdx
                      ? "text-3xl font-semibold text-primary sm:text-4xl"
                      : i < activeIdx
                        ? "text-xl text-ink-muted/40 sm:text-2xl"
                        : "text-xl text-ink-muted sm:text-2xl"
                }
              >
                {segments ? <FuriganaText segments={segments} /> : line.text || " "}
              </p>
              {SHOWS_ROMANIZED.has(glossMode) && romanized?.[i] && (
                <p
                  className={
                    i === activeIdx
                      ? "text-lg text-primary/70 sm:text-xl"
                      : "text-base text-ink-muted/50 sm:text-lg"
                  }
                >
                  {romanized[i]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Playback status for the karaoke overlay — track info, progress, Like/
 *  Banger, play/pause/skip. Deliberately not `NowPlayingCard` itself: that
 *  component registers its own `P` hotkey via `useHotkeys`, and it stays
 *  mounted underneath the dialog while karaoke is open, so reusing it here
 *  would bind the listener twice and double-fire play/pause on every press.
 *  This rebuilds the same Like/Banger row from the same `useRecent` hook
 *  and `TriageButton` molecule — neither registers a hotkey itself, so
 *  there's no equivalent double-fire risk there. */
function KaraokeStatusBar({
  track,
  isPlaying,
  displayMs,
  onToggle,
  onNext,
}: {
  track: NonNullable<
    NonNullable<ReturnType<typeof usePlayback>["state"]>["track"]
  >;
  isPlaying: boolean;
  displayMs: number;
  onToggle: () => void;
  onNext: () => void;
}) {
  const pct = track.durationMs
    ? Math.min(100, (displayMs / track.durationMs) * 100)
    : 0;
  const recent = useRecent();
  const current =
    recent.currentRow?.track.id === track.id ? recent.currentRow : null;
  const liked = current?.liked ?? false;
  const inBanger = current?.inBanger ?? false;
  const pending = recent.pendingTrackId === track.id;

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{track.name}</p>
          <p className="truncate text-xs text-ink-muted">
            {track.artists.join(", ")}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar pct={pct} className="h-0.5" />
            <span className="shrink-0 text-xs tabular-nums text-ink-muted">
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
          onToggle={() => recent.fireBanger(track.id, inBanger)}
        />
        <Button
          variant="primary"
          size="icon"
          onClick={onToggle}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button variant="secondary" size="icon" onClick={onNext} aria-label="Next track">
          <SkipForward className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Full-screen "readable across the room" synced-lyrics view (Phase 12.1)
 *  for whatever's currently playing — reachable from both the album page
 *  and the sticky bottom player bar, so it always follows the live track
 *  rather than needing per-track props threaded down. */
export function KaraokeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [rawGlossMode, setRawGlossMode] = useState<GlossMode>("original");
  const { state, displayMs, controls } = usePlayback();

  const track = state?.track ?? null;
  const albumId = track?.album.id ?? null;

  const lyrics = useQuery({
    queryKey: ["album-lyrics", albumId],
    queryFn: () => api.albumLyrics(albumId as string),
    enabled: Boolean(albumId),
    staleTime: 5 * 60_000,
  });

  const trackLyrics = track ? lyrics.data?.lyrics[track.id] : undefined;
  const synced = trackLyrics?.synced ?? null;
  const isSynced = Boolean(synced && synced.length > 0);
  // Plain (untimed) lyrics get turned into fake "lines" — one per `\n` —
  // reusing `KaraokeView` at `live=false`: no highlight, no auto-scroll,
  // just a big scrollable sheet the user follows themselves.
  const plainLines = trackLyrics?.plain
    ? trackLyrics.plain.split("\n").map((text, i) => ({ timeMs: i, text }))
    : null;
  const plainRomanized = trackLyrics?.romanizedPlain
    ? trackLyrics.romanizedPlain.split("\n")
    : null;
  const displayLines = isSynced ? synced : plainLines;
  const displayRomanized = isSynced
    ? (trackLyrics?.romanizedSynced ?? null)
    : plainRomanized;
  const displayFurigana = isSynced
    ? (trackLyrics?.furiganaSynced ?? null)
    : (trackLyrics?.furiganaPlain ?? null);
  const canOpen = Boolean(track && displayLines && displayLines.length > 0);

  const glossOptions = glossOptionsFor(trackLyrics?.script ?? null);
  const glossMode = glossOptions.includes(rawGlossMode)
    ? rawGlossMode
    : "original";
  const cycleGloss = () => {
    const i = glossOptions.indexOf(rawGlossMode);
    setRawGlossMode(glossOptions[(i + 1) % glossOptions.length] ?? "original");
  };

  // `K` works from anywhere a track is playing, same "global" scope as `P`
  // (play/pause) on the bottom bar — not scoped to whatever page you're on.
  useHotkeys({ k: () => setOpen(true) }, canOpen && !open);

  return (
    <KaraokeContext.Provider
      value={{ canOpen, openKaraoke: () => setOpen(true) }}
    >
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 h-screen max-h-none w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-none bg-bg p-0">
          <DialogTitle className="sr-only">
            Karaoke{track ? ` — ${track.name}` : ""}
          </DialogTitle>
          {track && (
            <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex flex-col items-center px-24">
              <h2 className="truncate text-sm font-medium text-ink-muted">
                Lyrics: {track.name}
              </h2>
              {SHOWS_ROMANIZED.has(glossMode) && trackLyrics?.romanizedTitle && (
                <p className="truncate text-xs text-ink-muted/70">
                  {trackLyrics.romanizedTitle}
                </p>
              )}
            </div>
          )}
          {!track ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
              Nothing playing.
            </p>
          ) : displayLines && displayLines.length > 0 ? (
            <>
              {glossOptions.length > 1 && (
                <div className="absolute left-4 top-4 z-10">
                  <Button
                    variant={glossMode === "original" ? "ghost" : "secondary"}
                    size="sm"
                    onClick={cycleGloss}
                  >
                    Gloss: {GLOSS_LABEL[glossMode]}
                  </Button>
                </div>
              )}
              <KaraokeView
                lines={displayLines}
                glossMode={glossMode}
                romanized={displayRomanized}
                furiganaLines={displayFurigana}
                positionMs={displayMs}
                live={isSynced && Boolean(state?.isPlaying)}
              />
              <KaraokeStatusBar
                track={track}
                isPlaying={Boolean(state?.isPlaying)}
                displayMs={displayMs}
                onToggle={controls.toggle}
                onNext={controls.next}
              />
            </>
          ) : (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
              No lyrics for this track.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </KaraokeContext.Provider>
  );
}
