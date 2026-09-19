import type { LyricLine, TrackLyrics } from "@gatefold/shared";
import { makeCache } from "../cache.js";
import { detectScript, furigana, romanize } from "./romanize.js";

const cache = makeCache("lyrics");
const LYRICS_TTL_MS = 30 * 24 * 3600_000; // 30 days; also caches misses
const BASE = "https://lrclib.net/api";
const UA = "gatefold (self-hosted album listening app)";

const EMPTY: TrackLyrics = {
  source: null,
  synced: null,
  plain: null,
  instrumental: false,
  script: null,
  romanizedSynced: null,
  romanizedPlain: null,
  romanizedTitle: null,
  furiganaSynced: null,
  furiganaPlain: null,
};

interface LrcResponse {
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const TS = /\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g;

function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split("\n")) {
    const text = raw.replace(TS, "").trim();
    TS.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TS.exec(raw))) {
      const min = Number(m[1]);
      const sec = Number(m[2]);
      const frac = m[3] ? Number(m[3].padEnd(3, "0")) : 0;
      lines.push({ timeMs: min * 60_000 + sec * 1000 + frac, text });
    }
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

function shape(res: LrcResponse): TrackLyrics {
  if (res.instrumental) {
    return {
      source: "lrclib",
      synced: null,
      plain: null,
      instrumental: true,
      script: null,
      romanizedSynced: null,
      romanizedPlain: null,
      romanizedTitle: null,
      furiganaSynced: null,
      furiganaPlain: null,
    };
  }
  const synced = res.syncedLyrics ? parseLrc(res.syncedLyrics) : null;
  const plain = res.plainLyrics?.trim() || null;
  if (!synced?.length && !plain) return EMPTY;
  return {
    source: "lrclib",
    synced: synced?.length ? synced : null,
    plain,
    instrumental: false,
    script: null,
    romanizedSynced: null,
    romanizedPlain: null,
    romanizedTitle: null,
    furiganaSynced: null,
    furiganaPlain: null,
  };
}

/** Mutates `result` in place with the detected script, romanization, and
 *  (Japanese only) furigana — computed once here and stored in the same
 *  30-day cache entry as the lyrics text it's derived from, no independent
 *  cache namespace. `title` is romanized under the same detected script so
 *  headings that show the track name can gloss it alongside the lyrics. */
async function attachGlosses(result: TrackLyrics, title: string): Promise<void> {
  const text = result.synced?.map((l) => l.text).join("\n") ?? result.plain;
  if (!text) return;
  const script = detectScript(text);
  if (!script) return;
  result.script = script;
  // Latin lyrics still get tagged (Phase 11.3, for language filtering) but
  // need no romanization or furigana — those are meaningless for a script
  // that's already Latin.
  if (script === "latin") return;
  if (result.synced) {
    result.romanizedSynced = await Promise.all(
      result.synced.map((l) => romanize(l.text, script)),
    );
  } else if (result.plain) {
    result.romanizedPlain = await romanize(result.plain, script);
  }
  result.romanizedTitle = await romanize(title, script);

  if (script === "japanese") {
    if (result.synced) {
      result.furiganaSynced = await Promise.all(
        result.synced.map((l) => furigana(l.text)),
      );
    } else if (result.plain) {
      result.furiganaPlain = await Promise.all(
        result.plain.split("\n").map((line) => furigana(line)),
      );
    }
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
  return (await res.json()) as T;
}

export interface LyricsQuery {
  trackId: string;
  artist: string;
  track: string;
  album: string;
  durationMs: number;
}

export async function getLyrics(q: LyricsQuery): Promise<TrackLyrics> {
  const cached = await cache.get<TrackLyrics>(q.trackId, LYRICS_TTL_MS);
  if (cached) return cached;

  const durationSec = Math.round(q.durationMs / 1000);
  let result = EMPTY;

  try {
    const params = new URLSearchParams({
      artist_name: q.artist,
      track_name: q.track,
      album_name: q.album,
      duration: String(durationSec),
    });
    const hit = await fetchJson<LrcResponse>(`${BASE}/get?${params}`);
    if (hit) {
      result = shape(hit);
    } else {
      // Fallback: search without the album / duration constraint.
      const search = await fetchJson<LrcResponse[]>(
        `${BASE}/search?${new URLSearchParams({
          artist_name: q.artist,
          track_name: q.track,
        })}`,
      );
      const best =
        search?.find(
          (r) =>
            (r as { duration?: number }).duration != null &&
            Math.abs(
              ((r as { duration?: number }).duration ?? 0) - durationSec,
            ) <= 3,
        ) ?? search?.[0];
      if (best) result = shape(best);
    }
  } catch {
    // network / LRCLIB error — treat as "no lyrics", don't cache the failure long
    return EMPTY;
  }

  try {
    await attachGlosses(result, q.track);
  } catch (err) {
    // Glosses are a bonus on top of real lyrics — don't let a dependency
    // failure (e.g. kuroshiro init) throw away a good LRCLIB match.
    console.error("gloss computation failed:", err);
  }

  await cache.set(q.trackId, result);
  return result;
}
