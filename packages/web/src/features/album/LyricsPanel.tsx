import { useQuery } from "@tanstack/react-query";
import { renderLinkTemplate, type TrackLyrics } from "@gatefold/shared";
import { api } from "../../api/client";

interface Props {
  lyrics: TrackLyrics | undefined;
  loading: boolean;
  isNowPlaying: boolean;
  positionMs: number;
  artist: string;
  track: string;
}

/** Shown when LRCLIB has nothing for this track (Phase 10.12) — a search
 *  link, not a claim that the lyrics exist elsewhere. */
function LyricsFallback({ artist, track }: { artist: string; track: string }) {
  const links = useQuery({
    queryKey: ["config", "links"],
    queryFn: () => api.getConfig("links"),
    staleTime: 5 * 60_000,
  });
  const templates = (links.data?.track ?? []).filter((t) => t.enabled);
  if (templates.length === 0) return null;

  return (
    <p className="mt-3 flex flex-wrap gap-x-3 text-xs">
      {templates.map((t) => (
        <a
          key={t.id}
          href={renderLinkTemplate(t.urlTemplate, { artist, track })}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          Search {t.label} →
        </a>
      ))}
    </p>
  );
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
  artist,
  track,
}: Props) {
  if (loading) {
    return <p className="text-sm text-ink-muted">Loading lyrics…</p>;
  }

  if (lyrics?.instrumental) {
    return <p className="text-sm text-ink-muted">Instrumental.</p>;
  }

  if (lyrics?.synced?.length) {
    return (
      <SyncedView
        lines={lyrics.synced}
        positionMs={positionMs}
        live={isNowPlaying}
      />
    );
  }

  if (lyrics?.plain) {
    return (
      <p className="whitespace-pre-wrap leading-relaxed text-ink">
        {lyrics.plain}
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-ink-muted">No lyrics found.</p>
      <LyricsFallback artist={artist} track={track} />
    </div>
  );
}
