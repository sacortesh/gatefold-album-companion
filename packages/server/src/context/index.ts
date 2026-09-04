import type { AlbumContext, AlbumContextImage } from "@gatefold/shared";
import { makeCache } from "../cache.js";
import { getAppConfig } from "../store/appConfig.js";
import { getCoverArtArchive } from "./coverartarchive.js";
import { getDiscogs } from "./discogs.js";
import { safe } from "./http.js";
import { getMusicBrainz } from "./musicbrainz.js";
import { getWikipedia } from "./wikipedia.js";

const TYPE_ORDER: Record<AlbumContextImage["type"], number> = {
  front: 0,
  back: 1,
  secondary: 2,
};

const cache = makeCache("context");
const TTL_MS = 30 * 24 * 3600_000;

export interface AlbumContextInput {
  artist: string;
  album: string;
  year: string | null;
}

export async function getAlbumContext(
  input: AlbumContextInput,
): Promise<AlbumContext> {
  const { discogsConsumerKey, discogsConsumerSecret } = await getAppConfig();
  const discogsConfigured = Boolean(discogsConsumerKey && discogsConsumerSecret);

  const key = `ctx:${input.artist}::${input.album}`.toLowerCase();
  const cached = await cache.get<AlbumContext>(key, TTL_MS);
  // `images`, `images[].label`, and `credits[].discogsUrl` were all added
  // after this cache started filling up — a pre-existing 30-day entry won't
  // carry them, and the response schema now requires them.
  if (cached) {
    return {
      ...cached,
      images: (cached.images ?? []).map((img) => ({
        ...img,
        label: img.label ?? null,
      })),
      credits: cached.credits.map((c) => ({
        ...c,
        discogsUrl: c.discogsUrl ?? null,
      })),
      discogsConfigured,
    };
  }

  const mb = await safe("musicbrainz", () => getMusicBrainz(input));
  const wiki = await safe("wikipedia", () =>
    getWikipedia(input, mb?.wikipediaTitle ?? null),
  );
  const discogs = discogsConfigured
    ? await safe("discogs", () =>
        getDiscogs(input, {
          key: discogsConsumerKey,
          secret: discogsConsumerSecret,
        }),
      )
    : null;
  const caaImages = mb
    ? (await safe("coverartarchive", () => getCoverArtArchive(mb.releaseGroupId))) ?? []
    : [];

  const sources: AlbumContext["sources"] = [];
  if (mb) sources.push("musicbrainz");
  if (wiki) sources.push("wikipedia");
  if (discogs) sources.push("discogs");
  if (caaImages.length > 0) sources.push("coverartarchive");

  const images = [...caaImages, ...(discogs?.images ?? [])].sort(
    (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  );

  const links = [
    ...(wiki ? [{ label: "Wikipedia", url: wiki.url }] : []),
    ...(discogs ? [{ label: "Discogs", url: discogs.url }] : []),
    ...(mb?.links ?? []),
    ...(caaImages.length > 0 && mb
      ? [
          {
            label: "Cover Art Archive",
            url: `https://musicbrainz.org/release-group/${mb.releaseGroupId}/cover-art`,
          },
        ]
      : []),
  ].filter(
    (l, i, all) => all.findIndex((x) => x.label === l.label) === i,
  );

  const context: AlbumContext = {
    summary: wiki?.summary ?? null,
    summarySource: wiki ? { label: "Wikipedia", url: wiki.url } : null,
    credits: discogs?.credits ?? [],
    notes: discogs?.notes ?? null,
    facts: {
      firstReleased: mb?.firstReleased ?? null,
      labels: discogs?.labels ?? [],
      genres: discogs?.genres ?? [],
      formats: [
        ...new Set([...(mb?.formats ?? []), ...(discogs?.formats ?? [])]),
      ],
    },
    images,
    links,
    sources,
    discogsConfigured,
  };

  // Don't pin a 30-day empty result when every provider was unreachable.
  if (sources.length > 0) await cache.set(key, context);
  return context;
}
