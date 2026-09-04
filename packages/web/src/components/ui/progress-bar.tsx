import { cn } from "../../lib/cn";

export function ProgressBar({
  pct,
  className,
}: {
  pct: number;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1 flex-1 rounded-full bg-surface-2", className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
