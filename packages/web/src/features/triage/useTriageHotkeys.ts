import { useEffect, useRef } from "react";

/**
 * Bind single-key shortcuts to callbacks. Keys are matched case-insensitively.
 * Ignores keystrokes while typing in a field or with a modifier held.
 */
export function useHotkeys(
  bindings: Record<string, () => void>,
  enabled = true,
): void {
  const latest = useRef(bindings);
  latest.current = bindings;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (el?.isContentEditable) return;
      const fn = latest.current[e.key.toLowerCase()];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}

/** `L` = toggle Like on the target track, `B` = Banger it. */
export function useTriageHotkeys(
  enabled: boolean,
  onLike: () => void,
  onBanger: () => void,
): void {
  useHotkeys({ l: onLike, b: onBanger }, enabled);
}
