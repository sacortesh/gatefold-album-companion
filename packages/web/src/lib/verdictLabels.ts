import type { PlaylistAlbumStatus, Verdict } from "@gatefold/shared";

export const VERDICT_LABEL: Record<Verdict, string> = {
  keep: "kept",
  revisit: "marked revisit",
  pass: "passed",
  delete: "deleted",
};

/** Trailing label for a non-"new" album status (Phase 10.13's pattern,
 *  shared with 12.2's Similar Albums strip) — names the specific reason
 *  an album is excluded from selection rather than a generic "already
 *  known." */
export function statusLabel(
  status: PlaylistAlbumStatus,
  verdict: Verdict | null,
): string {
  if (status === "in_backlog") return "in backlog";
  if (status === "in_revisit") return "in revisit";
  if (status === "reviewed") return verdict ? VERDICT_LABEL[verdict] : "reviewed";
  return "new";
}
