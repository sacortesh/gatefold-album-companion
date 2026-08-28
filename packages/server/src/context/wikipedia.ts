import { getJson } from "./http.js";

const REST = "https://en.wikipedia.org/w/rest.php/v1";
const SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary";

interface RawSummary {
  type?: string;
  title: string;
  description?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}

export interface WikipediaContext {
  summary: string;
  title: string;
  url: string;
}

const STOP = new Set(["the", "a", "an", "of", "and", "album", "ep"]);

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokens = (s: string): string[] =>
  norm(s)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));

/** Drop edition / part suffixes that hurt a title search. */
const searchTitle = (album: string): string =>
  album
    .replace(/\s*[([].*?[)\]]\s*$/, "")
    .replace(/\s*[,-]\s*(pt\.?|part)\s+[ivx\d]+\s*$/i, "")
    .replace(/\s*[,-]\s*(deluxe|remaster(ed)?|expanded|anniversary).*$/i, "")
    .trim();

async function fetchSummary(title: string): Promise<RawSummary | null> {
  const data = await getJson<RawSummary>(
    `${SUMMARY}/${encodeURIComponent(title.replace(/ /g, "_"))}`,
  ).catch(() => null);
  if (!data?.extract || data.type === "disambiguation") return null;
  return data;
}

const toContext = (d: RawSummary): WikipediaContext => ({
  summary: d.extract ?? "",
  title: d.title,
  url:
    d.content_urls?.desktop?.page ??
    `https://en.wikipedia.org/wiki/${encodeURIComponent(d.title)}`,
});

/** Does this summary actually describe *this* album (and not, say, its sequel)? */
function looksRight(
  d: RawSummary,
  input: { artist: string; album: string },
): boolean {
  const artistToks = new Set(tokens(input.artist));
  const albumToks = new Set(tokens(input.album));
  const titleToks = tokens(d.title);
  const hay = norm(`${d.title} ${d.description ?? ""} ${d.extract ?? ""}`);

  const artistHit = hay.includes(norm(input.artist));
  const soundsLikeRelease =
    /\b(album|ep|soundtrack|mixtape|demo|record)\b/.test(
      (d.description ?? "").toLowerCase(),
    ) || /\b(studio|debut) album\b/.test((d.extract ?? "").toLowerCase());

  // The candidate's title mustn't carry specifics the query album lacks
  // ("… Part II" when we asked for "… Pt. I").
  const extra = titleToks.filter(
    (t) => !albumToks.has(t) && !artistToks.has(t),
  );
  if (extra.length > 1) return false;

  const missing = [...albumToks].filter((t) => !titleToks.includes(t));
  const albumHit = missing.length <= 1;

  return artistHit && soundsLikeRelease && (albumHit || titleToks.length <= 2);
}

export async function getWikipedia(
  input: { artist: string; album: string },
  knownTitle: string | null,
): Promise<WikipediaContext | null> {
  // A title from MusicBrainz's Wikipedia relation is authoritative.
  if (knownTitle) {
    const d = await fetchSummary(knownTitle);
    if (d) return toContext(d);
  }

  const q = `${input.artist} ${searchTitle(input.album)} album`;
  const search = await getJson<{
    pages?: Array<{ key: string; title: string }>;
  }>(`${REST}/search/page?q=${encodeURIComponent(q)}&limit=5`);

  for (const page of search.pages ?? []) {
    const d = await fetchSummary(page.key ?? page.title);
    if (d && looksRight(d, input)) return toContext(d);
  }
  // Nothing matched confidently — better nothing than the wrong album.
  return null;
}
