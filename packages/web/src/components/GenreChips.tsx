import { Badge } from "./ui/badge";

const MAX_VISIBLE = 3;

/** Genre chips for a list row (Phase 10.6) — capped so one heavily-tagged
 *  album doesn't blow out a row's height against its neighbors (Miller's
 *  Law: chunk, don't dump the whole array). Renders nothing when empty,
 *  same as every other optional list-row field in this app. */
export function GenreChips({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;
  const visible = genres.slice(0, MAX_VISIBLE);
  const extra = genres.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((g) => (
        <Badge key={g} variant="neutral">
          {g}
        </Badge>
      ))}
      {extra > 0 && <Badge variant="neutral">+{extra}</Badge>}
    </div>
  );
}
