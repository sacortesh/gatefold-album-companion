import { type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { renderLinkTemplate, type TrackLyrics } from "@gatefold/shared";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { FuriganaText } from "../../components/FuriganaText";

interface Props {
  lyrics: TrackLyrics | undefined;
  loading: boolean;
  isNowPlaying: boolean;
  positionMs: number;
  artist: string;
  track: string;
}

/** Cycle order: original → romanized → furigana → furigana+romanized →
 *  original (Japanese only — the combined state exists for a reader who
 *  can't fully read hiragana yet and wants the Latin reading alongside the
 *  kana one). Korean/Russian tracks only ever see "original"/"romanized" —
 *  `glossOptions` below decides which states are actually reachable per
 *  track. */
export type GlossMode = "original" | "romanized" | "furigana" | "furigana+romanized";

export function glossOptionsFor(script: TrackLyrics["script"]): GlossMode[] {
  if (script === "japanese") {
    return ["original", "romanized", "furigana", "furigana+romanized"];
  }
  // "latin" is tagged (Phase 11.3, for language filtering) but has no
  // romanization/furigana data to show — same single-state UI as no script.
  if (script && script !== "latin") return ["original", "romanized"];
  return ["original"];
}

export const SHOWS_FURIGANA: ReadonlySet<GlossMode> = new Set([
  "furigana",
  "furigana+romanized",
]);
export const SHOWS_ROMANIZED: ReadonlySet<GlossMode> = new Set([
  "romanized",
  "furigana+romanized",
]);

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
  glossMode,
  romanized,
  furiganaLines,
  positionMs,
  live,
}: {
  lines: NonNullable<TrackLyrics["synced"]>;
  glossMode: GlossMode;
  romanized: string[] | null;
  furiganaLines: NonNullable<TrackLyrics["furiganaSynced"]> | null;
  positionMs: number;
  live: boolean;
}) {
  const activeIdx = live
    ? lines.reduce((acc, l, i) => (l.timeMs <= positionMs ? i : acc), -1)
    : -1;

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, i) => {
        const mainClass = !live
          ? "text-ink-muted"
          : i === activeIdx
            ? "font-medium text-primary"
            : i < activeIdx
              ? "text-ink-muted/50"
              : "text-ink-muted";
        const segments = SHOWS_FURIGANA.has(glossMode) ? furiganaLines?.[i] : null;
        return (
          <div key={`${line.timeMs}-${i}`}>
            <p className={mainClass}>
              {segments ? <FuriganaText segments={segments} /> : line.text || " "}
            </p>
            {SHOWS_ROMANIZED.has(glossMode) && romanized?.[i] && (
              <p className="text-xs text-ink-muted">{romanized[i]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Plain (untimed) lyrics, line-interleaved with their gloss when on — same
 *  per-line pairing as `SyncedView`, just without the active-line highlight,
 *  for a consistent reading pattern in both lyric shapes. */
function PlainView({
  text,
  glossMode,
  romanized,
  furiganaLines,
}: {
  text: string;
  glossMode: GlossMode;
  romanized: string | null;
  furiganaLines: NonNullable<TrackLyrics["furiganaPlain"]> | null;
}) {
  const lines = text.split("\n");
  const romanizedLines = romanized?.split("\n") ?? null;

  if (glossMode === "original" || (!romanizedLines && !furiganaLines)) {
    return (
      <p className="whitespace-pre-wrap leading-relaxed text-ink">{text}</p>
    );
  }

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, i) => {
        const segments = SHOWS_FURIGANA.has(glossMode) ? furiganaLines?.[i] : null;
        return (
          <div key={i}>
            <p className="whitespace-pre-wrap text-ink">
              {segments ? <FuriganaText segments={segments} /> : line || " "}
            </p>
            {SHOWS_ROMANIZED.has(glossMode) && romanizedLines?.[i] && (
              <p className="whitespace-pre-wrap text-xs text-ink-muted">
                {romanizedLines[i]}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const GLOSS_LABEL: Record<GlossMode, string> = {
  original: "off",
  romanized: "romanized",
  furigana: "furigana",
  "furigana+romanized": "furigana+romaji",
};

const GLOSS_CAPTION: Record<Exclude<GlossMode, "original">, string> = {
  romanized: "romanized automatically",
  furigana: "readings automatically",
  "furigana+romanized": "readings + romanization automatically",
};

/** Gloss-cycle toggle for non-Latin-script lyrics (Phase 11.1/11.2). Cycles
 *  original → romanized → furigana → furigana+romanized → original
 *  (Japanese only), rather than stacking gloss lines by default, per
 *  DESIGN.md's Miller's-Law crowding note — the combined state is the one
 *  exception, added for a reader who can't fully read hiragana yet. */
function GlossToggle({
  mode,
  options,
  onCycle,
}: {
  mode: GlossMode;
  options: GlossMode[];
  onCycle: () => void;
}) {
  if (options.length <= 1) return null;
  return (
    <div className="mb-2 flex items-center gap-2">
      <Button
        variant={mode === "original" ? "ghost" : "secondary"}
        size="sm"
        onClick={onCycle}
      >
        Gloss: {GLOSS_LABEL[mode]}
      </Button>
      {mode !== "original" && (
        <span className="text-xs text-ink-muted">{GLOSS_CAPTION[mode]}</span>
      )}
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
  const [rawGlossMode, setRawGlossMode] = useState<GlossMode>("original");

  if (loading) {
    return <p className="text-sm text-ink-muted">Loading lyrics…</p>;
  }

  if (lyrics?.instrumental) {
    return <p className="text-sm text-ink-muted">Instrumental.</p>;
  }

  const glossOptions = glossOptionsFor(lyrics?.script ?? null);
  const glossMode = glossOptions.includes(rawGlossMode)
    ? rawGlossMode
    : "original";
  const cycleGloss = () => {
    const i = glossOptions.indexOf(rawGlossMode);
    setRawGlossMode(glossOptions[(i + 1) % glossOptions.length] ?? "original");
  };

  // Always paired with the search-elsewhere links below, not just on the
  // empty-lyrics path — LRCLIB occasionally returns a confident-looking but
  // wrong match (a short interlude matched to an unrelated song's lyrics,
  // for one real example), and a plain-text match with no timing data has
  // no other signal the user could use to tell it's wrong. The links are
  // the escape hatch either way.
  let body: ReactNode;
  if (lyrics?.synced?.length) {
    body = (
      <SyncedView
        lines={lyrics.synced}
        glossMode={glossMode}
        romanized={lyrics.romanizedSynced}
        furiganaLines={lyrics.furiganaSynced}
        positionMs={positionMs}
        live={isNowPlaying}
      />
    );
  } else if (lyrics?.plain) {
    body = (
      <PlainView
        text={lyrics.plain}
        glossMode={glossMode}
        romanized={lyrics.romanizedPlain}
        furiganaLines={lyrics.furiganaPlain}
      />
    );
  } else {
    body = <p className="text-sm text-ink-muted">No lyrics found.</p>;
  }

  return (
    <div>
      <GlossToggle mode={glossMode} options={glossOptions} onCycle={cycleGloss} />
      {body}
      <LyricsFallback artist={artist} track={track} />
    </div>
  );
}
