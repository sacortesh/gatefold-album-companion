import type { AlbumSummary } from "@gatefold/shared";

type Script = AlbumSummary["languages"][number];

/** "latin" is deliberately excluded — it's most tracks, and isn't a useful
 *  "show me only X language" study-queue filter target the way the other
 *  three scripts are (Phase 11.3). */
const SCRIPT_LABEL: Partial<Record<Script, string>> = {
  cyrillic: "Russian",
  hangul: "Korean",
  japanese: "Japanese",
};

/** Human-readable, filterable labels for an album's detected lyrics
 *  languages — feeds the free-text filter on Backlog/Revisit/Reviews so
 *  typing "japanese" surfaces albums tagged with that script. */
export function languageLabels(languages: Script[]): string[] {
  return languages
    .map((l) => SCRIPT_LABEL[l])
    .filter((l): l is string => Boolean(l));
}
