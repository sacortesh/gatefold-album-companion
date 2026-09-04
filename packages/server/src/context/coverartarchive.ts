import type { AlbumContextImage } from "@gatefold/shared";
import { USER_AGENT } from "./http.js";

const BASE = "https://coverartarchive.org";

interface RawImage {
  image: string;
  thumbnails?: { large?: string; small?: string; "1200"?: string };
  types?: string[];
  front?: boolean;
  back?: boolean;
}

/** Cover Art Archive types its images reliably (front/back/other), unlike
 *  Discogs' undifferentiated `secondary` bucket. 404 means no art was ever
 *  submitted for this release group — a normal, common outcome, not an
 *  error, so it's handled here rather than left to `safe()`'s warn-log. */
export async function getCoverArtArchive(
  releaseGroupMbid: string,
): Promise<AlbumContextImage[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(`${BASE}/release-group/${releaseGroupMbid}`, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GET coverartarchive → ${res.status}`);

  const data = (await res.json()) as { images?: RawImage[] };
  return (data.images ?? [])
    .filter((img) => img.image)
    .map((img) => ({
      // The raw `image` field is an unresized scan (routinely several MB —
      // measured one at 2.7MB); CAA also serves a 1200px-wide JPEG variant
      // that's ~6x smaller and plenty sharp for on-screen lightbox viewing.
      url: img.thumbnails?.["1200"] ?? img.thumbnails?.large ?? img.image,
      thumbnailUrl: img.thumbnails?.small ?? img.thumbnails?.large ?? img.image,
      type: img.front ? "front" : img.back ? "back" : "secondary",
      source: "coverartarchive" as const,
      label: img.types && img.types.length > 0 ? img.types.join(", ") : null,
    }));
}
