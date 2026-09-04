import { useState } from "react";
import { Button } from "./ui/button";

/**
 * Was duplicated verbatim between SecuritySettings.tsx and SpotifySetup.tsx
 * — now a single shared molecule. `masked` shows a toggleable show/hide
 * (never `type="password"`, so browsers don't offer to save it as one).
 */
export function CopyField({
  label,
  value,
  masked,
}: {
  label: string;
  value: string;
  masked?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!masked);
  const display = masked && !revealed ? "•".repeat(Math.min(value.length, 32)) : value;

  return (
    <div className="space-y-1">
      <label className="text-xs text-ink-muted">{label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={display}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 flex-1 rounded-md border border-border bg-surface px-3 font-mono text-xs text-ink"
        />
        {masked && (
          <Button variant="secondary" size="sm" onClick={() => setRevealed((r) => !r)}>
            {revealed ? "Hide" : "Show"}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
