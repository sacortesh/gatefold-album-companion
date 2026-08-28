import { env } from "../env.js";
import { getJson } from "./http.js";

const BASE = "https://api.discogs.com";

const authHeader = (): Record<string, string> => ({
  authorization: `Discogs key=${env.DISCOGS_CONSUMER_KEY}, secret=${env.DISCOGS_CONSUMER_SECRET}`,
});

interface RawSearch {
  results?: Array<{
    id: number;
    type: string;
    title: string;
    year?: string;
    country?: string;
    format?: string[];
  }>;
}

interface RawRelease {
  notes?: string;
  genres?: string[];
  styles?: string[];
  labels?: Array<{ name: string }>;
  formats?: Array<{ name: string; descriptions?: string[] }>;
  extraartists?: Array<{ name: string; role: string }>;
  artists?: Array<{ name: string }>;
}

export interface DiscogsContext {
  credits: Array<{ name: string; roles: string[] }>;
  notes: string | null;
  labels: string[];
  genres: string[];
  formats: string[];
  url: string;
}

/** Discogs suffixes duplicate artist names with " (2)", " (3)". */
const cleanName = (n: string) => n.replace(/\s*\(\d+\)\s*$/, "").trim();

/** "Bass, Guitar [Additional]" → ["Bass", "Guitar [Additional]"] */
const splitRoles = (role: string) =>
  role
    .split(/,\s*(?![^[]*\])/)
    .map((r) => r.trim())
    .filter(Boolean);

/** Strip Discogs' `[a=…]` / `[url=…]` / `[b]` markup and cap the length. */
const cleanNotes = (n: string): string =>
  n
    .replace(/\[\/?[a-z][^\]]*\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1200);

export async function getDiscogs(input: {
  artist: string;
  album: string;
  year: string | null;
}): Promise<DiscogsContext | null> {
  const params = new URLSearchParams({
    type: "release",
    artist: input.artist,
    release_title: input.album,
    per_page: "25",
  });

  const search = await getJson<RawSearch>(
    `${BASE}/database/search?${params.toString()}`,
    { headers: authHeader() },
  );

  // Prefer the original studio album over promos, singles, comps and reissues.
  const best = (search.results ?? [])
    .filter((r) => r.type === "release")
    .map((r) => {
      const fmt = (r.format ?? []).map((f) => f.toLowerCase());
      let score = 0;
      if (fmt.includes("album")) score += 3;
      if (fmt.some((f) => /promo|single|compilation|unofficial|dvd|test/.test(f)))
        score -= 6;
      if (input.year && r.year === input.year) score += 3;
      return { r, score, year: Number(r.year) || 9999 };
    })
    .sort((a, b) => b.score - a.score || a.year - b.year)[0];
  if (!best) return null;

  const release = await getJson<RawRelease>(`${BASE}/releases/${best.r.id}`, {
    headers: authHeader(),
  });

  const byPerson = new Map<string, Set<string>>();
  for (const ea of release.extraartists ?? []) {
    const name = cleanName(ea.name);
    if (!name) continue;
    const set = byPerson.get(name) ?? new Set<string>();
    for (const role of splitRoles(ea.role)) set.add(role);
    byPerson.set(name, set);
  }

  const credits = [...byPerson.entries()]
    .map(([name, roles]) => ({ name, roles: [...roles] }))
    .slice(0, 40);

  const genres = [
    ...new Set([...(release.genres ?? []), ...(release.styles ?? [])]),
  ];
  const formats = [
    ...new Set(
      (release.formats ?? []).flatMap((f) => [
        f.name,
        ...(f.descriptions ?? []),
      ]),
    ),
  ].filter(Boolean);

  return {
    credits,
    notes: release.notes ? cleanNotes(release.notes) || null : null,
    labels: [...new Set((release.labels ?? []).map((l) => l.name))],
    genres,
    formats,
    url: `https://www.discogs.com/release/${best.r.id}`,
  };
}
