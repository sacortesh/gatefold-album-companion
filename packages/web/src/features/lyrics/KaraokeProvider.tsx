import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Dialog, DialogContent, DialogTitle } from "../../components/ui/dialog";
import { usePlayback } from "../now-playing/usePlayback";
import { useHotkeys } from "../triage/useTriageHotkeys";

interface KaraokeContextValue {
  /** True once there's a currently-playing track with synced lyrics — the
   *  gate trigger buttons (bottom bar, album page) use to enable/disable
   *  themselves, without each duplicating the lyrics fetch. */
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
  positionMs,
  live,
}: {
  lines: Array<{ timeMs: number; text: string }>;
  positionMs: number;
  live: boolean;
}) {
  const activeIdx = live
    ? lines.reduce((acc, l, i) => (l.timeMs <= positionMs ? i : acc), -1)
    : -1;
  const activeRef = useRef<HTMLParagraphElement | null>(null);

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
        {lines.map((line, i) => (
          <p
            key={`${line.timeMs}-${i}`}
            ref={i === activeIdx ? activeRef : undefined}
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
            {line.text || " "}
          </p>
        ))}
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
  const { state, displayMs } = usePlayback();

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
  const canOpen = Boolean(track && synced && synced.length > 0);

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
          {!track ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
              Nothing playing.
            </p>
          ) : synced && synced.length > 0 ? (
            <KaraokeView
              lines={synced}
              positionMs={displayMs}
              live={Boolean(state?.isPlaying)}
            />
          ) : (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
              No synced lyrics for this track.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </KaraokeContext.Provider>
  );
}
