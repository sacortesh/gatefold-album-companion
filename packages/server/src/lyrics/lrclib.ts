import type { LyricLine, TrackLyrics } from "@gatefold/shared";
import { makeCache } from "../cache.js";

const cache = makeCache("lyrics");
const LYRICS_TTL_MS = 30 * 24 * 3600_000; // 30 days; also caches misses
const BASE = "https://lrclib.net/api";
const UA = "gatefold (self-hosted album listening app)";

const EMPTY: TrackLyrics = {
  source: null,
  synced: null,
  plain: null,
  instrumental: false,
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
    return { source: "lrclib", synced: null, plain: null, instrumental: true };
  }
  const synced = res.syncedLyrics ? parseLrc(res.syncedLyrics) : null;
  const plain = res.plainLyrics?.trim() || null;
  if (!synced?.length && !plain) return EMPTY;
  return {
    source: "lrclib",
    synced: synced?.length ? synced : null,
    plain,
    instrumental: false,
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { "user-agent": UA } });
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

  await cache.set(q.trackId, result);
  return result;
}
