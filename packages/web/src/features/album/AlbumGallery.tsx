import { useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AlbumContextImage } from "@gatefold/shared";
import { api } from "../../api/client";
import { Dialog, DialogContent, DialogTitle } from "../../components/ui/dialog";

const TYPE_FALLBACK: Record<AlbumContextImage["type"], string> = {
  front: "Front cover",
  back: "Back cover",
  secondary: "Additional image",
};
const SOURCE_LABEL: Record<AlbumContextImage["source"], string> = {
  discogs: "Discogs",
  coverartarchive: "Cover Art Archive",
};
const describe = (img: AlbumContextImage): string =>
  `${img.label ?? TYPE_FALLBACK[img.type]} · ${SOURCE_LABEL[img.source]}`;

/** Back cover / liner / insert scans (Phase 10.14) — its own always-visible
 *  row near the header, not buried in the collapsed "About this album"
 *  panel, since this is visual content. Renders nothing when the only
 *  image found is another front cover — the point is the *extra* material,
 *  not a redundant second copy of what the hero already shows. */
export function AlbumGallery({ albumId }: { albumId: string }) {
  const ctx = useQuery({
    queryKey: ["album-context", albumId],
    queryFn: () => api.albumContext(albumId),
    enabled: Boolean(albumId),
    staleTime: 60 * 60_000,
  });
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Scans can be a few hundred KB even at the reduced size — track which
  // URLs have already loaded (browser-cached) so a re-view is instant, and
  // show a spinner instead of a frozen frame for a first view.
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());

  const images = ctx.data?.images ?? [];
  const hasExtra = images.some((img) => img.type !== "front");
  if (!ctx.isSuccess || !hasExtra) return null;

  const attribution = images.some((img) => img.source === "coverartarchive")
    ? ctx.data.links.filter((l) =>
        ["Discogs", "Cover Art Archive"].includes(l.label),
      )
    : ctx.data.links.filter((l) => l.label === "Discogs");

  const active = openIndex !== null ? images[openIndex] : null;

  const step = (dir: -1 | 1) =>
    setOpenIndex((i) => (i === null ? i : (i + dir + images.length) % images.length));

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.map((img, i) => (
          <button
            key={img.url}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="h-16 w-16 shrink-0 overflow-hidden rounded bg-surface-2 opacity-80 transition-opacity hover:opacity-100"
          >
            <img
              src={img.thumbnailUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {attribution.length > 0 && (
        <div className="flex flex-wrap gap-x-3 text-xs">
          {attribution.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              View on {l.label} →
            </a>
          ))}
        </div>
      )}

      <Dialog
        open={active !== null}
        onOpenChange={(open) => !open && setOpenIndex(null)}
      >
        <DialogContent
          className="max-w-[90vw] w-[90vw] p-4"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") step(-1);
            if (e.key === "ArrowRight") step(1);
          }}
        >
          <DialogTitle className="sr-only">
            {active ? describe(active) : "Album images"}
          </DialogTitle>
          {active && (
            <div className="space-y-2">
              <div className="relative flex min-h-[40vh] items-center justify-center">
                {!loadedUrls.has(active.url) && (
                  <RefreshCw className="absolute size-6 text-ink-muted motion-safe:animate-spin" />
                )}
                <img
                  key={active.url}
                  src={active.url}
                  alt=""
                  decoding="async"
                  onLoad={() =>
                    setLoadedUrls((s) => new Set(s).add(active.url))
                  }
                  className={`mx-auto max-h-[75vh] w-full rounded-md object-contain transition-opacity ${
                    loadedUrls.has(active.url) ? "opacity-100" : "opacity-0"
                  }`}
                />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous image"
                      onClick={() => step(-1)}
                      className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/70 text-ink hover:bg-bg"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next image"
                      onClick={() => step(1)}
                      className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/70 text-ink hover:bg-bg"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                )}
              </div>
              <p className="text-center text-sm text-ink-muted">
                {describe(active)}
                {images.length > 1 && (
                  <span className="ml-2 tabular-nums">
                    {openIndex! + 1} / {images.length}
                  </span>
                )}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
