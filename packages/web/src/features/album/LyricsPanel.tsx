import type { TrackLyrics } from "@gatefold/shared";

interface Props {
  lyrics: TrackLyrics | undefined;
  loading: boolean;
  isNowPlaying: boolean;
  positionMs: number;
}

function SyncedView({
  lines,
  positionMs,
  live,
}: {
  lines: NonNullable<TrackLyrics["synced"]>;
  positionMs: number;
  live: boolean;
}) {
  const activeIdx = live
    ? lines.reduce((acc, l, i) => (l.timeMs <= positionMs ? i : acc), -1)
    : -1;

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, i) => (
        <p
          key={`${line.timeMs}-${i}`}
          className={
            !live
              ? "text-ink-muted"
              : i === activeIdx
                ? "font-medium text-primary"
                : i < activeIdx
                  ? "text-ink-muted/50"
                  : "text-ink-muted"
          }
        >
          {line.text || " "}
        </p>
      ))}
    </div>
  );
}

export function LyricsPanel({
  lyrics,
  loading,
  isNowPlaying,
  positionMs,
}: Props) {
  if (loading) {
    return <p className="text-sm text-ink-muted">Loading lyrics…</p>;
  }

  if (!lyrics || lyrics.instrumental) {
    return (
      <p className="text-sm text-ink-muted">
        {lyrics?.instrumental ? "Instrumental." : "No lyrics found."}
      </p>
    );
  }

  if (lyrics.synced?.length) {
    return (
      <SyncedView
        lines={lyrics.synced}
        positionMs={positionMs}
        live={isNowPlaying}
      />
    );
  }

  if (lyrics.plain) {
    return (
      <p className="whitespace-pre-wrap leading-relaxed text-ink">
        {lyrics.plain}
      </p>
    );
  }

  return <p className="text-sm text-ink-muted">No lyrics found.</p>;
}
