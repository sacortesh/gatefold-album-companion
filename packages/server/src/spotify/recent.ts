import type { TrackRef } from "@gatefold/shared";
import { spotifyRequest } from "./client.js";

interface RawTrack {
  id: string | null;
  name: string;
  uri: string;
  duration_ms: number;
  artists?: Array<{ name: string }>;
  album?: {
    id: string;
    name: string;
    images?: Array<{ url: string; width: number | null }>;
  };
}

export const toTrackRef = (t: RawTrack): TrackRef | null => {
  if (!t.id) return null;
  return {
    id: t.id,
    name: t.name,
    uri: t.uri,
    artists: (t.artists ?? []).map((a) => a.name),
    albumId: t.album?.id ?? "",
    albumName: t.album?.name ?? "",
    image: t.album?.images?.[0]?.url ?? null,
    durationMs: t.duration_ms,
  };
};

export interface RecentPlay {
  track: TrackRef;
  playedAt: string;
}

export async function getRecentlyPlayed(limit = 50): Promise<RecentPlay[]> {
  const raw = await spotifyRequest<{
    items: Array<{ track: RawTrack; played_at: string }>;
  }>({ path: "/me/player/recently-played", query: { limit } });

  return raw.items
    .map((i) => {
      const track = toTrackRef(i.track);
      return track ? { track, playedAt: i.played_at } : null;
    })
    .filter((x): x is RecentPlay => x !== null);
}
