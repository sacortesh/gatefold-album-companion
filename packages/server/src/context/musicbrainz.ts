import { getJson } from "./http.js";

const BASE = "https://musicbrainz.org/ws/2";

interface RawReleaseGroup {
  id: string;
  title: string;
  "primary-type"?: string | null;
  "secondary-types"?: string[];
  "first-release-date"?: string;
  score?: number;
  "artist-credit"?: Array<{ name: string }>;
}

interface RawRelation {
  type: string;
  url?: { resource: string };
}

export interface MusicBrainzContext {
  releaseGroupId: string;
  firstReleased: string | null;
  formats: string[];
  wikipediaTitle: string | null;
  links: Array<{ label: string; url: string }>;
}

const lower = (s: string) => s.toLowerCase().trim();

/** Wikipedia article title out of an `en.wikipedia.org/wiki/<Title>` URL. */
function wikiTitleFromUrl(url: string): string | null {
  const m = /\/(?:[a-z]{2})\.wikipedia\.org\/wiki\/(.+)$/.exec(url);
  return m?.[1] ? decodeURIComponent(m[1]).replace(/_/g, " ") : null;
}

export async function getMusicBrainz(input: {
  artist: string;
  album: string;
}): Promise<MusicBrainzContext | null> {
  const query = `releasegroup:"${input.album}" AND artist:"${input.artist}"`;
  const search = await getJson<{ "release-groups": RawReleaseGroup[] }>(
    `${BASE}/release-group?query=${encodeURIComponent(query)}&limit=5&fmt=json`,
    { retries: 2, timeoutMs: 10_000 },
  );

  const groups = search["release-groups"] ?? [];
  const match =
    groups.find(
      (g) =>
        lower(g.title) === lower(input.album) &&
        (g["artist-credit"] ?? []).some((a) => lower(a.name) === lower(input.artist)),
    ) ?? groups[0];
  if (!match) return null;

  const secondary = match["secondary-types"] ?? [];
  const formats = [match["primary-type"], ...secondary].filter(
    (t): t is string => Boolean(t) && t !== "Album",
  );

  let wikipediaTitle: string | null = null;
  const links: MusicBrainzContext["links"] = [];

  try {
    const detail = await getJson<{ relations?: RawRelation[] }>(
      `${BASE}/release-group/${match.id}?inc=url-rels&fmt=json`,
    );
    for (const rel of detail.relations ?? []) {
      const url = rel.url?.resource;
      if (!url) continue;
      if (rel.type === "wikipedia") {
        wikipediaTitle = wikiTitleFromUrl(url) ?? wikipediaTitle;
        links.push({ label: "Wikipedia", url });
      } else if (rel.type === "allmusic") {
        links.push({ label: "AllMusic", url });
      } else if (rel.type === "discogs") {
        links.push({ label: "Discogs", url });
      }
    }
  } catch {
    /* detail lookup is optional */
  }

  links.push({
    label: "MusicBrainz",
    url: `https://musicbrainz.org/release-group/${match.id}`,
  });

  return {
    releaseGroupId: match.id,
    firstReleased: match["first-release-date"] || null,
    formats,
    wikipediaTitle,
    links,
  };
}
