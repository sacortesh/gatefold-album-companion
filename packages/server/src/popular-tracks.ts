import { makeCache } from "./cache.js";
import { getJson, safe } from "./context/http.js";
import { mapLimit } from "./mapLimit.js";
import { getAppConfig } from "./store/appConfig.js";

const BASE = "https://ws.audioscrobbler.com/2.0/";
/** Spotify's own `popularity` field is gone for Development Mode apps
 *  (every self-hosted Gatefold instance) — Last.fm playcount is the
 *  replacement signal. Cap the badge to a few tracks per album, same
 *  "don't flood the view" precedent as `GenreChips`. */
const TOP_N = 3;

const cache = makeCache("popular-tracks");
const TTL_MS = 30 * 24 * 3600_000;

interface TrackInfoResponse {
  track?: { playcount?: string };
}

interface RawTrack {
  id: string;
  name: string;
  artists?: Array<{ name: string }>;
}

async function fetchPlaycount(
  artist: string,
  track: string,
  apiKey: string,
): Promise<number | null> {
  const url = `${BASE}?${new URLSearchParams({
    method: "track.getInfo",
    artist,
    track,
    api_key: apiKey,
    format: "json",
  })}`;
  const data = await getJson<TrackInfoResponse>(url);
  const raw = data.track?.playcount;
  return raw ? Number(raw) : null;
}

/** Ids of an album's top `TOP_N` tracks by Last.fm playcount. Cached per
 *  album for 30 days (track-level Last.fm data doesn't move fast). Silent
 *  empty set when Last.fm isn't configured or nothing resolves — tracks
 *  Last.fm has no data for are skipped, never guess-ranked. */
export async function getPopularTrackIds(
  albumId: string,
  albumArtist: string,
  tracks: RawTrack[],
): Promise<Set<string>> {
  const { lastfmApiKey } = await getAppConfig();
  if (!lastfmApiKey || tracks.length === 0) return new Set();

  const key = `popular:${albumId}`;
  const cached = await cache.get<string[]>(key, TTL_MS);
  if (cached) return new Set(cached);

  const ranked = await mapLimit(tracks, 5, async (t) => {
    const artist = t.artists?.[0]?.name ?? albumArtist;
    const playcount = await safe("lastfm-trackinfo", () =>
      fetchPlaycount(artist, t.name, lastfmApiKey),
    );
    return { id: t.id, playcount };
  });

  const ids = ranked
    .filter((r): r is { id: string; playcount: number } => r.playcount !== null)
    .sort((a, b) => b.playcount - a.playcount)
    .slice(0, TOP_N)
    .map((r) => r.id);

  await cache.set(key, ids);
  return new Set(ids);
}
