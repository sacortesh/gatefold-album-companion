import { Check, HandMetal, Heart } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Replaces the old separate `LikeButton`/`BangerButton` pair (they'd grown
 * into two near-duplicate components) with one variant-driven molecule.
 * `active`/`pending` stay separate props rather than folding into `kind`
 * because they're independently toggleable state, not display modes.
 */
export function TriageButton({
  kind,
  active,
  onToggle,
  pending,
  label,
  size = "sm",
}: {
  kind: "like" | "banger";
  active: boolean;
  onToggle: () => void;
  pending?: boolean;
  /** Playlist name for `kind: "banger"`; ignored for `kind: "like"`. */
  label?: string;
  size?: "sm" | "lg";
}) {
  const big = size === "lg";
  const Icon = kind === "like" ? Heart : active ? Check : HandMetal;
  const text =
    kind === "like" ? (active ? "Liked" : "Like") : label ?? "Banger";
  const title =
    kind === "like"
      ? active
        ? "Remove from Liked Songs"
        : "Add to Liked Songs (L)"
      : active
        ? `Already in ${text}`
        : `Add to ${text} + Like (B)`;
  const disabled = kind === "like" ? pending : pending || active;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      aria-label={title}
      title={title}
      className={cn(
        "inline-flex items-center rounded-md font-medium transition-colors disabled:cursor-default disabled:opacity-60",
        big ? "gap-2 px-5 py-2 text-sm" : "gap-1 px-2 py-1 text-xs",
        kind === "like"
          ? active
            ? big
              ? "bg-primary text-primary-ink hover:bg-primary/90"
              : "text-primary"
              : big
                ? "border border-border text-ink hover:bg-surface-2"
                : "text-ink-muted hover:text-ink"
          : active
            ? big
              ? "border border-banger/40 bg-banger/10 text-banger"
              : "border border-banger/40 text-banger"
            : "bg-banger text-primary-ink hover:bg-banger/90",
      )}
    >
      <Icon className="size-4" fill={kind === "like" && active ? "currentColor" : "none"} />
      {big && <span>{text}</span>}
    </button>
  );
}
