import { makeCache } from "./cache.js";
import { getJson, safe } from "./context/http.js";
import { spotifyRequest } from "./spotify/client.js";
import { getAppConfig } from "./store/appConfig.js";

const BASE = "https://ws.audioscrobbler.com/2.0/";
/** Similar artists to pull top-album candidates from — well within Miller's
 *  Law for a horizontal strip, and caps the worst-case cold-lookup fan-out. */
const SIMILAR_ARTIST_LIMIT = 8;

const cache = makeCache("similar-albums");
const TTL_MS = 30 * 24 * 3600_000;

interface SimilarArtistsResponse {
  similarartists?: { artist?: Array<{ name: string }> };
}
interface TopAlbumsResponse {
  topalbums?: { album?: Array<{ name: string; artist: { name: string } }> };
}
interface SpotifyAlbumSearch {
  albums?: { items: Array<{ id: string }> };
}

async function fetchSimilarArtists(
  artist: string,
  apiKey: string,
): Promise<string[]> {
  const url = `${BASE}?${new URLSearchParams({
    method: "artist.getsimilar",
    artist,
    api_key: apiKey,
    format: "json",
    limit: String(SIMILAR_ARTIST_LIMIT),
  })}`;
  const data = await getJson<SimilarArtistsResponse>(url);
  return (data.similarartists?.artist ?? []).map((a) => a.name);
}

async function fetchTopAlbum(
  artist: string,
  apiKey: string,
): Promise<{ artist: string; album: string } | null> {
  const url = `${BASE}?${new URLSearchParams({
    method: "artist.gettopalbums",
    artist,
    api_key: apiKey,
    format: "json",
    limit: "1",
  })}`;
  const data = await getJson<TopAlbumsResponse>(url);
  const top = data.topalbums?.album?.[0];
  return top ? { artist: top.artist.name, album: top.name } : null;
}

/** Resolve a Last.fm (artist, album) pair to a real Spotify album id — Last.fm's
 *  own cover art is near-universally a generic placeholder, so the point of
 *  this hop is Spotify's actual artwork/metadata, not just a name match. */
async function resolveOnSpotify(
  artist: string,
  album: string,
): Promise<string | null> {
  const res = await spotifyRequest<SpotifyAlbumSearch>({
    path: "/search",
    query: { q: `album:${album} artist:${artist}`, type: "album", limit: 1 },
  });
  return res.albums?.items[0]?.id ?? null;
}

/** Similar-artist → their top album → resolved to a Spotify id. Cached per
 *  artist for 30 days (slow-changing, and this is the expensive N+1 half of
 *  the lookup) — deliberately does *not* know about Backlog/Revisit/Reviews,
 *  so that fast-changing local state never gets baked into a long-lived
 *  cache entry; the caller filters fresh against current state instead. */
export async function getSimilarAlbumIds(artist: string): Promise<string[]> {
  const { lastfmApiKey } = await getAppConfig();
  if (!lastfmApiKey) return [];

  const key = `similar:${artist}`.toLowerCase();
  const cached = await cache.get<string[]>(key, TTL_MS);
  if (cached) return cached;

  const similar = await safe("lastfm-similar", () =>
    fetchSimilarArtists(artist, lastfmApiKey),
  );
  if (!similar) return [];

  const resolved = await Promise.all(
    similar.map(async (name) => {
      const top = await safe("lastfm-topalbums", () =>
        fetchTopAlbum(name, lastfmApiKey),
      );
      if (!top) return null;
      return safe("spotify-album-search", () =>
        resolveOnSpotify(top.artist, top.album),
      );
    }),
  );

  const ids = [...new Set(resolved.filter((id): id is string => Boolean(id)))];
  await cache.set(key, ids);
  return ids;
}
