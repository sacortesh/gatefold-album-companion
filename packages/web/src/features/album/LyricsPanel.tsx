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
              ? "text-neutral-400"
              : i === activeIdx
                ? "font-medium text-neutral-50"
                : i < activeIdx
                  ? "text-neutral-600"
                  : "text-neutral-400"
          }
        >
          {line.text || " "}
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
    return <p className="text-sm text-neutral-500">Loading lyrics…</p>;
  }

  if (!lyrics || lyrics.instrumental) {
    return (
      <p className="text-sm text-neutral-500">
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
      <p className="whitespace-pre-wrap leading-relaxed text-neutral-300">
        {lyrics.plain}
      </p>
    );
  }

  return <p className="text-sm text-neutral-500">No lyrics found.</p>;
}
