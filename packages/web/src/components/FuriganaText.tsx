import type { FuriganaSegment } from "@gatefold/shared";

/** Renders kuroshiro-derived furigana segments as real `<ruby>` elements —
 *  never `dangerouslySetInnerHTML`. Kuroshiro's raw furigana HTML passes
 *  lyric text through unescaped, so injecting it directly would be a
 *  stored-XSS hole if a lyric ever contained a literal `<`. Segment text
 *  goes through React's normal child rendering instead, always escaped. */
export function FuriganaText({ segments }: { segments: FuriganaSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.reading ? (
          <ruby key={i}>
            {seg.text}
            <rp>(</rp>
            <rt className="text-[0.6em] text-ink-muted">{seg.reading}</rt>
            <rp>)</rp>
          </ruby>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}
