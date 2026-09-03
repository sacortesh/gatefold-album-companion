/** The Gatefold glyph (sleeve + record + note) as a CSS mask, so it recolors
 *  via any Tailwind bg-color class the same way the old `▸` did via text color. */
export function GatefoldMark({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block bg-emerald-500 align-[-0.2em] ${className}`}
      style={{
        WebkitMaskImage: "url(/gatefold-mark.svg)",
        maskImage: "url(/gatefold-mark.svg)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
