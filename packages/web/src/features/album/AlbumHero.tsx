import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { MetaLine } from "../../components/MetaLine";

/**
 * DESIGN.md's "record-sleeve" layout concept: the album's own artwork
 * becomes the room the header sits in, not a small thumbnail beside text.
 * The blurred background is decorative (aria-hidden, empty alt) — the
 * foreground cover-art frame carries the real image semantics.
 */
export function AlbumHero({
  image,
  name,
  artists,
  meta,
  genres,
  actions,
  children,
}: {
  image: string | null;
  name: string;
  artists: string;
  meta: Array<string | number | null | undefined>;
  genres: string[];
  actions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border">
      {image && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          decoding="async"
          className={cn(
            "absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500",
          )}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/30" />

      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:p-8">
        <div className="h-44 w-44 shrink-0 overflow-hidden rounded-lg bg-surface shadow-lg shadow-black/40">
          {image && (
            <img
              src={image}
              alt={`${name} cover art`}
              width={176}
              height={176}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-3xl text-balance font-distressed leading-tight text-ink">
            {name}
          </h1>
          <p className="font-display text-lg italic text-ink-muted">
            {artists}
          </p>
          <MetaLine parts={meta} />
          {genres.length > 0 && (
            <p className="text-xs text-ink-muted">{genres.join(", ")}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {actions}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
