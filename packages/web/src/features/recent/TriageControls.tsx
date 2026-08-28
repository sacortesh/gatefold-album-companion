interface LikeProps {
  liked: boolean;
  onToggle: () => void;
  pending?: boolean;
  size?: "sm" | "lg";
}

export function LikeButton({ liked, onToggle, pending, size = "sm" }: LikeProps) {
  const big = size === "lg";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={liked}
      title={liked ? "Remove from Liked Songs" : "Add to Liked Songs (L)"}
      className={
        big
          ? `rounded-md px-5 py-2 text-sm font-medium transition disabled:opacity-50 ${
              liked
                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                : "border border-neutral-700 text-neutral-200 hover:bg-neutral-800"
            }`
          : `rounded px-2 py-1 text-sm transition disabled:opacity-50 ${
              liked
                ? "text-emerald-400"
                : "text-neutral-500 hover:text-neutral-200"
            }`
      }
    >
      {liked ? "♥" : "♡"}
      {big ? <span className="ml-2">{liked ? "Liked" : "Like"}</span> : null}
    </button>
  );
}

interface BangerProps {
  inBanger: boolean;
  label: string;
  onFire: () => void;
  pending?: boolean;
  size?: "sm" | "lg";
}

export function BangerButton({
  inBanger,
  label,
  onFire,
  pending,
  size = "sm",
}: BangerProps) {
  const big = size === "lg";
  return (
    <button
      type="button"
      onClick={onFire}
      disabled={pending || inBanger}
      title={
        inBanger ? `Already in ${label}` : `Add to ${label} + Like (B)`
      }
      className={
        big
          ? `rounded-md px-5 py-2 text-sm font-medium transition disabled:cursor-default disabled:opacity-60 ${
              inBanger
                ? "border border-amber-700 bg-amber-950 text-amber-300"
                : "bg-amber-500 text-neutral-950 hover:bg-amber-400"
            }`
          : `rounded px-2 py-1 text-xs font-medium transition disabled:cursor-default disabled:opacity-60 ${
              inBanger
                ? "border border-amber-800 text-amber-400"
                : "bg-amber-500/90 text-neutral-950 hover:bg-amber-400"
            }`
      }
    >
      {inBanger ? `✓ ${label}` : label}
    </button>
  );
}
