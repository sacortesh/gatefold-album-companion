import { Fragment } from "react";
import { cn } from "../lib/cn";

/** Renders `parts` joined by a single middle-dot separator — capped at one
 * `·`-joined line per the taste-checklist's copy discipline. */
export function MetaLine({
  parts,
  className,
}: {
  parts: Array<string | number | null | undefined>;
  className?: string;
}) {
  const visible = parts.filter(
    (p): p is string | number => p !== null && p !== undefined && p !== "",
  );
  if (visible.length === 0) return null;
  return (
    <p className={cn("text-sm text-ink-muted", className)}>
      {visible.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="mx-1.5">·</span>}
          {part}
        </Fragment>
      ))}
    </p>
  );
}
